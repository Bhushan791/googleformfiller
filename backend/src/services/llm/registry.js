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
  groq: {
    name: "groq",
    envVar: "GROQ_KEY",
    keyPrefix: "gsk_",
    adapter: openaiCompatAdapter,
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    // Checked Nov 22, 2026: qwen/qwen3.8-27b is the active free-tier high-speed model on GroqCloud
    defaultModel: "qwen/qwen3.8-27b",
  },
  openrouter: {
    name: "openrouter",
    envVar: "OPENROUTER_KEY",
    keyPrefix: "sk-or-",
    adapter: openaiCompatAdapter,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    // Checked Nov 22, 2026: baidu/ernie-5.5-flash-preview:free is an active zero-cost model with :free suffix on OpenRouter
    defaultModel: "baidu/ernie-5.5-flash-preview:free",
  },
};

/**
 * Masks API key for safe logging (e.g. "gsk_…1234").
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
  if (trimmed.startsWith("gsk_")) return "groq";
  if (trimmed.startsWith("sk-or-")) return "openrouter";
  return null;
}
