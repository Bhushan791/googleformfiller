import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getConfiguredProviders,
  generateText,
  runStartupTest,
  getLLMStatus,
  hasLLM,
  providerCooldowns,
} from "./services/llm/index.js";
import { maskKey, detectProviderByKey } from "./services/llm/registry.js";
import { ConcurrencyLimiter } from "./services/llm/limiter.js";
import { openaiCompatAdapter } from "./services/llm/providers/openaiCompat.js";
import { generateBatchedText } from "./services/textGenerator.js";
import { classifyOptions } from "./services/sentimentEngine.js";
import { generateResponses } from "./services/responseGenerator.js";

describe("Provider-Agnostic LLM Layer Tests (Groq & OpenRouter)", () => {
  beforeEach(() => {
    providerCooldowns.clear();
  });

  describe("1. Key Masking & Security", () => {
    it("masks keys properly and never exposes the full secret", () => {
      const groqKey = "gsk_1234567890abcdefXYZ";
      const masked = maskKey(groqKey);
      assert.equal(masked, "gsk_…fXYZ");
      assert.equal(masked.startsWith("gsk_…"), true);
      assert.equal(masked.endsWith("fXYZ"), true);
      assert.equal(masked.includes("1234567890"), false);

      const openrouterKey = "sk-or-v1-abcdef12345678";
      const maskedOr = maskKey(openrouterKey);
      assert.equal(maskedOr, "sk-o…5678");

      assert.equal(maskKey(""), "****");
      assert.equal(maskKey(null), "****");
      assert.equal(maskKey("short"), "****");
    });

    it("OpenRouter passes HTTP-Referer, X-Title, and Authorization header", async () => {
      let capturedHeaders = {};

      const mockFetch = async (url, options) => {
        capturedHeaders = options.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "OpenRouter OK" } }],
          }),
        };
      };

      const res = await openaiCompatAdapter({
        prompt: "Hello",
        apiKey: "sk-or-v1-secretKey123",
        model: "nvidia/nemotron-3.5-lightning:free",
        baseUrl: "https://openrouter.ai/api/v1",
        extraHeaders: {
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "Autofillr",
        },
        fetchFn: mockFetch,
      });

      assert.equal(res, "OpenRouter OK");
      assert.equal(capturedHeaders["Authorization"], "Bearer sk-or-v1-secretKey123");
      assert.equal(capturedHeaders["HTTP-Referer"], "http://localhost:5173");
      assert.equal(capturedHeaders["X-Title"], "Autofillr");
    });

    it("Groq passes Authorization Bearer header", async () => {
      let capturedHeaders = {};

      const mockFetch = async (url, options) => {
        capturedHeaders = options.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Groq OK" } }],
          }),
        };
      };

      const res = await openaiCompatAdapter({
        prompt: "Hello",
        apiKey: "gsk_TestSecret456",
        model: "qwen/qwen3.8-27b",
        baseUrl: "https://api.groq.com/openai/v1",
        fetchFn: mockFetch,
      });

      assert.equal(res, "Groq OK");
      assert.equal(capturedHeaders["Authorization"], "Bearer gsk_TestSecret456");
    });
  });

  describe("2. Provider Detection & Registry", () => {
    it("detects providers by key prefix", () => {
      assert.equal(detectProviderByKey("gsk_abc123"), "groq");
      assert.equal(detectProviderByKey("sk-or-v1-xyz"), "openrouter");
      assert.equal(detectProviderByKey("unknown-key"), null);
    });

    it("resolves providers from GROQ_KEY and OPENROUTER_KEY according to LLM_PRIORITY", () => {
      const env = {
        GROQ_KEY: "gsk_Groq12345678",
        OPENROUTER_KEY: "sk-or-v1-OpenRouter1234",
        LLM_PRIORITY: "groq,openrouter",
      };

      const providers = getConfiguredProviders(env);
      assert.equal(providers.length, 2);
      assert.equal(providers[0].name, "groq");
      assert.equal(providers[1].name, "openrouter");
      assert.equal(providers[1].extraHeaders?.["X-Title"], "Autofillr");
    });

    it("auto-detects additional keys from LLM_API_KEYS", () => {
      const env = {
        GROQ_KEY: "gsk_Groq11111111",
        LLM_API_KEYS: "sk-or-extraOpenRouterKey, gsk_extraGroqKey5678",
        LLM_PRIORITY: "groq",
      };

      const providers = getConfiguredProviders(env);
      assert.equal(providers.length, 3);
      assert.equal(providers[0].name, "groq");
      assert.equal(providers[1].name, "openrouter");
      assert.equal(providers[2].name, "groq");
    });

    it("returns empty array when no keys configured", () => {
      const env = {
        GROQ_KEY: "",
        OPENROUTER_KEY: "",
        LLM_API_KEYS: "",
      };

      const providers = getConfiguredProviders(env);
      assert.equal(providers.length, 0);
    });
  });

  describe("3. Concurrency Limiter", () => {
    it("limits concurrent executions to maxConcurrency (2) and queues excess calls", async () => {
      const limiter = new ConcurrencyLimiter(2);
      let running = 0;
      let maxSeen = 0;

      const task = async () => {
        return limiter.run(async () => {
          running++;
          maxSeen = Math.max(maxSeen, running);
          await new Promise((r) => setTimeout(r, 20));
          running--;
          return "done";
        });
      };

      const promises = [task(), task(), task(), task(), task()];
      const results = await Promise.all(promises);

      assert.equal(results.length, 5);
      assert.equal(maxSeen <= 2, true, `Max concurrent calls was ${maxSeen}, expected <= 2`);
    });
  });

  describe("4. Fallback on 429/5xx/timeout & 60s Cooldown", () => {
    it("falls back to 2nd provider on 429 error and applies 60s cooldown to 1st provider", async () => {
      const env = {
        GROQ_KEY: "gsk_FirstKey123456",
        OPENROUTER_KEY: "sk-or-v1-SecondKey123456",
        LLM_PRIORITY: "groq,openrouter",
      };

      let callCount = 0;
      const mockFetch = async (url) => {
        callCount++;
        if (url.includes("api.groq.com")) {
          // Groq returns 429
          return {
            ok: false,
            status: 429,
            json: async () => ({ error: { message: "Quota exceeded" } }),
          };
        }
        // OpenRouter succeeds
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Success from OpenRouter fallback" } }],
          }),
        };
      };

      const result = await generateText({
        prompt: "Generate text",
        fetchFn: mockFetch,
        envOverrides: env,
      });

      assert.equal(result, "Success from OpenRouter fallback");
      assert.equal(callCount, 2);

      // Verify cooldown was registered for groq
      const groqId = "groq:" + maskKey("gsk_FirstKey123456");
      const cooldown = providerCooldowns.get(groqId);
      assert.ok(cooldown && cooldown > Date.now());

      // Second call should skip groq immediately and go directly to openrouter!
      callCount = 0;
      const result2 = await generateText({
        prompt: "Generate text 2",
        fetchFn: mockFetch,
        envOverrides: env,
      });

      assert.equal(result2, "Success from OpenRouter fallback");
      assert.equal(callCount, 1, "Groq should be skipped due to active cooldown");
    });

    it("falls back to 2nd provider on 5xx or timeout", async () => {
      const env = {
        GROQ_KEY: "gsk_FirstKey123456",
        OPENROUTER_KEY: "sk-or-v1-SecondKey123456",
        LLM_PRIORITY: "groq,openrouter",
      };

      const mockFetch = async (url) => {
        if (url.includes("api.groq.com")) {
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: { message: "Groq Overloaded" } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "OK from OpenRouter fallback" } }],
          }),
        };
      };

      const result = await generateText({
        prompt: "Test 5xx fallback",
        fetchFn: mockFetch,
        envOverrides: env,
      });

      assert.equal(result, "OK from OpenRouter fallback");
    });

    it("throws LLM_UNAVAILABLE when all providers fail", async () => {
      const env = {
        GROQ_KEY: "gsk_FirstKey123456",
        OPENROUTER_KEY: "sk-or-v1-SecondKey123456",
      };

      const mockFetch = async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: "Internal Server Error" } }),
      });

      await assert.rejects(
        () =>
          generateText({
            prompt: "Fail all",
            fetchFn: mockFetch,
            envOverrides: env,
          }),
        (err) => err.errorCode === "LLM_UNAVAILABLE"
      );
    });
  });

  describe("5. Startup Self-Test & Status Reporting", () => {
    it("reports OK and FAILED status without leaking keys", async () => {
      const env = {
        GROQ_KEY: "gsk_WorkingKey1234",
        OPENROUTER_KEY: "sk-or-v1-FailingKey5678",
        LLM_PRIORITY: "groq,openrouter",
      };

      const mockFetch = async (url) => {
        if (url.includes("api.groq.com")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: "OK" } }],
            }),
          };
        }
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { message: "Invalid API key" } }),
        };
      };

      const status = await runStartupTest({
        fetchFn: mockFetch,
        envOverrides: env,
        silent: true,
      });

      assert.equal(status.enabled, true);
      assert.equal(status.providers.length, 2);

      const groqStatus = status.providers.find((p) => p.provider === "groq");
      const openrouterStatus = status.providers.find((p) => p.provider === "openrouter");

      assert.equal(groqStatus.status, "OK");
      assert.ok(groqStatus.latencyMs >= 0);
      assert.equal(openrouterStatus.status, "FAILED");

      // Verify no raw key is present in status object
      const serialized = JSON.stringify(status);
      assert.equal(serialized.includes("gsk_WorkingKey1234"), false);
      assert.equal(serialized.includes("sk-or-v1-FailingKey5678"), false);
    });
  });

  describe("6. Local Fallbacks When No Keys Configured", () => {
    let savedGroq;
    let savedOpenRouter;
    let savedExtra;

    beforeEach(() => {
      savedGroq = process.env.GROQ_KEY;
      savedOpenRouter = process.env.OPENROUTER_KEY;
      savedExtra = process.env.LLM_API_KEYS;
      delete process.env.GROQ_KEY;
      delete process.env.OPENROUTER_KEY;
      delete process.env.LLM_API_KEYS;
    });

    afterEach(() => {
      if (savedGroq !== undefined) process.env.GROQ_KEY = savedGroq;
      if (savedOpenRouter !== undefined) process.env.OPENROUTER_KEY = savedOpenRouter;
      if (savedExtra !== undefined) process.env.LLM_API_KEYS = savedExtra;
    });

    it("generateBatchedText falls back to local templates without throwing", async () => {
      const q = { title: "Feedback", type: "paragraph" };
      const res = await generateBatchedText({
        question: q,
        sentiment: "positive",
        count: 3,
        generateTextFn: null,
      });

      assert.equal(res.usedLLM, false);
      assert.equal(res.fallbackUsed, true);
      assert.equal(res.answers.length, 3);
      assert.ok(typeof res.answers[0] === "string" && res.answers[0].length > 0);
    });

    it("classifyOptions falls back to n/a without throwing", async () => {
      const q = {
        title: "City",
        type: "multiple_choice",
        options: ["London", "Paris", "Tokyo"],
      };

      const res = await classifyOptions(q, null);
      assert.deepEqual(res, { London: "n/a", Paris: "n/a", Tokyo: "n/a" });
    });

    it("generateResponses marks metadata.fallbackUsed when no LLM is configured", async () => {
      const questions = [
        {
          id: "q1",
          entryId: "entry.1001",
          title: "Thoughts?",
          type: "paragraph",
          required: false,
        },
      ];

      const res = await generateResponses({
        questions,
        count: 2,
        anthropicClient: null,
        generateTextFn: null,
      });

      assert.equal(res.responses.length, 2);
      assert.equal(res.metadata.fallbackUsed, true);
    });
  });

  describe("7. Form Topic Context & Style Hints in Prompt", () => {
    it("injects formContext and styleHint into the prompt for generateBatchedText", async () => {
      let promptSent = "";
      const mockGenerateFn = async ({ prompt }) => {
        promptSent = prompt;
        return JSON.stringify(["Specific meal planning feature request"]);
      };

      const q = { title: "Any suggestions?", type: "paragraph" };
      const formContext = {
        title: "BudgetBites Student App",
        description: "App helping college students plan healthy affordable food.",
      };

      const res = await generateBatchedText({
        question: q,
        sentiment: "positive",
        count: 1,
        formContext,
        styleHint: "concise and practical",
        generateTextFn: mockGenerateFn,
      });

      assert.equal(res.usedLLM, true);
      assert.ok(promptSent.includes("BudgetBites Student App"));
      assert.ok(promptSent.includes("college students plan healthy affordable food"));
      assert.ok(promptSent.includes("concise and practical"));
      assert.ok(promptSent.includes("specific, concrete ideas directly related to the form's topic"));
    });
  });
});
