import dotenv from "dotenv";
import { z } from "zod";

// Load .env file before validation
dotenv.config();

/**
 * Schema for required / optional environment variables.
 * Fails fast with a human-readable message when a required var is missing.
 */
const envSchema = z.object({
  PORT: z
    .string()
    .default("5000")
    .transform(Number)
    .refine((n) => n > 0 && n < 65536, "PORT must be between 1 and 65535"),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  FRONTEND_URL: z
    .string()
    .min(1, "FRONTEND_URL is required (comma-separated origins)"),

  // Provider-agnostic LLM configuration
  GROQ_KEY: z.string().optional(),
  OPENROUTER_KEY: z.string().optional(),
  LLM_API_KEYS: z.string().optional(),
  LLM_PRIORITY: z.string().default("groq,openrouter"),
  LLM_MODEL_GROQ: z.string().optional(),
  LLM_MODEL_OPENROUTER: z.string().optional(),
  LLM_BASE_URL: z.string().optional(),

  // Optional for now — will be needed for caching / queues
  REDIS_URL: z.string().optional(),
});

/** Validate and freeze the config so nothing can mutate it at runtime. */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌  Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1);
}

const config = Object.freeze(parsed.data);
export default config;
