import { z } from "zod";
import asyncHandler from "../utils/asyncHandler.js";
import { parseGoogleForm } from "../services/formParser.js";
import {
  generateResponses,
  generatorSettingsSchema,
} from "../services/responseGenerator.js";
import answerCache from "../services/answerCache.js";
import { prewarmForm, populateHardcodedFallback } from "../services/prewarm.js";
import { hasLLM } from "../services/llm/index.js";

/** Request body schema for POST /api/parse-form */
const parseFormSchema = z.object({
  url: z.string().min(1, "URL is required").url("Must be a valid URL"),
  settings: generatorSettingsSchema.optional().default({}),
});

/**
 * POST /api/parse-form
 * Fetches a public Google Form, parses it, and returns structured question data.
 * Starts background prewarm of AI answers and classifications.
 */
export const parseForm = asyncHandler(async (req, res) => {
  const { url, settings } = parseFormSchema.parse(req.body);
  const data = await parseGoogleForm(url);

  // Compute deterministic formKey including audience settings
  const formKey = answerCache.computeFormKey(data.formId || url, data.questions, settings);
  data.formKey = formKey;

  // Background prewarm (fire and forget)
  if (hasLLM) {
    prewarmForm({
      formKey,
      questions: data.questions,
      formContext: {
        title: data.title,
        description: data.description,
      },
      settings,
    }).catch((err) => {
      console.warn("⚠️ Background prewarm failed to start:", err.message);
    });
  } else {
    answerCache.init(formKey, { totalAiQuestions: 0, usedLLM: false });
    populateHardcodedFallback(formKey, data.questions, settings);
  }

  res.json({ success: true, data });
});

const triggerPrewarmSchema = z.object({
  formKey: z.string().optional(),
  url: z.string().optional(),
  formId: z.string().optional(),
  questions: z.array(z.any()).default([]),
  formContext: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  settings: generatorSettingsSchema.optional().default({}),
});

/**
 * POST /api/prewarm
 * Explicitly triggers prewarm for an existing form when settings (like audienceMode) change.
 */
export const triggerPrewarm = asyncHandler(async (req, res) => {
  const { formKey: providedKey, url, formId, questions, formContext, settings } =
    triggerPrewarmSchema.parse(req.body);

  const formKey =
    providedKey ||
    answerCache.computeFormKey(formId || url || "form", questions, settings);

  if (hasLLM) {
    prewarmForm({
      formKey,
      questions,
      formContext,
      settings,
    }).catch((err) => {
      console.warn("⚠️ Prewarm trigger failed:", err.message);
    });
  } else {
    answerCache.init(formKey, { totalAiQuestions: 0, usedLLM: false });
    populateHardcodedFallback(formKey, data.questions, settings);
  }

  res.json({ success: true, data: { formKey } });
});

/**
 * GET /api/prewarm/:formKey
 * Returns status of prewarmed answers (cheap, no LLM call).
 */
export const getPrewarmStatus = asyncHandler(async (req, res) => {
  const { formKey } = req.params;
  const statusInfo = answerCache.getStatusInfo(formKey);
  res.json({ success: true, data: statusInfo });
});

/** Request body schema for POST /api/preview */
const previewSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.any().optional(),
        entryId: z.string().min(1, "entryId is required"),
        title: z.string().default(""),
        helpText: z.string().optional().default(""),
        type: z.string(),
        required: z.boolean().default(false),
        options: z.array(z.string()).optional().default([]),
        scaleRange: z
          .object({
            min: z.number(),
            max: z.number(),
            minLabel: z.string().optional().default(""),
            maxLabel: z.string().optional().default(""),
          })
          .nullable()
          .optional(),
      })
    )
    .min(1, "At least one question is required"),
  settings: generatorSettingsSchema.optional().default({}),
  formContext: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  formKey: z.string().optional(),
});

/**
 * POST /api/preview
 * Generates 5 sample responses for preview / dry run without submitting.
 */
export const previewResponses = asyncHandler(async (req, res) => {
  const { questions, settings, formContext, formKey } = previewSchema.parse(req.body);

  const data = await generateResponses({
    questions,
    count: 5, // always 5 sample responses for preview
    settings: {
      ...settings,
      count: 5,
    },
    formContext,
    formKey,
  });

  res.json({ success: true, data });
});
