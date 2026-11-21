import { z } from "zod";
import config from "../config/env.js";
import { generateText, hasLLM } from "./llm/index.js";
import { stripMarkdownFences } from "./textGenerator.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const sentimentMixSchema = z
  .object({
    positive: z.number().int().min(0).max(100),
    neutral: z.number().int().min(0).max(100),
    negative: z.number().int().min(0).max(100),
  })
  .refine(
    (m) => m.positive + m.neutral + m.negative === 100,
    "Sentiment mix percentages must sum to 100"
  );

export const questionOverrideSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("fixed"),
    value: z.any(),
  }),
  z.object({
    mode: z.literal("mix"),
    mix: sentimentMixSchema,
  }),
  z.object({
    mode: z.literal("pool"),
    poolName: z.string().min(1),
  }),
  z.object({
    mode: z.literal("random"),
  }),
]);

// ---------------------------------------------------------------------------
// In-memory options classification cache (max 500 entries)
// ---------------------------------------------------------------------------
const CLASSIFICATION_CACHE = new Map();
const MAX_CACHE_SIZE = 500;

function getCacheKey(question) {
  const title = (question.title || "").trim();
  const options = (question.options || []).join("|||");
  return `${title}:::${options}`;
}

function setCache(key, value) {
  if (CLASSIFICATION_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = CLASSIFICATION_CACHE.keys().next().value;
    if (oldestKey) CLASSIFICATION_CACHE.delete(oldestKey);
  }
  CLASSIFICATION_CACHE.set(key, value);
}

// ---------------------------------------------------------------------------
// Weighted random sentiment picker
// ---------------------------------------------------------------------------

/**
 * Draws a sentiment ("positive" | "neutral" | "negative") based on the weighted mix.
 * @param {{ positive: number, neutral: number, negative: number }} mix
 * @returns {"positive" | "neutral" | "negative"}
 */
export function pickSentiment(mix) {
  const rand = Math.random() * 100;
  if (rand < mix.positive) {
    return "positive";
  }
  if (rand < mix.positive + mix.neutral) {
    return "neutral";
  }
  return "negative";
}

// ---------------------------------------------------------------------------
// Option classification (ONE LLM call per choice question, cached)
// ---------------------------------------------------------------------------

const classificationResponseSchema = z.record(
  z.enum(["positive", "neutral", "negative", "n/a"])
);

/**
 * Classifies each option of a question as positive, neutral, negative, or n/a.
 * Cached by hash/key of question title + options.
 *
 * @param {object} question - { title, helpText, options }
 * @param {object} [optionsOrClient] - Options { formContext, styleHint, generateTextFn } or legacy mock
 * @returns {Promise<Record<string, "positive" | "neutral" | "negative" | "n/a">>}
 */
export async function classifyOptions(question, optionsOrClient) {
  const options = question.options || [];
  if (options.length === 0) return {};

  const cacheKey = getCacheKey(question);
  if (CLASSIFICATION_CACHE.has(cacheKey)) {
    return CLASSIFICATION_CACHE.get(cacheKey);
  }

  if (optionsOrClient === null || optionsOrClient?.generateTextFn === null || optionsOrClient?.generateTextFn === false) {
    const fallback = {};
    for (const opt of options) fallback[opt] = "n/a";
    setCache(cacheKey, fallback);
    return fallback;
  }

  // Parse options / legacy client
  let generateFn = null;
  let formContext = null;
  let styleHint = null;

  if (optionsOrClient) {
    if (typeof optionsOrClient.generateTextFn === "function") {
      generateFn = optionsOrClient.generateTextFn;
    } else if (typeof optionsOrClient === "function") {
      generateFn = optionsOrClient;
    } else if (optionsOrClient.messages && typeof optionsOrClient.messages.create === "function") {
      // Legacy mock client support for backwards compatibility
      generateFn = async ({ prompt }) => {
        const resp = await optionsOrClient.messages.create({
          messages: [{ role: "user", content: prompt }],
        });
        return resp?.content?.[0]?.text || "{}";
      };
    }
    formContext = optionsOrClient.formContext || null;
    styleHint = optionsOrClient.styleHint || null;
  }

  const isLLMAvailable = generateFn || hasLLM.valueOf();

  // Without LLM, label everything as "n/a" so uniform random is used
  if (!isLLMAvailable) {
    const fallback = {};
    for (const opt of options) fallback[opt] = "n/a";
    setCache(cacheKey, fallback);
    return fallback;
  }

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

  const prompt = `Classify each option for the survey question below into one of four sentiment categories: "positive", "neutral", "negative", or "n/a".
Use "n/a" if the option is factual, demographic, numerical, or does not convey an attitude/sentiment (e.g. city names, departments, job titles, colors, "Other").
${contextBlock}${styleHintBlock}
Question: "${question.title || ""}"
${question.helpText ? `Help text: "${question.helpText}"` : ""}
Options:
${options.map((opt, i) => `${i + 1}. ${opt}`).join("\n")}

Respond ONLY with a valid JSON object mapping each option string exactly to its category:
{ "option1": "positive|neutral|negative|n/a", ... }`;

  const doCall = async () => {
    const fn = generateFn || generateText;
    return await fn({
      prompt,
      maxTokens: 500,
      temperature: 0.1,
      jsonMode: true,
    });
  };

  try {
    let text;
    try {
      text = await doCall();
    } catch (firstErr) {
      console.warn(
        `⚠️ Option classification failed for "${question.title}", retrying once:`,
        firstErr.message
      );
      text = await doCall();
    }

    // Strip markdown code fences if present
    const cleaned = stripMarkdownFences(text || "{}");
    const parsed = JSON.parse(cleaned);
    const validated = classificationResponseSchema.parse(parsed);

    // Ensure all original options exist in the mapping
    const result = {};
    for (const opt of options) {
      result[opt] = validated[opt] || "n/a";
    }

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(
      `⚠️ Option classification failed for "${question.title}":`,
      err.message
    );
    const fallback = {};
    for (const opt of options) fallback[opt] = "n/a";
    setCache(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Picks an option matching the chosen sentiment.
 * Falls back to uniform random if all are n/a or no matching options exist.
 */
export function pickChoiceOption(question, sentiment, classification = {}) {
  const options = question.options || [];
  if (options.length === 0) return "";

  const allNa = options.every(
    (opt) => !classification[opt] || classification[opt] === "n/a"
  );
  if (allNa) {
    return options[Math.floor(Math.random() * options.length)];
  }

  // Try exact sentiment match
  const matching = options.filter(
    (opt) => classification[opt] === sentiment
  );
  if (matching.length > 0) {
    return matching[Math.floor(Math.random() * matching.length)];
  }

  // Fallback to neutral or n/a options before arbitrary fallback
  const neutralOrNa = options.filter(
    (opt) => classification[opt] === "neutral" || classification[opt] === "n/a"
  );
  if (neutralOrNa.length > 0) {
    return neutralOrNa[Math.floor(Math.random() * neutralOrNa.length)];
  }

  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Picks 1 to N checkbox options, prioritizing the chosen sentiment.
 */
export function pickCheckboxOptions(
  question,
  sentiment,
  classification = {},
  maxOptions = 3
) {
  const options = question.options || [];
  if (options.length === 0) return [];

  const limit = Math.max(1, maxOptions);
  const countToPick = Math.max(
    1,
    Math.min(limit, 1 + Math.floor(Math.random() * Math.min(options.length, limit)))
  );

  const matching = options.filter(
    (opt) => classification[opt] === sentiment
  );
  const neutralOrNa = options.filter(
    (opt) => !classification[opt] || classification[opt] === "neutral" || classification[opt] === "n/a"
  );

  // Pool candidates prioritizing matching sentiment
  const candidates = matching.length > 0 ? [...matching, ...neutralOrNa] : [...options];
  const shuffled = [...new Set(candidates)].sort(() => 0.5 - Math.random());

  // Fill up to countToPick if candidates were short
  if (shuffled.length < countToPick) {
    for (const opt of options) {
      if (!shuffled.includes(opt)) shuffled.push(opt);
    }
  }

  return shuffled.slice(0, countToPick);
}

// ---------------------------------------------------------------------------
// Linear Scale
// ---------------------------------------------------------------------------

const POSITIVE_SCALE_KEYWORDS = ["excellent", "best", "great", "high", "good", "satisfied", "agree", "love", "awesome", "perfect"];
const NEGATIVE_SCALE_KEYWORDS = ["terrible", "worst", "poor", "low", "bad", "dissatisfied", "disagree", "hate", "unacceptable"];

/**
 * Detects whether scale labels suggest a reversed scale (e.g. 1 = "Excellent", 5 = "Terrible").
 */
export function isScaleReversed(scaleRange) {
  if (!scaleRange) return false;
  const minLabel = (scaleRange.minLabel || "").toLowerCase();
  const maxLabel = (scaleRange.maxLabel || "").toLowerCase();

  const minIsPositive = POSITIVE_SCALE_KEYWORDS.some((kw) => minLabel.includes(kw));
  const maxIsNegative = NEGATIVE_SCALE_KEYWORDS.some((kw) => maxLabel.includes(kw));

  return minIsPositive || maxIsNegative;
}

/**
 * Derives the bands (bottom third = negative, middle = neutral, top = positive)
 * and picks a value matching the chosen sentiment.
 */
export function pickLinearScaleValue(scaleRange, sentiment) {
  const min = scaleRange?.min ?? 1;
  const max = scaleRange?.max ?? 5;

  // Generate all discrete integer steps in the scale range
  const allValues = [];
  for (let i = min; i <= max; i++) {
    allValues.push(i);
  }

  if (allValues.length === 0) return min;
  if (allValues.length === 1) return allValues[0];

  // Divide into three bands: bottom, middle, top
  const n = allValues.length;
  const band1End = Math.max(1, Math.round(n / 3));
  const band2End = Math.max(band1End + 1, Math.round((2 * n) / 3));

  const bottomThird = allValues.slice(0, band1End);
  const middleThird = allValues.slice(band1End, band2End);
  const topThird = allValues.slice(band2End);

  // If topThird ended up empty due to rounding on tiny ranges, adjust
  if (topThird.length === 0 && middleThird.length > 1) {
    topThird.push(middleThird.pop());
  }

  // Check reversed meaning
  const reversed = isScaleReversed(scaleRange);

  let targetBand;
  if (sentiment === "positive") {
    targetBand = reversed ? bottomThird : topThird;
  } else if (sentiment === "negative") {
    targetBand = reversed ? topThird : bottomThird;
  } else {
    targetBand = middleThird.length > 0 ? middleThird : allValues;
  }

  if (!targetBand || targetBand.length === 0) {
    targetBand = allValues;
  }

  const picked = targetBand[Math.floor(Math.random() * targetBand.length)];
  return String(picked);
}

// ---------------------------------------------------------------------------
// Date & Time
// ---------------------------------------------------------------------------

/**
 * Generates a random date within the last N days (default 30).
 * Google Forms expects dates in "YYYY-MM-DD" format.
 */
export function generateDate(daysAgo = 30) {
  const msAgo = Math.floor(Math.random() * Math.max(1, daysAgo) * 24 * 60 * 60 * 1000);
  const date = new Date(Date.now() - msAgo);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generates a random time between startHour and endHour (default 09:00 - 18:00).
 * Google Forms expects times in "HH:MM" 24-hour format.
 */
export function generateTime(startHour = 9, endHour = 18) {
  const minH = Math.max(0, Math.min(23, startHour));
  const maxH = Math.max(minH, Math.min(23, endHour));
  const hour = minH + Math.floor(Math.random() * (maxH - minH + 1));
  const minute = Math.floor(Math.random() * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

