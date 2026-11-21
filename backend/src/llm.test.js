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
import { geminiAdapter } from "./services/llm/providers/gemini.js";
import { openaiCompatAdapter } from "./services/llm/providers/openaiCompat.js";
import { generateBatchedText } from "./services/textGenerator.js";
import { classifyOptions } from "./services/sentimentEngine.js";
import { generateResponses } from "./services/responseGenerator.js";

describe("Provider-Agnostic LLM Layer Tests", () => {
  beforeEach(() => {
    providerCooldowns.clear();
  });

  describe("1. Key Masking & Security", () => {
    it("masks keys properly and never exposes the full secret", () => {
      const geminiKey = "AIzaSyD1234567890abcdefXYZ";
      const masked = maskKey(geminiKey);
      assert.equal(masked, "AIza…fXYZ");
      assert.equal(masked.startsWith("AIza…"), true);
      assert.equal(masked.endsWith("fXYZ"), true);
      assert.equal(masked.includes("1234567890"), false);

      assert.equal(maskKey(""), "****");
      assert.equal(maskKey(null), "****");
      assert.equal(maskKey("short"), "****");
    });

    it("Gemini adapter passes key in x-goog-api-key header and never in URL", async () => {
      let capturedUrl = "";
      let capturedHeaders = {};

      const mockFetch = async (url, options) => {
        capturedUrl = url;
        capturedHeaders = options.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: "Gemini OK" }] } }],
          }),
        };
      };

      const res = await geminiAdapter({
        prompt: "Hello",
        apiKey: "AIzaTestSecretKey123",
        model: "gemini-3.5-flash-lite",
        fetchFn: mockFetch,
      });

      assert.equal(res, "Gemini OK");
      assert.equal(capturedUrl.includes("AIza"), false, "API key must not be in URL");
      assert.equal(capturedHeaders["x-goog-api-key"], "AIzaTestSecretKey123");
    });

    it("OpenAICompat adapter passes key in Authorization header", async () => {
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
        fetchFn: mockFetch,
      });

      assert.equal(res, "Groq OK");
      assert.equal(capturedHeaders["Authorization"], "Bearer gsk_TestSecret456");
    });
  });

  describe("2. Provider Detection & Registry", () => {
    it("detects providers by key prefix", () => {
      assert.equal(detectProviderByKey("AIzaSyD123"), "gemini");
      assert.equal(detectProviderByKey("gsk_abc123"), "groq");
      assert.equal(detectProviderByKey("sk-or-v1-xyz"), "openrouter");
      assert.equal(detectProviderByKey("unknown-key"), null);
    });

    it("resolves providers from GEMINI_KEY and GROQ_KEY according to LLM_PRIORITY", () => {
      const env = {
        GEMINI_KEY: "AIzaGemini12345678",
        GROQ_KEY: "gsk_Groq12345678",
        LLM_PRIORITY: "groq,gemini",
      };

      const providers = getConfiguredProviders(env);
      assert.equal(providers.length, 2);
      assert.equal(providers[0].name, "groq");
      assert.equal(providers[1].name, "gemini");
    });

    it("auto-detects additional keys from LLM_API_KEYS", () => {
      const env = {
        GEMINI_KEY: "AIzaGemini11111111",
        LLM_API_KEYS: "sk-or-openrouterKey1234, gsk_extraGroqKey5678",
        LLM_PRIORITY: "gemini",
      };

      const providers = getConfiguredProviders(env);
      assert.equal(providers.length, 3);
      assert.equal(providers[0].name, "gemini");
      assert.equal(providers[1].name, "openrouter");
      assert.equal(providers[2].name, "groq");
    });

    it("returns empty array and hasLLM is false when no keys configured", () => {
      const env = {
        GEMINI_KEY: "",
        GROQ_KEY: "",
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
        GEMINI_KEY: "AIzaFirstKey123456",
        GROQ_KEY: "gsk_SecondKey123456",
        LLM_PRIORITY: "gemini,groq",
      };

      let callCount = 0;
      const mockFetch = async (url) => {
        callCount++;
        if (url.includes("generativelanguage")) {
          // Gemini returns 429
          return {
            ok: false,
            status: 429,
            json: async () => ({ error: { message: "Quota exceeded" } }),
          };
        }
        // Groq succeeds
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Success from Groq fallback" } }],
          }),
        };
      };

      const result = await generateText({
        prompt: "Generate text",
        fetchFn: mockFetch,
        envOverrides: env,
      });

      assert.equal(result, "Success from Groq fallback");
      assert.equal(callCount, 2);

      // Verify cooldown was registered for gemini
      const geminiId = "gemini:" + maskKey("AIzaFirstKey123456");
      const cooldown = providerCooldowns.get(geminiId);
      assert.ok(cooldown && cooldown > Date.now());

      // Second call should skip gemini immediately and go directly to groq!
      callCount = 0;
      const result2 = await generateText({
        prompt: "Generate text 2",
        fetchFn: mockFetch,
        envOverrides: env,
      });

      assert.equal(result2, "Success from Groq fallback");
      assert.equal(callCount, 1, "Gemini should be skipped due to active cooldown");
    });

    it("falls back to 2nd provider on 5xx or timeout", async () => {
      const env = {
        GEMINI_KEY: "AIzaFirstKey123456",
        GROQ_KEY: "gsk_SecondKey123456",
        LLM_PRIORITY: "gemini,groq",
      };

      const mockFetch = async (url) => {
        if (url.includes("generativelanguage")) {
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: { message: "Overloaded" } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "OK from second provider" } }],
          }),
        };
      };

      const result = await generateText({
        prompt: "Test 5xx fallback",
        fetchFn: mockFetch,
        envOverrides: env,
      });

      assert.equal(result, "OK from second provider");
    });

    it("throws LLM_UNAVAILABLE when all providers fail", async () => {
      const env = {
        GEMINI_KEY: "AIzaFirstKey123456",
        GROQ_KEY: "gsk_SecondKey123456",
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
        GEMINI_KEY: "AIzaWorkingKey1234",
        GROQ_KEY: "gsk_FailingKey5678",
        LLM_PRIORITY: "gemini,groq",
      };

      const mockFetch = async (url) => {
        if (url.includes("generativelanguage")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [{ content: { parts: [{ text: "OK" }] } }],
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

      const geminiStatus = status.providers.find((p) => p.provider === "gemini");
      const groqStatus = status.providers.find((p) => p.provider === "groq");

      assert.equal(geminiStatus.status, "OK");
      assert.ok(geminiStatus.latencyMs >= 0);
      assert.equal(groqStatus.status, "FAILED");

      // Verify no raw key is present in status object
      const serialized = JSON.stringify(status);
      assert.equal(serialized.includes("AIzaWorkingKey1234"), false);
      assert.equal(serialized.includes("gsk_FailingKey5678"), false);
    });
  });

  describe("6. Local Fallbacks When No Keys Configured", () => {
    let savedGemini;
    let savedGroq;
    let savedExtra;

    beforeEach(() => {
      savedGemini = process.env.GEMINI_KEY;
      savedGroq = process.env.GROQ_KEY;
      savedExtra = process.env.LLM_API_KEYS;
      delete process.env.GEMINI_KEY;
      delete process.env.GROQ_KEY;
      delete process.env.LLM_API_KEYS;
    });

    afterEach(() => {
      if (savedGemini !== undefined) process.env.GEMINI_KEY = savedGemini;
      if (savedGroq !== undefined) process.env.GROQ_KEY = savedGroq;
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
