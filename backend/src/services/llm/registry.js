import { geminiAdapter } from "./providers/gemini.js";
import { openaiCompatAdapter } from "./providers/openaiCompat.js";

/**
 * Provider registry:
 * - name: Identifier
 * - envVar: Primary environment variable name
 * - keyPrefix: Key prefix pattern for auto-detection
 * - adapter: Function (options) => Promise<string>
 * - defaultBaseUrl: Base endpoint URL
 * - defaultModel: Default model name (checked against provider documentation on Nov 22, 2026)
 */
export const PROVIDER_REGISTRY = {
  gemini: {
    name: "gemini",
    envVar: "GEMINI_KEY",
    keyPrefix: "AIza",
    adapter: geminiAdapter,
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    // Checked Nov 2026: gemini-3.5-flash-lite is the active free-tier lightweight flash model on Google AI Studio
    defaultModel: "gemini-3.5-flash-lite",
  },
  groq: {
    name: "groq",
    envVar: "GROQ_KEY",
    keyPrefix: "gsk_",
    adapter: openaiCompatAdapter,
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    // Checked Nov 2026: qwen/qwen3.8-27b is the active free-tier high-speed model on GroqCloud
    defaultModel: "qwen/qwen3.8-27b",
  },
  openrouter: {
    name: "openrouter",
    envVar: "OPENROUTER_KEY",
    keyPrefix: "sk-or-",
    adapter: openaiCompatAdapter,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    // Checked Nov 2026: openrouter/free is the official free-tier meta-router model on OpenRouter
    defaultModel: "openrouter/free",
  },
};

/**
 * Masks API key for safe logging (e.g. "AIza…1234").
 * Never logs or reveals the raw key.
 */
export function maskKey(key) {
  if (!key || typeof key !== "string") return "****";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "****";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/**
 * Detects provider name from key prefix.
 */
export function detectProviderByKey(key) {
  if (!key || typeof key !== "string") return null;
  const trimmed = key.trim();
  if (trimmed.startsWith("AIza")) return "gemini";
  if (trimmed.startsWith("gsk_")) return "groq";
  if (trimmed.startsWith("sk-or-")) return "openrouter";
  return null;
}

