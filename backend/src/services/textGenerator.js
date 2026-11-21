import { z } from "zod";
import config from "../config/env.js";
import { generateText, hasLLM } from "./llm/index.js";
import answerCache from "./answerCache.js";
import { refillBuffer } from "./prewarm.js";

// ---------------------------------------------------------------------------
// Local built-in realistic mock data for obvious field types
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Sam", "Priya", "David", "Sarah",
  "Liam", "Emma", "Carlos", "Amina", "Wei", "Elena", "Lucas", "Maya",
  "Aarav", "Chloe", "Noah", "Fatima", "Gabriel", "Hana", "Marcus", "Zoe"
];

const LAST_NAMES = [
  "Morgan", "Smith", "Chen", "Sharma", "Patel", "Wilson", "Gomez", "Yusuf",
  "Kim", "Ivanova", "Silva", "Tanaka", "Johnson", "Brown", "Ali", "Garcia",
  "Taylor", "Davies", "Muller", "O'Connor", "Dubois", "Santos", "Wang", "Rossi"
];

const CITIES = [
  "New York", "London", "Tokyo", "Berlin", "Toronto", "Sydney", "Mumbai",
  "Singapore", "Paris", "Austin", "Chicago", "Amsterdam", "Dublin", "Seoul",
  "Vancouver", "Melbourne", "San Francisco", "Barcelona", "Boston", "Stockholm"
];

/**
 * Detects whether a question title corresponds to an obvious field type.
 * Returns "name" | "email" | "phone" | "age" | "city" | null.
 */
export function detectObviousFieldType(title = "") {
  const t = title.toLowerCase().trim();

  // Email
  if (/\b(e-?mail|email\s*address)\b/.test(t)) {
    return "email";
  }

  // Phone
  if (/\b(phone|mobile|telephone|cell|contact\s*number)\b/.test(t)) {
    return "phone";
  }

  // Age
  if (/\b(age|years\s*old)\b/.test(t) && !/\b(stage|page|percentage)\b/.test(t)) {
    return "age";
  }

  // City
  if (/\b(city|town|municipality)\b/.test(t) && !/\b(ethnicity|capacity)\b/.test(t)) {
    return "city";
  }

  // Name (check last so "User Name" matches name, but "Email" was checked first)
  if (/\b(full\s*name|first\s*name|your\s*name|candidate\s*name|contact\s*person)\b/.test(t) || t === "name") {
    return "name";
  }

  return null;
}

/**
 * Generates a realistic fake value for an obvious field type locally.
 * Guaranteed to use example.com for emails.
 */
export function generateObviousFieldValue(fieldType) {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

  switch (fieldType) {
    case "name":
      return `${first} ${last}`;

    case "email": {
      // RFC 2606 / RFC 6761 reserved domain for testing
      const num = Math.floor(100 + Math.random() * 900);
      const cleanFirst = first.toLowerCase().replace(/[^a-z]/g, "");
      const cleanLast = last.toLowerCase().replace(/[^a-z]/g, "");
      return `${cleanFirst}.${cleanLast}${num}@example.com`;
    }

    case "phone": {
      // 555-01XX range is officially reserved for fictional numbers in North America
      const suffix = String(Math.floor(10 + Math.random() * 90)).padStart(2, "0");
      return `+1-555-01${suffix}`;
    }

    case "age":
      return String(18 + Math.floor(Math.random() * 48)); // 18 - 65

    case "city":
      return CITIES[Math.floor(Math.random() * CITIES.length)];

    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Local fallback answer templates (used when no API key or on LLM failure)
// ---------------------------------------------------------------------------

const LOCAL_FALLBACK_TEMPLATES = {
  short_text: {
    positive: [
      "Very good experience overall.",
      "Exceeded my expectations.",
      "Quick and responsive support.",
      "Highly satisfied with the quality.",
      "Smooth, simple, and straightforward.",
      "Great communication throughout.",
      "Everything worked seamlessly.",
      "Would definitely recommend.",
    ],
    neutral: [
      "Average experience overall.",
      "Met the basic expectations.",
      "Standard service provided.",
      "Nothing particularly notable.",
      "Acceptable but could improve.",
      "Fair value for the effort.",
      "As expected, neither good nor bad.",
      "Moderate satisfaction.",
    ],
    negative: [
      "Did not meet expectations.",
      "Encountered multiple confusing issues.",
      "Slow response times.",
      "Disappointed with the overall quality.",
      "Needs significant improvement.",
      "Frustrating and difficult to navigate.",
      "Lacked clear instructions.",
      "Would not choose this again.",
    ],
  },
  paragraph: {
    positive: [
      "Overall, I had a very positive experience. Everything was delivered on time and the instructions were clear and helpful. I would happily recommend this to colleagues.",
      "The service was intuitive and well organized from start to finish. Any questions I had were answered promptly, making the entire workflow enjoyable.",
      "I was impressed by how smooth the process felt. The quality exceeded my expectations and saved me significant time.",
    ],
    neutral: [
      "My experience was fairly standard. Most aspects worked as advertised, although there are a few minor areas that could use refinement. It serves its core purpose adequately.",
      "The process was reasonable and straightforward enough for basic needs. It did not stand out as exceptional, but it met the minimum requirements.",
      "An average workflow overall. Some parts were smooth while others took slightly longer than expected, but the end result was acceptable.",
    ],
    negative: [
      "I ran into multiple hurdles during the process. The instructions were ambiguous and several unexpected errors occurred along the way. Substantial polish is needed.",
      "Unfortunately, this fell well below my expectations. The user experience felt clunky and resolving basic issues took far more effort than it should have.",
      "The overall experience was frustrating. Communication was lacking and the turnaround time was unacceptable for our team's requirements.",
    ],
  },
};

/**
 * Returns a template fallback answer for a given question type and sentiment.
 */
export function getLocalFallbackAnswer(type, sentiment) {
  const category = type === "paragraph" ? "paragraph" : "short_text";
  const pool = LOCAL_FALLBACK_TEMPLATES[category][sentiment] || LOCAL_FALLBACK_TEMPLATES[category].neutral;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------------------------------------------------------------------------
// Custom Pool Manager (handles non-repeating draws until pool is exhausted)
// ---------------------------------------------------------------------------

export class PoolManager {
  constructor(pools = {}) {
    this.pools = {};
    for (const [name, items] of Object.entries(pools)) {
      if (Array.isArray(items)) {
        this.pools[name] = {
          original: [...items].filter((i) => typeof i === "string" && i.trim().length > 0),
          available: [...items].filter((i) => typeof i === "string" && i.trim().length > 0),
        };
      }
    }
  }

  /**
   * Returns true if the pool exists and has entries.
   */
  hasPool(name) {
    return Boolean(this.pools[name] && this.pools[name].original.length > 0);
  }

  /**
   * Draws a random value from the pool without repeats until exhausted, then resets.
   */
  pick(name) {
    const pool = this.pools[name];
    if (!pool || pool.original.length === 0) return "";

    if (pool.available.length === 0) {
      // Pool exhausted: re-fill from original
      pool.available = [...pool.original];
    }

    const idx = Math.floor(Math.random() * pool.available.length);
    const [chosen] = pool.available.splice(idx, 1);
    return chosen;
  }
}

// ---------------------------------------------------------------------------
// Batched LLM Text Generation
// ---------------------------------------------------------------------------

const jsonArraySchema = z.array(z.string().min(1));

/**
 * Strips markdown code fences and reasoning/<think> blocks from LLM output before parsing JSON.
 */
export function stripMarkdownFences(rawText = "") {
  let text = (rawText || "").trim();
  // 1. Strip <think>...</think> and <thought>...</thought> tags (case-insensitive)
  text = text.replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, "").trim();
  // 2. Strip unclosed <think> or <thought> tag if output was cut off
  text = text.replace(/<(?:think|thought)>[\s\S]*$/gi, "").trim();
  // 3. Strip all markdown code fence backtick markers
  text = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  // 4. Isolate JSON structure between first { or [ and last } or ]
  const jsonStart = text.search(/[\{\[]/);
  const jsonEnd = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd >= jsonStart) {
    text = text.slice(jsonStart, jsonEnd + 1).trim();
  }
  return text;
}

/**
 * Calls LLM provider to generate N varied answers for a given question and sentiment.
 * Enforces cost guards: max 40 answers per call, 15s timeout, privacy guard (only title/helpText).
 *
 * @param {object} params
 * @param {object} params.question - { title, helpText, type }
 * @param {"positive" | "neutral" | "negative"} params.sentiment
 * @param {number} params.count - Number of answers requested (1..40)
 * @param {object} [params.anthropicClient] - Legacy client or mock client for tests
 * @param {object} [params.formContext] - { title, description }
 * @param {string} [params.styleHint] - Optional tone / style guidance
 * @param {Function} [params.generateTextFn] - Optional injected text generator function
 * @returns {Promise<{ answers: string[], usedLLM: boolean, fallbackUsed: boolean }>}
 */
export async function generateBatchedText({
  question,
  sentiment,
  count,
  anthropicClient = undefined,
  formContext = null,
  styleHint = null,
  generateTextFn = undefined,
  formKey = null,
}) {
  const safeCount = Math.max(1, Math.min(40, count)); // Cost guard: max 40 per call
  const isParagraph = question.type === "paragraph";
  const qid = question.id || question.entryId;

  // Explicitly opted out of LLM (e.g. offline testing)
  if (anthropicClient === null || generateTextFn === null || generateTextFn === false) {
    const answers = Array.from({ length: safeCount }, () =>
      getLocalFallbackAnswer(question.type, sentiment)
    );
    return { answers, usedLLM: false, fallbackUsed: true };
  }

  // 1. Consume from answerCache if formKey is provided
  if (formKey && qid) {
    const cachedAnswers = [];
    let next = answerCache.pop(formKey, qid, sentiment);
    while (next && cachedAnswers.length < safeCount) {
      cachedAnswers.push(next);
      if (cachedAnswers.length < safeCount) {
        next = answerCache.pop(formKey, qid, sentiment);
      }
    }

    // Trigger background refill if buffer < 5
    if (answerCache.needsRefill(formKey, qid, sentiment)) {
      refillBuffer({ formKey, question, sentiment, formContext, styleHint }).catch(() => {});
    }

    if (cachedAnswers.length >= safeCount) {
      return {
        answers: cachedAnswers.slice(0, safeCount),
        usedLLM: true,
        fallbackUsed: false,
      };
    }

    // If buffer was empty, await in-flight refill for at most 6s
    if (cachedAnswers.length === 0) {
      const waited = await answerCache.waitForAnswer(formKey, qid, sentiment, 6000);
      if (waited) {
        cachedAnswers.push(waited);
        while (cachedAnswers.length < safeCount) {
          const more = answerCache.pop(formKey, qid, sentiment);
          if (!more) break;
          cachedAnswers.push(more);
        }
      }
    }

    if (cachedAnswers.length >= safeCount) {
      return {
        answers: cachedAnswers.slice(0, safeCount),
        usedLLM: true,
        fallbackUsed: false,
      };
    }

    // If we have some answers from cache, pad with local fallbacks
    if (cachedAnswers.length > 0) {
      while (cachedAnswers.length < safeCount) {
        cachedAnswers.push(getLocalFallbackAnswer(question.type, sentiment));
      }
      return {
        answers: cachedAnswers.slice(0, safeCount),
        usedLLM: true,
        fallbackUsed: true,
      };
    }
  }

  // Resolve generation function
  let generateFn = generateTextFn;
  if (!generateFn && anthropicClient) {
    if (typeof anthropicClient.generateTextFn === "function") {
      generateFn = anthropicClient.generateTextFn;
    } else if (typeof anthropicClient === "function") {
      generateFn = anthropicClient;
    } else if (anthropicClient.messages && typeof anthropicClient.messages.create === "function") {
      // Legacy mock client support
      generateFn = async ({ prompt }) => {
        const resp = await anthropicClient.messages.create({
          messages: [{ role: "user", content: prompt }],
        });
        return resp?.content?.[0]?.text || "[]";
      };
    }
  }

  const isLLMAvailable = !!generateFn || hasLLM;

  // If no LLM available, immediately return local templates
  if (!isLLMAvailable) {
    const answers = Array.from({ length: safeCount }, () =>
      getLocalFallbackAnswer(question.type, sentiment)
    );
    return { answers, usedLLM: false, fallbackUsed: true };
  }

  const lengthInstruction = isParagraph
    ? "Each answer MUST be 1 to 3 natural sentences in length."
    : "Each answer MUST be a short phrase or single sentence under 12 words.";

  const contextTitle = formContext?.title ? formContext.title.trim() : "";
  const contextDesc = formContext?.description
    ? formContext.description.trim().slice(0, 500)
    : "";
  const contextBlock =
    contextTitle || contextDesc
      ? `\nForm topic context:
Title: "${contextTitle}"
${contextDesc ? `Description: "${contextDesc}"` : ""}\n`
      : "";

  const styleHintBlock = styleHint ? `\nStyle hint: ${styleHint}\n` : "";

  const prompt = `You are generating realistic test responses for a public Google Form survey question.
${contextBlock}${styleHintBlock}For feedback, improvement, or suggestion questions: generate specific, concrete ideas directly related to the form's topic, not generic praise or complaints.
Generate a JSON array of exactly ${safeCount} varied, natural, and distinct responses with a **${sentiment}** sentiment.
${lengthInstruction}
Vary the tone, phrasing, perspective, and length between items. Do NOT repeat key phrases or template structures.
Do NOT include numbers or bullet points inside the answer strings.

Question: "${question.title || ""}"
${question.helpText ? `Help text: "${question.helpText}"` : ""}

Respond ONLY with a valid JSON array of strings:
["answer 1", "answer 2", ...]`;

  // Function to call model and parse response
  async function callLLM() {
    const fn = generateFn || generateText;
    const raw = await fn({
      prompt,
      maxTokens: isParagraph ? 1500 : 800,
      temperature: 0.8, // higher temperature for natural variety
      jsonMode: true,
    });

    const cleaned = stripMarkdownFences(raw || "[]");
    const parsed = JSON.parse(cleaned);
    return jsonArraySchema.parse(parsed);
  }

  try {
    let answers;
    try {
      answers = await callLLM();
    } catch (firstErr) {
      console.warn(
        `⚠️ LLM call failed for "${question.title}" (${sentiment}), retrying once:`,
        firstErr.message
      );
      // Retry once on failure
      answers = await callLLM();
    }

    // Ensure we have enough answers; pad with local templates if short
    while (answers.length < safeCount) {
      answers.push(getLocalFallbackAnswer(question.type, sentiment));
    }

    return {
      answers: answers.slice(0, safeCount),
      usedLLM: true,
      fallbackUsed: false,
    };
  } catch (err) {
    console.warn(
      `⚠️ LLM generation failed after retry for "${question.title}", falling back to templates:`,
      err.message
    );
    const answers = Array.from({ length: safeCount }, () =>
      getLocalFallbackAnswer(question.type, sentiment)
    );
    return { answers, usedLLM: false, fallbackUsed: true };
  }
}
