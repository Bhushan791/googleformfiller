import { z } from "zod";
import answerCache from "./answerCache.js";
import { generateText, hasLLM } from "./llm/index.js";
import {
  detectObviousFieldType,
  stripMarkdownFences,
  buildModeInstructions,
  filterDiverseAnswers,
  hasPastExperiencePhrasing,
} from "./textGenerator.js";
import { setCache as setOptionCache, getCacheKey as getOptionCacheKey } from "./sentimentEngine.js";
import {
  HARDCODED_SHORT_TEXT,
  HARDCODED_PARAGRAPHS,
  classifyOptionHeuristic,
} from "../data/hardcodedResponses.js";

// Active warming locks to ensure the same formKey is never warmed twice at once
const warmingLocks = new Set();
// Active background refill locks: `${formKey}:::${qid}:::${sentiment}`
const refillLocks = new Set();

/**
 * Populates the answerCache with high-quality custom hardcoded responses when LLM is unavailable.
 */
export function populateHardcodedFallback(formKey, questions = [], settings = {}) {
  const requestedMode = settings?.audienceMode || "auto";
  const effectiveMode = requestedMode === "auto" ? "research" : requestedMode;

  answerCache.setDetection(formKey, {
    detectedMode: "research",
    confidence: 0.7,
    reason: "Fallback mode: natural survey templates",
    audience: "General survey respondents",
    effectiveMode,
  });

  for (const q of questions) {
    const qid = q.id || q.entryId;
    if (!qid) continue;

    // Choice questions
    if (["multiple_choice", "dropdown", "checkboxes"].includes(q.type) && Array.isArray(q.options)) {
      const optionMap = {};
      for (const opt of q.options) {
        optionMap[opt] = classifyOptionHeuristic(opt);
      }
      answerCache.addOptions(formKey, qid, optionMap);
      const optKey = getOptionCacheKey(q);
      setOptionCache(optKey, optionMap);
    }

    // Text questions
    if (["short_text", "paragraph"].includes(q.type)) {
      const isParagraph = q.type === "paragraph";
      for (const sent of ["positive", "neutral", "negative"]) {
        const pool = isParagraph ? HARDCODED_PARAGRAPHS[sent] : HARDCODED_SHORT_TEXT[sent];
        if (pool && pool.length > 0) {
          const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, 8);
          answerCache.pushAnswers(formKey, qid, sent, shuffled);
        }
      }
    }
  }

  answerCache.setStatus(formKey, "ready", { usedLLM: false, fallbackUsed: true });
}

const combinedPrewarmSchema = z.object({
  detection: z
    .object({
      mode: z.string().optional(),
      confidence: z.number().optional(),
      reason: z.string().optional(),
      audience: z.string().optional(),
    })
    .optional(),
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
  settings = {},
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
      answerCache.setStatus(formKey, "ready", { usedLLM: false, fallbackUsed: true });
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
    const scenario = (settings?.scenario || "").trim().slice(0, 400);

    const contextSection =
      contextTitle || contextDesc
        ? `Form Title: "${contextTitle}"\n${contextDesc ? `Description: "${contextDesc}"\n` : ""}${
            scenario ? `Scenario note: "${scenario}"\n` : ""
          }`
        : "";

    // Include all survey questions for mode detection (skipping obvious identity fields like name/email/phone)
    const surveyQuestions = (questions || []).filter(
      (q) => !detectObviousFieldType(q?.title || "")
    );

    const allQuestionsSummary = surveyQuestions
      .map((q, idx) => {
        const opts = q.options?.length ? ` | Options: ${JSON.stringify(q.options.slice(0, 8))}` : "";
        return `${idx + 1}. [${q.type}] "${q.title}"${opts}`;
      })
      .join("\n");

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

    const requestedMode = settings?.audienceMode || "auto";
    const modeRules = buildModeInstructions(
      requestedMode !== "auto" ? requestedMode : "auto",
      scenario
    );

    const prompt = `You are an AI pre-generating realistic test data and sentiment classifications for a Google Form.
${contextSection}
All Form Questions:
${allQuestionsSummary}
${textPromptPart}${choicePromptPart}
STEP 1: Detect the audience mode of this form based on its title, description, and questions.
Choose one of:
- "prelaunch": Product or service NOT yet released/launched (waitlists, concept interest, feature requests, prototypes).
- "launched": Active product or service already in use by customers.
- "event": Event, seminar, workshop, conference, or meetup attendance feedback.
- "research": General demographic, lifestyle, user habits, or academic survey without product in use.
If you are unsure or confidence < 0.6, classify as "research".

STEP 2: Generate text answers and option classifications adhering strictly to these mode rules:
${modeRules}

Output a single valid JSON object strictly matching this schema:
{
  "detection": {
    "mode": "prelaunch" | "launched" | "event" | "research",
    "confidence": 0.0 to 1.0,
    "reason": "one short line explaining why this mode fits",
    "audience": "one line describing the respondent audience"
  },
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
        console.warn("⚠️ Combined prewarm retry failed; populating custom hardcoded responses:", retryErr.message);
        populateHardcodedFallback(formKey, questions, settings);
        return;
      }
    }

    // Process audience detection
    const det = result.detection || {};
    const validModes = ["prelaunch", "launched", "event", "research"];
    let detectedMode = validModes.includes(det.mode) ? det.mode : "research";
    let confidence =
      typeof det.confidence === "number"
        ? Math.max(0, Math.min(1, det.confidence))
        : 0.7;
    let reason = (det.reason || "Audience survey inferred from form context").slice(0, 200);
    let audience = (det.audience || "General respondents").slice(0, 200);

    if (confidence < 0.6) {
      detectedMode = "research";
    }

    const effectiveMode = requestedMode === "auto" ? detectedMode : requestedMode;

    answerCache.setDetection(formKey, {
      detectedMode,
      confidence,
      reason,
      audience,
      effectiveMode,
    });

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

    // Populate text answer buffers (8 answers per sentiment) with diversity and blocklist filters
    if (result.text) {
      for (const [qid, sentiments] of Object.entries(result.text)) {
        for (const sent of ["positive", "neutral", "negative"]) {
          let answers = sentiments[sent] || [];
          // Filter exact and near duplicates (Jaccard > 0.7)
          answers = filterDiverseAnswers(answers, { maxJaccard: 0.7 });
          // Enforce past experience blocklist for prelaunch and research
          if (effectiveMode === "prelaunch" || effectiveMode === "research") {
            answers = answers.filter((ans) => !hasPastExperiencePhrasing(ans));
          }
          if (answers.length > 0) {
            answerCache.pushAnswers(formKey, qid, sent, answers);
          }
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
          settings,
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
async function topUpBuffers({ formKey, questions = [], formContext, settings = {}, generateTextFn }) {
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
          settings,
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
  settings = null,
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

    const cached = answerCache.get(formKey);
    const requestedMode = settings?.audienceMode;
    let effectiveMode = "research";
    if (requestedMode && requestedMode !== "auto") {
      effectiveMode = requestedMode;
    } else if (cached?.effectiveMode) {
      effectiveMode = cached.effectiveMode;
    } else if (cached?.detectedMode) {
      effectiveMode = cached.detectedMode;
    }
    const scenario = settings?.scenario || "";
    const modeInstructions = buildModeInstructions(effectiveMode, scenario);

    const styleHintBlock = styleHint ? `\nStyle hint: ${styleHint}\n` : "";

    const prompt = `You are generating realistic test responses for a public Google Form survey question.
${contextBlock}
${modeInstructions}
${styleHintBlock}Generate a JSON array of exactly ${safeCount} varied, natural, and distinct responses with a **${sentiment}** sentiment.
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
    let parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Filter near duplicates (Jaccard > 0.7)
      parsed = filterDiverseAnswers(parsed, { maxJaccard: 0.7 });
      // Block past experience phrasing in prelaunch & research
      if (effectiveMode === "prelaunch" || effectiveMode === "research") {
        parsed = parsed.filter((ans) => !hasPastExperiencePhrasing(ans));
      }
      if (parsed.length > 0) {
        answerCache.pushAnswers(formKey, qid, sentiment, parsed);
      }
    }
  } catch (err) {
    console.warn(`⚠️ Background refill error for ${qid} (${sentiment}), using hardcoded responses:`, err.message);
    const isParagraph = question.type === "paragraph";
    const pool = isParagraph ? HARDCODED_PARAGRAPHS[sentiment] : HARDCODED_SHORT_TEXT[sentiment];
    if (pool && pool.length > 0) {
      const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, 8);
      answerCache.pushAnswers(formKey, qid, sentiment, shuffled);
    }
  } finally {
    refillLocks.delete(lockKey);
  }
}
