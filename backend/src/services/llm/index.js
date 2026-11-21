import AppError from "../../utils/AppError.js";
import {
  PROVIDER_REGISTRY,
  maskKey,
  detectProviderByKey,
} from "./registry.js";
import { ConcurrencyLimiter } from "./limiter.js";

const concurrencyLimiter = new ConcurrencyLimiter(2);
const providerCooldowns = new Map(); // providerKey -> cooldownUntilMs

let cachedStatus = {
  enabled: false,
  lastTestedAt: 0,
  providers: [],
};

let lastRefreshAttempt = 0;
const REFRESH_RATE_LIMIT_MS = 10_000; // minimum 10s between status refreshes

/**
 * Resolves list of configured providers based on environment variables.
 * Never logs raw API keys.
 */
export function getConfiguredProviders(envOverrides = null) {
  const env = envOverrides || process.env;
  const configured = [];
  const addedKeys = new Set();

  const priorityOrder = (env.LLM_PRIORITY || "gemini,groq")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  // 1. Process providers listed in LLM_PRIORITY
  for (const name of priorityOrder) {
    const reg = PROVIDER_REGISTRY[name];
    if (!reg) continue;

    const key = env[reg.envVar];
    if (key && key.trim() !== "") {
      const trimmedKey = key.trim();
      const model =
        (name === "gemini" && env.LLM_MODEL_GEMINI) ||
        (name === "groq" && env.LLM_MODEL_GROQ) ||
        reg.defaultModel;

      const baseUrl =
        (name !== "gemini" && env.LLM_BASE_URL) || reg.defaultBaseUrl;

      configured.push({
        id: `${name}:${maskKey(trimmedKey)}`,
        name,
        key: trimmedKey,
        maskedKey: maskKey(trimmedKey),
        model,
        baseUrl,
        adapter: reg.adapter,
      });
      addedKeys.add(trimmedKey);
    }
  }

  // 2. Process any additional keys from LLM_API_KEYS (comma-separated, auto-detected)
  if (env.LLM_API_KEYS) {
    const extraKeys = env.LLM_API_KEYS.split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0 && !addedKeys.has(k));

    for (const key of extraKeys) {
      const detectedName = detectProviderByKey(key);
      const reg = detectedName ? PROVIDER_REGISTRY[detectedName] : null;
      if (reg) {
        const model =
          (detectedName === "gemini" && env.LLM_MODEL_GEMINI) ||
          (detectedName === "groq" && env.LLM_MODEL_GROQ) ||
          reg.defaultModel;

        const baseUrl =
          (detectedName !== "gemini" && env.LLM_BASE_URL) || reg.defaultBaseUrl;

        configured.push({
          id: `${detectedName}:${maskKey(key)}`,
          name: detectedName,
          key,
          maskedKey: maskKey(key),
          model,
          baseUrl,
          adapter: reg.adapter,
        });
        addedKeys.add(key);
      }
    }
  }

  // 3. Check any standard registry keys not included in priority list
  for (const [name, reg] of Object.entries(PROVIDER_REGISTRY)) {
    const key = env[reg.envVar];
    if (key && key.trim() !== "" && !addedKeys.has(key.trim())) {
      const trimmedKey = key.trim();
      const model =
        (name === "gemini" && env.LLM_MODEL_GEMINI) ||
        (name === "groq" && env.LLM_MODEL_GROQ) ||
        reg.defaultModel;

      const baseUrl =
        (name !== "gemini" && env.LLM_BASE_URL) || reg.defaultBaseUrl;

      configured.push({
        id: `${name}:${maskKey(trimmedKey)}`,
        name,
        key: trimmedKey,
        maskedKey: maskKey(trimmedKey),
        model,
        baseUrl,
        adapter: reg.adapter,
      });
      addedKeys.add(trimmedKey);
    }
  }

  return configured;
}

/**
 * Indicates if at least one LLM provider is configured.
 */
export const hasLLM = {
  valueOf() {
    return getConfiguredProviders().length > 0;
  },
  [Symbol.toPrimitive]() {
    return getConfiguredProviders().length > 0;
  },
};

Object.defineProperty(hasLLM, "value", {
  get() {
    return getConfiguredProviders().length > 0;
  },
});

/**
 * Dispatches prompt to the first available provider in the chain.
 * Falls back to subsequent providers on 429, 5xx, timeout, or network error.
 * Applies a 60s cooldown on any provider that returns 429.
 */
export async function generateText({
  prompt,
  maxTokens = 1000,
  temperature = 0.7,
  jsonMode = false,
  fetchFn = fetch,
  envOverrides = null,
}) {
  return concurrencyLimiter.run(async () => {
    const providers = getConfiguredProviders(envOverrides);
    if (providers.length === 0) {
      throw new AppError("No LLM provider configured.", 503, "LLM_UNAVAILABLE");
    }

    const now = Date.now();
    let lastError = null;

    for (const provider of providers) {
      // Check 60s cooldown
      const cooldownUntil = providerCooldowns.get(provider.id) || 0;
      if (cooldownUntil > now) {
        continue;
      }

      try {
        const text = await provider.adapter({
          prompt,
          maxTokens,
          temperature,
          jsonMode,
          apiKey: provider.key,
          model: provider.model,
          baseUrl: provider.baseUrl,
          signal: AbortSignal.timeout(15_000), // 15s timeout
          fetchFn,
        });

        return text;
      } catch (err) {
        lastError = err;
        const status = err.status || (err.name === "TimeoutError" ? 504 : 500);

        // Cooldown 60s on 429
        if (status === 429) {
          providerCooldowns.set(provider.id, Date.now() + 60_000);
          console.warn(
            `⚠️ [LLM] Provider "${provider.name}" (${provider.maskedKey}) rate limited (429). 60s cooldown applied.`
          );
        } else {
          console.warn(
            `⚠️ [LLM] Provider "${provider.name}" call failed: ${err.message}`
          );
        }
        // Fall through to next provider in the chain
      }
    }

    // All configured providers failed or are in cooldown
    const failureMsg = lastError
      ? `All LLM providers unavailable (last error: ${lastError.message})`
      : "All LLM providers are currently in cooldown or unavailable.";

    throw new AppError(failureMsg, 503, "LLM_UNAVAILABLE");
  });
}

/**
 * Runs startup self-test (one tiny test call per provider).
 * Never blocks startup or crashes on failure.
 */
export async function runStartupTest({
  fetchFn = fetch,
  envOverrides = null,
  silent = false,
} = {}) {
  const providers = getConfiguredProviders(envOverrides);
  const results = [];

  for (const p of providers) {
    const start = Date.now();
    try {
      await p.adapter({
        prompt: "Reply with the word OK",
        maxTokens: 10,
        temperature: 0.1,
        apiKey: p.key,
        model: p.model,
        baseUrl: p.baseUrl,
        signal: AbortSignal.timeout(15_000),
        fetchFn,
      });

      const latency = Date.now() - start;
      results.push({
        provider: p.name,
        model: p.model,
        status: "OK",
        latencyMs: latency,
      });

      if (!silent) {
        console.log(`[LLM] ${p.name} (${p.model}): OK (${latency}ms)`);
      }
    } catch (err) {
      const reason = err.message || "Failed";
      results.push({
        provider: p.name,
        model: p.model,
        status: "FAILED",
        reason,
        latencyMs: null,
      });

      if (!silent) {
        console.warn(`[LLM] ${p.name} (${p.model}): FAILED - ${reason}`);
      }
    }
  }

  const hasWorking = results.some((r) => r.status === "OK");
  cachedStatus = {
    enabled: hasWorking,
    lastTestedAt: Date.now(),
    providers: results,
  };

  return cachedStatus;
}

/**
 * Returns current LLM status without leaking API keys.
 * ?refresh=1 triggers a rate-limited re-test.
 */
export async function getLLMStatus({
  refresh = false,
  fetchFn = fetch,
  envOverrides = null,
} = {}) {
  const providers = getConfiguredProviders(envOverrides);
  if (providers.length === 0) {
    return {
      enabled: false,
      providers: [],
    };
  }

  const now = Date.now();
  if (refresh && now - lastRefreshAttempt >= REFRESH_RATE_LIMIT_MS) {
    lastRefreshAttempt = now;
    await runStartupTest({ fetchFn, envOverrides, silent: true });
  }

  return {
    enabled: cachedStatus.enabled,
    providers: cachedStatus.providers.map((p) => ({
      provider: p.provider,
      model: p.model,
      status: p.status,
      latencyMs: p.latencyMs,
      ...(p.reason ? { reason: p.reason } : {}),
    })),
  };
}

export {
  PROVIDER_REGISTRY,
  maskKey,
  concurrencyLimiter,
  providerCooldowns,
};

