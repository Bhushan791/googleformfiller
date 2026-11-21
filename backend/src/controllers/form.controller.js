import { z } from "zod";
import asyncHandler from "../utils/asyncHandler.js";
import { parseGoogleForm } from "../services/formParser.js";
import {
  generateResponses,
  generatorSettingsSchema,
} from "../services/responseGenerator.js";

/** Request body schema for POST /api/parse-form */
const parseFormSchema = z.object({
  url: z.string().min(1, "URL is required").url("Must be a valid URL"),
});

/**
 * POST /api/parse-form
 * Fetches a public Google Form, parses it, and returns structured question data.
 */
export const parseForm = asyncHandler(async (req, res) => {
  const { url } = parseFormSchema.parse(req.body);
  const data = await parseGoogleForm(url);
  res.json({ success: true, data });
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
});

/**
 * POST /api/preview
 * Generates 5 sample responses for preview / dry run without submitting.
 */
export const previewResponses = asyncHandler(async (req, res) => {
  const { questions, settings, formContext } = previewSchema.parse(req.body);

  const data = await generateResponses({
    questions,
    count: 5, // always 5 sample responses for preview
    settings: {
      ...settings,
      count: 5,
    },
    formContext,
  });

  res.json({ success: true, data });
});
