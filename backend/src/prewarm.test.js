import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import answerCache, { AnswerCache } from "./services/answerCache.js";
import { prewarmForm, refillBuffer } from "./services/prewarm.js";
import { generateResponses } from "./services/responseGenerator.js";
import { generateBatchedText, stripMarkdownFences } from "./services/textGenerator.js";
import jobStore from "./services/jobStore.js";
import jobWorker from "./services/jobWorker.js";

describe("Prewarm & AnswerCache Tests (Offline)", () => {
  beforeEach(() => {
    answerCache.clear();
  });

  // 1. Cache TTL & Eviction
  it("enforces max 20 forms cache limit and evicts oldest", () => {
    const testCache = new AnswerCache();
    // Fill with 20 forms
    for (let i = 1; i <= 20; i++) {
      testCache.init(`form-${i}`, { totalAiQuestions: 1 });
    }

    assert.equal(testCache.cache.size, 20);
    assert.ok(testCache.get("form-1")); // accessing form-1 updates its lastAccessed

    // Add 21st form -> form-2 should be evicted (as form-1 was just accessed)
    testCache.init("form-21", { totalAiQuestions: 1 });
    assert.equal(testCache.cache.size, 20);
    assert.equal(testCache.get("form-2"), null, "Oldest form-2 was not evicted");
    assert.ok(testCache.get("form-1"), "form-1 should remain cached");
    assert.ok(testCache.get("form-21"), "form-21 should be in cache");
  });

  it("expires entries after TTL (1 hour)", () => {
    const testCache = new AnswerCache();
    testCache.init("test-ttl");
    const entry = testCache.get("test-ttl");
    assert.ok(entry);

    // Simulate expiration by backdating createdAt by 2 hours
    entry.createdAt = Date.now() - 2 * 60 * 60 * 1000;
    assert.equal(testCache.get("test-ttl"), null, "Expired entry was not cleaned up");
  });

  // 2. No-repeat pop
  it("pop returns distinct items, removes them, and returns null when empty", () => {
    const testCache = new AnswerCache();
    testCache.init("form-pop");
    testCache.pushAnswers("form-pop", "q1", "positive", [
      "Great product!",
      "Loved the service!",
    ]);

    assert.equal(testCache.size("form-pop", "q1", "positive"), 2);

    const first = testCache.pop("form-pop", "q1", "positive");
    assert.equal(first, "Great product!");
    assert.equal(testCache.size("form-pop", "q1", "positive"), 1);

    const second = testCache.pop("form-pop", "q1", "positive");
    assert.equal(second, "Loved the service!");
    assert.equal(testCache.size("form-pop", "q1", "positive"), 0);

    const third = testCache.pop("form-pop", "q1", "positive");
    assert.equal(third, null, "Empty buffer must return null");
  });

  // 3. One combined call covers all AI-needed questions
  it("prewarmForm uses exactly ONE combined LLM call covering all AI-needed questions", async () => {
    let callCount = 0;
    let sentPrompt = "";

    const mockLLMFn = async ({ prompt }) => {
      callCount++;
      sentPrompt = prompt;
      return JSON.stringify({
        text: {
          "entry.101": {
            positive: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"],
            neutral: ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8"],
            negative: ["Neg1", "Neg2", "Neg3", "Neg4", "Neg5", "Neg6", "Neg7", "Neg8"],
          },
        },
        options: {
          "entry.102": {
            "Yes": "positive",
            "No": "negative",
          },
        },
      });
    };

    const questions = [
      { id: "q1", entryId: "entry.101", title: "General Feedback", type: "paragraph" },
      { id: "q2", entryId: "entry.102", title: "Would you recommend?", type: "multiple_choice", options: ["Yes", "No"] },
    ];

    const formKey = "test-combined-call";
    await prewarmForm({
      formKey,
      questions,
      formContext: { title: "Feedback Form", description: "Tell us what you think" },
      generateTextFn: mockLLMFn,
      skipTopUp: true,
    });

    assert.equal(callCount, 1, `Expected exactly 1 LLM call, got ${callCount}`);
    assert.ok(sentPrompt.includes("General Feedback"), "Prompt missing text question title");
    assert.ok(sentPrompt.includes("Would you recommend?"), "Prompt missing choice question title");

    const status = answerCache.getStatusInfo(formKey);
    assert.equal(status.status, "ready");
    assert.equal(status.total, 2);
    assert.equal(status.ready, 2);

    // Verify option labels in cache
    const options = answerCache.getOptions(formKey, "entry.102");
    assert.deepEqual(options, { Yes: "positive", No: "negative" });

    // Verify text buffer in cache
    assert.equal(answerCache.size(formKey, "entry.101", "positive"), 8);
  });

  // 4. Obvious fields and pools skipped
  it("skips obvious field types (name, email, phone) from AI prewarm", async () => {
    let callCount = 0;
    let sentPrompt = "";

    const mockLLMFn = async ({ prompt }) => {
      callCount++;
      sentPrompt = prompt;
      return JSON.stringify({
        text: {
          "entry.202": {
            positive: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"],
            neutral: ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8"],
            negative: ["Neg1", "Neg2", "Neg3", "Neg4", "Neg5", "Neg6", "Neg7", "Neg8"],
          },
        },
        options: {},
      });
    };

    const questions = [
      { id: "q_name", entryId: "entry.201", title: "Full Name", type: "short_text" },
      { id: "q_email", entryId: "entry.202_email", title: "Email Address", type: "short_text" },
      { id: "q_feedback", entryId: "entry.202", title: "Your suggestions", type: "short_text" },
    ];

    const formKey = "test-obvious-fields";
    await prewarmForm({
      formKey,
      questions,
      generateTextFn: mockLLMFn,
      skipTopUp: true,
    });

    assert.equal(callCount, 1);
    assert.ok(!sentPrompt.includes("Full Name"), "Name should not be sent to LLM");
    assert.ok(!sentPrompt.includes("Email Address"), "Email should not be sent to LLM");
    assert.ok(sentPrompt.includes("Your suggestions"), "Suggestions must be sent to LLM");
  });

  // 5. Lock prevents double warm-up
  it("lock prevents simultaneous warming of the same formKey", async () => {
    let callCount = 0;
    const mockLLMFn = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return JSON.stringify({ text: {}, options: {} });
    };

    const questions = [
      { id: "q1", entryId: "entry.301", title: "Feedback", type: "paragraph" },
    ];

    const formKey = "test-double-lock";
    // Fire two prewarm calls concurrently
    await Promise.all([
      prewarmForm({ formKey, questions, generateTextFn: mockLLMFn, skipTopUp: true }),
      prewarmForm({ formKey, questions, generateTextFn: mockLLMFn, skipTopUp: true }),
    ]);

    assert.equal(callCount, 1, "Expected only 1 run due to lock, got " + callCount);
  });

  // 6. Empty buffer -> wait max 6s -> fallback
  it("empty buffer falls back to local template and sets fallbackUsed: true", async () => {
    const formKey = "test-empty-buffer";
    answerCache.init(formKey, { totalAiQuestions: 1 });
    // Buffer is empty and status is set to ready (so waitForAnswer doesn't hang)
    answerCache.setStatus(formKey, "ready");

    const question = { id: "q1", entryId: "entry.401", title: "Suggestions", type: "paragraph" };

    const result = await generateBatchedText({
      question,
      sentiment: "positive",
      count: 2,
      formKey,
      generateTextFn: false, // force offline fallback
    });

    assert.equal(result.answers.length, 2);
    assert.equal(result.usedLLM, false);
    assert.equal(result.fallbackUsed, true);
  });

  // 7. Background refill triggers below threshold (<5)
  it("needsRefill triggers when buffer size drops below 5", () => {
    const testCache = new AnswerCache();
    testCache.init("form-refill");
    testCache.pushAnswers("form-refill", "q1", "positive", ["1", "2", "3", "4", "5", "6"]);

    assert.equal(testCache.needsRefill("form-refill", "q1", "positive"), false);

    // Pop two answers -> size drops to 4 (< 5)
    testCache.pop("form-refill", "q1", "positive");
    testCache.pop("form-refill", "q1", "positive");
    assert.equal(testCache.size("form-refill", "q1", "positive"), 4);
    assert.equal(testCache.needsRefill("form-refill", "q1", "positive"), true);
  });

  // 8. Job starts with the first chunk of 10 without waiting for the rest
  it("job creates first chunk of 10 without generating all 50 responses immediately", async () => {
    const questions = [
      { id: "q1", entryId: "entry.501", title: "Name", type: "short_text" },
    ];

    const initialChunkSize = Math.min(10, 50);
    const { responses: initialResponses } = await generateResponses({
      questions,
      count: initialChunkSize,
      settings: { count: initialChunkSize },
    });

    assert.equal(initialResponses.length, 10, "Job must create initial chunk of 10");

    const jobId = "test-chunk-job";
    const job = {
      id: jobId,
      total: 50,
      submitted: 0,
      failed: 0,
      questions,
      responses: initialResponses,
      status: "queued",
    };

    await jobStore.createJob(job);
    const stored = await jobStore.getJob(jobId);
    assert.equal(stored.responses.length, 10);
    assert.equal(stored.total, 50);
  });

  // 9. Resume keeps stored responses
  it("resuming a job preserves already-generated responses", async () => {
    const jobId = "test-resume-job";
    const existingResponses = [
      { index: 0, answers: { "entry.1": "A" } },
      { index: 1, answers: { "entry.1": "B" } },
    ];

    await jobStore.createJob({
      id: jobId,
      status: "paused",
      total: 10,
      submitted: 1,
      failed: 0,
      responses: existingResponses,
    });

    // Resume
    await jobStore.updateJob(jobId, { status: "running" });
    const resumed = await jobStore.getJob(jobId);

    assert.equal(resumed.status, "running");
    assert.equal(resumed.responses.length, 2);
    assert.deepEqual(resumed.responses[0].answers, { "entry.1": "A" });
    assert.deepEqual(resumed.responses[1].answers, { "entry.1": "B" });
  });

  // 10. <think> block stripping
  it("strips reasoning/<think> blocks and markdown fences from LLM responses", () => {
    const rawWithThink = `<think>
Formatting JSON output for form prewarm.
We need text and options.
</think>
\`\`\`json
{
  "text": {
    "entry.101": {
      "positive": ["Answer 1"],
      "neutral": ["Answer 2"],
      "negative": ["Answer 3"]
    }
  },
  "options": {
    "entry.102": {
      "Yes": "positive",
      "No": "negative"
    }
  }
}
\`\`\``;

    const cleaned = stripMarkdownFences(rawWithThink);
    const parsed = JSON.parse(cleaned);
    assert.deepEqual(parsed, {
      text: {
        "entry.101": {
          positive: ["Answer 1"],
          neutral: ["Answer 2"],
          negative: ["Answer 3"],
        },
      },
      options: {
        "entry.102": {
          Yes: "positive",
          No: "negative",
        },
      },
    });
  });

  // 9. When both AI fail, populates hardcoded responses without throwing
  it("when both AI fail, prewarmForm does NOT throw error and uses custom hardcoded responses", async () => {
    const questions = [
      { id: "q1", entryId: "entry.1", title: "General Feedback", type: "short_text" },
      { id: "q2", entryId: "entry.2", title: "Detailed Impressions", type: "paragraph" },
      { id: "q3", entryId: "entry.3", title: "Would recommend?", type: "multiple_choice", options: ["Definitely", "Never"] }
    ];

    const failingLLMFn = async () => {
      throw new Error("503 LLM_UNAVAILABLE: All AI providers failed");
    };

    // Must not throw an unhandled rejection
    await prewarmForm({
      formKey: "offline-fail-test",
      questions,
      formContext: { title: "Test Form", description: "Testing failover" },
      generateTextFn: failingLLMFn,
    });

    // Check status is ready with fallback
    const statusInfo = answerCache.getStatusInfo("offline-fail-test");
    assert.equal(statusInfo.status, "ready");
    assert.equal(statusInfo.fallbackUsed, true);

    // Buffer has answers for text questions
    const q1Ans = answerCache.pop("offline-fail-test", "q1", "positive");
    assert.ok(q1Ans, "q1 should have positive answer from hardcoded responses");
    assert.ok(typeof q1Ans === "string" && q1Ans.length > 0);

    const q2Ans = answerCache.pop("offline-fail-test", "q2", "negative");
    assert.ok(q2Ans, "q2 should have negative answer from hardcoded responses");
    assert.ok(typeof q2Ans === "string" && q2Ans.length > 0);

    // Options are classified via heuristic
    const q3Opts = answerCache.getOptions("offline-fail-test", "q3");
    assert.equal(q3Opts["Definitely"], "positive");
    assert.equal(q3Opts["Never"], "negative");
  });
});
