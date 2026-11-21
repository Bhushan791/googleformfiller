import { z } from "zod";
import answerCache from "./answerCache.js";
import { generateText, hasLLM } from "./llm/index.js";
import { detectObviousFieldType, stripMarkdownFences } from "./textGenerator.js";
import { setCache as setOptionCache, getCacheKey as getOptionCacheKey } from "./sentimentEngine.js";

// Active warming locks to ensure the same formKey is never warmed twice at once
const warmingLocks = new Set();
// Active background refill locks: `${formKey}:::${qid}:::${sentiment}`
const refillLocks = new Set();

const combinedPrewarmSchema = z.object({
  text: z
    .record(
      z.object({
        positive: z.array(z.string()).default([]),
        neutral: z.array(z.string()).default([]),
        negative: z.array(z.string()).default([]),
      })
    )
    .optional()
    .default({}),
  options: z
    .record(
      z.record(z.enum(["positive", "neutral", "negative", "n/a"]))
    )
    .optional()
    .default({}),
});

/**
 * Prewarms answer buffers and option classifications for a parsed Google Form in the background.
 *
 * @param {object} params
 * @param {string} params.formKey
 * @param {Array<object>} params.questions
 * @param {object} [params.formContext] - { title, description }
 * @param {Function} [params.generateTextFn] - Optional mock LLM for testing
 * @returns {Promise<void>}
 */
export async function prewarmForm({
  formKey,
  questions = [],
  formContext = null,
  generateTextFn = null,
  skipTopUp = false,
}) {
  if (!formKey || !questions.length) return;

  // Lock: prevent concurrent prewarming for the same formKey
  if (warmingLocks.has(formKey)) return;
  warmingLocks.add(formKey);

  try {
    // Filter questions that need LLM
    const aiChoiceQuestions = [];
    const aiTextQuestions = [];

    for (const q of questions) {
      if (!q) continue;
      const qid = q.id || q.entryId;
      if (!qid) continue;

      if (["multiple_choice", "dropdown", "checkboxes"].includes(q.type)) {
        if (q.options && q.options.length > 0) {
          aiChoiceQuestions.push(q);
        }
      } else if (["short_text", "paragraph"].includes(q.type)) {
        // Skip obvious field types (name, email, phone, age, city)
        if (!detectObviousFieldType(q.title)) {
          aiTextQuestions.push(q);
        }
      }
    }

    const totalAiQuestions = aiChoiceQuestions.length + aiTextQuestions.length;

    // If no questions need AI, mark ready immediately
    if (totalAiQuestions === 0) {
      answerCache.init(formKey, { totalAiQuestions: 0, usedLLM: false });
      answerCache.setStatus(formKey, "ready");
      return;
    }

    // Check LLM availability
    const llmFn = generateTextFn || generateText;
    const isLLMEnabled = generateTextFn ? true : hasLLM;

    if (!isLLMEnabled) {
      answerCache.init(formKey, { totalAiQuestions, usedLLM: false });
      answerCache.setStatus(formKey, "failed");
      return;
    }

    answerCache.init(formKey, { totalAiQuestions, usedLLM: true });

    // Build single combined prompt
    const contextTitle = (formContext?.title || "").trim();
    const contextDesc = (formContext?.description || "").trim().slice(0, 500);

    const contextSection =
      contextTitle || contextDesc
        ? `Form Title: "${contextTitle}"\n${contextDesc ? `Description: "${contextDesc}"\n` : ""}`
        : "";

    let textPromptPart = "";
    if (aiTextQuestions.length > 0) {
      const items = aiTextQuestions
        .map(
          (q) =>
            `- ID: "${q.id || q.entryId}" | Type: ${q.type} | Title: "${q.title}"${
              q.helpText ? ` | Help: "${q.helpText}"` : ""
            }`
        )
        .join("\n");

      textPromptPart = `\nText Questions to generate test answers for:
${items}
For EACH text question, generate exactly 8 positive, 8 neutral, and 8 negative distinct responses.
- Short text: concise phrases / single sentences under 12 words.
- Paragraph: 1 to 3 realistic sentences.
- Vary tone, phrasing, and perspective; avoid generic templates.\n`;
    }

    let choicePromptPart = "";
    if (aiChoiceQuestions.length > 0) {
      const items = aiChoiceQuestions
        .map(
          (q) =>
            `- ID: "${q.id || q.entryId}" | Title: "${q.title}" | Options: ${JSON.stringify(
              q.options || []
            )}`
        )
        .join("\n");

      choicePromptPart = `\nChoice Questions to classify options for:
${items}
For EACH choice question, classify every option as "positive", "neutral", "negative", or "n/a".\n`;
    }

    const prompt = `You are an AI pre-generating realistic test data and sentiment classifications for a Google Form.
${contextSection}${textPromptPart}${choicePromptPart}
Output a single valid JSON object strictly matching this schema:
{
  "text": {
    "<questionId>": {
      "positive": ["8 unique positive answers..."],
      "neutral": ["8 unique neutral answers..."],
      "negative": ["8 unique negative answers..."]
    }
  },
  "options": {
    "<questionId>": {
      "<optionText>": "positive" | "neutral" | "negative" | "n/a"
    }
  }
}
Respond ONLY with the JSON object.`;

    // Helper to call LLM and validate combined response
    async function executeCombinedCall() {
      const raw = await llmFn({
        prompt,
        maxTokens: 4000,
        temperature: 0.8,
        jsonMode: true,
      });

      const cleaned = stripMarkdownFences(raw || "{}");
      const parsed = JSON.parse(cleaned);
      return combinedPrewarmSchema.parse(parsed);
    }

    let result;
    try {
      result = await executeCombinedCall();
    } catch (firstErr) {
      console.warn("⚠️ Combined prewarm call failed, retrying once:", firstErr.message);
      try {
        result = await executeCombinedCall();
      } catch (retryErr) {
        console.warn("⚠️ Combined prewarm retry failed, marking status failed:", retryErr.message);
        answerCache.setStatus(formKey, "failed");
        return;
      }
    }

    // Populate option classifications
    if (result.options) {
      for (const [qid, optionMap] of Object.entries(result.options)) {
        answerCache.addOptions(formKey, qid, optionMap);
        // Also populate sentimentEngine's classification cache
        const matchingQ = aiChoiceQuestions.find((q) => (q.id || q.entryId) === qid);
        if (matchingQ) {
          const optKey = getOptionCacheKey(matchingQ);
          setOptionCache(optKey, optionMap);
        }
      }
    }

    // Populate text answer buffers (8 answers per sentiment)
    if (result.text) {
      for (const [qid, sentiments] of Object.entries(result.text)) {
        if (sentiments.positive?.length) {
          answerCache.pushAnswers(formKey, qid, "positive", sentiments.positive);
        }
        if (sentiments.neutral?.length) {
          answerCache.pushAnswers(formKey, qid, "neutral", sentiments.neutral);
        }
        if (sentiments.negative?.length) {
          answerCache.pushAnswers(formKey, qid, "negative", sentiments.negative);
        }
      }
    }

    // Check coverage
    const status = answerCache.getStatusInfo(formKey);
    const finalStatus = status.ready >= totalAiQuestions ? "ready" : "partial";
    answerCache.setStatus(formKey, finalStatus, { usedLLM: true });

    // Non-blocking background top-up: top up buffers to ~20 per sentiment per text question
    if (!skipTopUp && (finalStatus === "ready" || finalStatus === "partial")) {
      setTimeout(() => {
        topUpBuffers({
          formKey,
          questions: aiTextQuestions,
          formContext,
          generateTextFn,
        }).catch((e) => {
          console.warn("⚠️ Background top-up error:", e.message);
        });
      }, 50);
    }
  } catch (err) {
    console.warn("⚠️ Prewarm execution error:", err.message);
    answerCache.setStatus(formKey, "failed");
  } finally {
    warmingLocks.delete(formKey);
  }
}

/**
 * Tops up text buffers to ~20 answers per sentiment in the background.
 */
async function topUpBuffers({ formKey, questions = [], formContext, generateTextFn }) {
  for (const q of questions) {
    const qid = q.id || q.entryId;
    for (const sent of ["positive", "neutral", "negative"]) {
      const currentSize = answerCache.size(formKey, qid, sent);
      if (currentSize < 20) {
        const needed = 20 - currentSize;
        await refillBuffer({
          formKey,
          question: q,
          sentiment: sent,
          count: Math.min(20, needed),
          formContext,
          generateTextFn,
        }).catch(() => {});
      }
    }
  }
}

/**
 * Triggers a background refill for a specific question & sentiment.
 * Max 40 answers per call, respects concurrency and lock.
 */
export async function refillBuffer({
  formKey,
  question,
  sentiment,
  count = 20,
  formContext = null,
  styleHint = null,
  generateTextFn = null,
}) {
  if (!formKey || !question || !sentiment) return;
  const qid = question.id || question.entryId;
  const lockKey = `${formKey}:::${qid}:::${sentiment}`;

  if (refillLocks.has(lockKey)) return;
  refillLocks.add(lockKey);

  try {
    const llmFn = generateTextFn || generateText;
    const isLLMEnabled = generateTextFn ? true : hasLLM;
    if (!isLLMEnabled) return;

    const safeCount = Math.max(1, Math.min(40, count));
    const isParagraph = question.type === "paragraph";

    const lengthInstruction = isParagraph
      ? "Each answer MUST be 1 to 3 natural sentences in length."
      : "Each answer MUST be a short phrase or single sentence under 12 words.";

    const contextTitle = formContext?.title ? formContext.title.trim() : "";
    const contextDesc = formContext?.description
      ? formContext.description.trim().slice(0, 500)
      : "";
    const contextBlock =
      contextTitle || contextDesc
        ? `\nForm topic context:\nTitle: "${contextTitle}"\n${
            contextDesc ? `Description: "${contextDesc}"\n` : ""
          }`
        : "";

    const styleHintBlock = styleHint ? `\nStyle hint: ${styleHint}\n` : "";

    const prompt = `You are generating realistic test responses for a public Google Form survey question.
${contextBlock}${styleHintBlock}Generate a JSON array of exactly ${safeCount} varied, natural, and distinct responses with a **${sentiment}** sentiment.
${lengthInstruction}
Do NOT include numbers or bullet points inside the answer strings.

Question: "${question.title || ""}"
${question.helpText ? `Help text: "${question.helpText}"` : ""}

Respond ONLY with a valid JSON array of strings:
["answer 1", "answer 2", ...]`;

    const raw = await llmFn({
      prompt,
      maxTokens: isParagraph ? 1500 : 800,
      temperature: 0.8,
      jsonMode: true,
    });

    const cleaned = stripMarkdownFences(raw || "[]");
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      answerCache.pushAnswers(formKey, qid, sentiment, parsed);
    }
  } catch (err) {
    console.warn(`⚠️ Background refill error for ${qid} (${sentiment}):`, err.message);
  } finally {
    refillLocks.delete(lockKey);
  }
}
