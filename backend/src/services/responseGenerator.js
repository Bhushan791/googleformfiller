import { z } from "zod";
import {
  sentimentMixSchema,
  questionOverrideSchema,
  pickSentiment,
  classifyOptions,
  pickChoiceOption,
  pickCheckboxOptions,
  pickLinearScaleValue,
  generateDate,
  generateTime,
} from "./sentimentEngine.js";
import {
  detectObviousFieldType,
  generateObviousFieldValue,
  PoolManager,
  generateBatchedText,
} from "./textGenerator.js";
import { hasLLM } from "./llm/index.js";

// ---------------------------------------------------------------------------
// Validation schema for generator settings
// ---------------------------------------------------------------------------

export const generatorSettingsSchema = z.object({
  audienceMode: z
    .enum(["auto", "prelaunch", "launched", "event", "research", "custom"])
    .default("auto"),
  scenario: z.string().max(400).optional().default(""),
  mix: sentimentMixSchema.default({ positive: 70, neutral: 20, negative: 10 }),
  count: z.number().int().min(1).max(500).default(5),
  perQuestion: z.record(questionOverrideSchema).default({}),
  pools: z.record(z.array(z.string())).default({}),
  optionalSkipRate: z.number().min(0).max(1).default(0.1),
  checkboxMax: z.number().int().min(1).max(10).default(3),
  dateRange: z
    .object({
      daysAgo: z.number().int().min(1).max(3650).default(30),
    })
    .default({ daysAgo: 30 }),
  timeRange: z
    .object({
      startHour: z.number().int().min(0).max(23).default(9),
      endHour: z.number().int().min(0).max(23).default(18),
    })
    .default({ startHour: 9, endHour: 18 }),
});

// ---------------------------------------------------------------------------
// Response Generator
// ---------------------------------------------------------------------------

/**
 * Generates an array of realistic test responses for parsed Google Form questions.
 *
 * @param {object} params
 * @param {Array<object>} params.questions - Parsed questions from formParser
 * @param {number} [params.count] - Number of responses to generate (default 5 for preview)
 * @param {object} [params.settings] - Custom generation settings
 * @param {object} [params.anthropicClient] - Optional injected Anthropic client (for tests)
 * @returns {Promise<{ responses: Array<object>, metadata: object }>}
 */
export async function generateResponses({
  questions = [],
  count = 5,
  settings: rawSettings = {},
  anthropicClient = undefined,
  formContext = null,
  generateTextFn = undefined,
  formKey = null,
}) {
  const explicitNoLLM = anthropicClient === null || generateTextFn === null;
  const settings = generatorSettingsSchema.parse({
    ...rawSettings,
    count: rawSettings.count ?? count,
  });

  const poolManager = new PoolManager(settings.pools);
  const metadata = {
    usedLLM: false,
    fallbackUsed: false,
    warnings: [],
  };

  const validQuestions = questions.filter((q) => q && q.entryId);
  if (validQuestions.length === 0) {
    return { responses: [], metadata };
  }

  // 1. Pre-plan overall sentiment for each response
  const responseSentiments = Array.from({ length: settings.count }, () =>
    pickSentiment(settings.mix)
  );

  // 2. Classify options for choice questions (ONE cached LLM call per question)
  const optionClassifications = {};
  for (const q of validQuestions) {
    if (["multiple_choice", "dropdown", "checkboxes"].includes(q.type)) {
      try {
        optionClassifications[q.id || q.entryId] = await classifyOptions(
          q,
          explicitNoLLM
            ? null
            : (anthropicClient || { formContext, generateTextFn, formKey })
        );
      } catch (err) {
        metadata.warnings.push(
          `Failed to classify options for "${q.title}": ${err.message}`
        );
      }
    }
  }

  // 3. Pre-generate text for short_text & paragraph questions
  //    Identify how many answers of each sentiment are needed per question.
  const preGeneratedText = {}; // key: `${q.id}:::${sentiment}` -> array of strings

  for (const q of validQuestions) {
    if (!["short_text", "paragraph"].includes(q.type)) continue;

    const override =
      settings.perQuestion[q.id] || settings.perQuestion[q.entryId];

    // If overridden with fixed value or pool, no LLM needed
    if (override?.mode === "fixed" || override?.mode === "pool") continue;

    // If obvious field type (name, email, phone, age, city) and no override, local fake data is used
    const obviousType = detectObviousFieldType(q.title);
    if (obviousType && !override) continue;

    // Count how many answers of each sentiment are needed for this question
    const neededCounts = { positive: 0, neutral: 0, negative: 0 };
    for (let i = 0; i < settings.count; i++) {
      let sent = responseSentiments[i];
      if (override?.mode === "mix") {
        sent = pickSentiment(override.mix);
      } else if (override?.mode === "random") {
        sent = ["positive", "neutral", "negative"][Math.floor(Math.random() * 3)];
      }
      neededCounts[sent]++;
    }

    // Call batched LLM for each needed sentiment
    for (const [sent, needed] of Object.entries(neededCounts)) {
      if (needed <= 0) continue;

      const cacheKey = `${q.id || q.entryId}:::${sent}`;
      preGeneratedText[cacheKey] = [];

      // Generate in chunks of up to 40 (cost guard)
      let remaining = needed;
      while (remaining > 0) {
        const batchSize = Math.min(40, remaining);
        const { answers, usedLLM, fallbackUsed } = await generateBatchedText({
          question: q,
          sentiment: sent,
          count: batchSize,
          anthropicClient: explicitNoLLM ? null : anthropicClient,
          formContext,
          styleHint: settings?.styleHint,
          generateTextFn: explicitNoLLM ? null : generateTextFn,
          formKey,
          settings,
        });

        if (usedLLM) metadata.usedLLM = true;
        if (fallbackUsed) metadata.fallbackUsed = true;

        preGeneratedText[cacheKey].push(...answers);
        remaining -= batchSize;
      }
    }
  }

  // If no LLM was used for any text question and no API key exists, note fallback
  if ((explicitNoLLM || !hasLLM.valueOf()) && !metadata.usedLLM) {
    metadata.fallbackUsed = true;
  }

  // 4. Assemble each response object
  const responses = [];

  for (let i = 0; i < settings.count; i++) {
    const overallSentiment = responseSentiments[i];
    const answers = {};

    for (const q of validQuestions) {
      const qKey = q.id || q.entryId;
      const override = settings.perQuestion[q.id] || settings.perQuestion[q.entryId];

      // Handle optional questions skip rate
      if (!q.required && Math.random() < settings.optionalSkipRate) {
        // Skip this optional question
        continue;
      }

      // Determine effective sentiment for this question
      let effectiveSentiment = overallSentiment;
      if (override?.mode === "mix") {
        effectiveSentiment = pickSentiment(override.mix);
      } else if (override?.mode === "random") {
        effectiveSentiment = ["positive", "neutral", "negative"][Math.floor(Math.random() * 3)];
      }

      // ── Fixed override ──
      if (override?.mode === "fixed") {
        answers[q.entryId] = override.value;
        continue;
      }

      // ── Pool override ──
      if (override?.mode === "pool" && override.poolName) {
        answers[q.entryId] = poolManager.pick(override.poolName);
        continue;
      }

      // ── Type-specific generation ──
      switch (q.type) {
        case "short_text":
        case "paragraph": {
          const obvious = detectObviousFieldType(q.title);
          if (obvious && !override) {
            answers[q.entryId] = generateObviousFieldValue(obvious);
          } else {
            const cacheKey = `${qKey}:::${effectiveSentiment}`;
            const pool = preGeneratedText[cacheKey];
            if (pool && pool.length > 0) {
              answers[q.entryId] = pool.shift();
            } else {
              // Fallback template
              answers[q.entryId] = getLocalFallbackAnswer(q.type, effectiveSentiment);
            }
          }
          break;
        }

        case "multiple_choice":
        case "dropdown": {
          const classification = optionClassifications[qKey] || {};
          answers[q.entryId] = pickChoiceOption(
            q,
            effectiveSentiment,
            classification
          );
          break;
        }

        case "checkboxes": {
          const classification = optionClassifications[qKey] || {};
          answers[q.entryId] = pickCheckboxOptions(
            q,
            effectiveSentiment,
            classification,
            settings.checkboxMax
          );
          break;
        }

        case "linear_scale": {
          answers[q.entryId] = pickLinearScaleValue(
            q.scaleRange,
            effectiveSentiment
          );
          break;
        }

        case "date": {
          answers[q.entryId] = generateDate(settings.dateRange?.daysAgo ?? 30);
          break;
        }

        case "time": {
          answers[q.entryId] = generateTime(
            settings.timeRange?.startHour ?? 9,
            settings.timeRange?.endHour ?? 18
          );
          break;
        }

        default: {
          // Unknown or unhandled type
          answers[q.entryId] = "";
          break;
        }
      }
    }

    responses.push({
      index: i,
      sentiment: overallSentiment,
      answers,
    });
  }

  return { responses, metadata };
}

