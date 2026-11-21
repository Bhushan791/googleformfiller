import { describe, it } from "node:test";
import assert from "node:assert/strict";
import answerCache from "./services/answerCache.js";
import {
  hasPastExperiencePhrasing,
  calculateJaccardSimilarity,
  filterDiverseAnswers,
  findRepetitivePrefixes,
  buildModeInstructions,
  generateBatchedText,
} from "./services/textGenerator.js";
import { prewarmForm } from "./services/prewarm.js";

describe("Audience Mode & Detection Tests", () => {
  describe("1. Cache Key Changes with Mode and Scenario", () => {
    it("computes different formKeys when audienceMode or scenario changes", () => {
      const formId = "test-form-123";
      const questions = [{ id: "q1", title: "What do you think?" }];

      const keyAuto = answerCache.computeFormKey(formId, questions, { audienceMode: "auto" });
      const keyPrelaunch = answerCache.computeFormKey(formId, questions, { audienceMode: "prelaunch" });
      const keyLaunched = answerCache.computeFormKey(formId, questions, { audienceMode: "launched" });
      const keyEvent = answerCache.computeFormKey(formId, questions, { audienceMode: "event" });
      const keyCustom1 = answerCache.computeFormKey(formId, questions, { audienceMode: "custom", scenario: "Testing beta" });
      const keyCustom2 = answerCache.computeFormKey(formId, questions, { audienceMode: "custom", scenario: "Testing v2" });

      assert.notEqual(keyAuto, keyPrelaunch);
      assert.notEqual(keyPrelaunch, keyLaunched);
      assert.notEqual(keyLaunched, keyEvent);
      assert.notEqual(keyCustom1, keyCustom2);

      // Same inputs produce identical hash
      const keyAutoAgain = answerCache.computeFormKey(formId, questions, { audienceMode: "auto" });
      assert.equal(keyAuto, keyAutoAgain);
    });
  });

  describe("2. Each Mode Changes the Prompt Instructions", () => {
    it("builds distinct prompt rules per mode", () => {
      const prelaunchText = buildModeInstructions("prelaunch");
      const launchedText = buildModeInstructions("launched");
      const eventText = buildModeInstructions("event");
      const researchText = buildModeInstructions("research");
      const customText = buildModeInstructions("custom", "Special campus dining survey");

      assert.ok(prelaunchText.includes("PRELAUNCH"));
      assert.ok(prelaunchText.includes("respondents have NOT used the product"));
      assert.ok(prelaunchText.includes("skepticism about the IDEA"));

      assert.ok(launchedText.includes("LAUNCHED"));
      assert.ok(launchedText.includes("respondents HAVE used the product"));

      assert.ok(eventText.includes("EVENT"));
      assert.ok(eventText.includes("attended the event"));

      assert.ok(researchText.includes("RESEARCH"));
      assert.ok(researchText.includes("personal opinions, habits"));

      assert.ok(customText.includes("CUSTOM"));
      assert.ok(customText.includes("Special campus dining survey"));
    });

    it("injects mode instructions into generateBatchedText prompt", async () => {
      let capturedPrompt = "";
      const mockFn = async ({ prompt }) => {
        capturedPrompt = prompt;
        return JSON.stringify(["Excited for this meal planning app concept"]);
      };

      await generateBatchedText({
        question: { id: "q1", title: "Feedback on our prototype?", type: "paragraph" },
        sentiment: "positive",
        count: 1,
        generateTextFn: mockFn,
        settings: { audienceMode: "prelaunch" },
      });

      assert.ok(capturedPrompt.includes("Audience mode: PRELAUNCH"));
      assert.ok(capturedPrompt.includes("NO past usage statements"));
    });
  });

  describe("3. Auto-Detect Mode & Low Confidence Fallback", () => {
    it("auto uses the detected mode when confidence >= 0.6", async () => {
      answerCache.clear();
      const formKey = "test-auto-key-1";
      const questions = [
        { id: "q1", title: "General thoughts?", type: "paragraph" },
        { id: "q2", title: "Overall impression?", type: "multiple_choice", options: ["Great", "Bad"] },
      ];

      const mockLlm = async () => {
        return JSON.stringify({
          detection: {
            mode: "prelaunch",
            confidence: 0.88,
            reason: "Form asks for interest in an unreleased app",
            audience: "Prospective users",
          },
          text: {
            q1: {
              positive: ["Sounds really promising!"],
              neutral: ["Not sure if I would use it."],
              negative: ["There are already many similar apps."],
            },
          },
          options: {
            q2: { Great: "positive", Bad: "negative" },
          },
        });
      };

      await prewarmForm({
        formKey,
        questions,
        settings: { audienceMode: "auto" },
        generateTextFn: mockLlm,
        skipTopUp: true,
      });

      const info = answerCache.getStatusInfo(formKey);
      assert.equal(info.detectedMode, "prelaunch");
      assert.equal(info.confidence, 0.88);
      assert.equal(info.reason, "Form asks for interest in an unreleased app");
      assert.equal(info.effectiveMode, "prelaunch");
    });

    it("falls back to research when detection confidence < 0.6", async () => {
      answerCache.clear();
      const formKey = "test-auto-key-2";
      const questions = [
        { id: "q1", title: "Your habits?", type: "short_text" },
      ];

      const mockLlm = async () => {
        return JSON.stringify({
          detection: {
            mode: "launched",
            confidence: 0.45, // < 0.6
            reason: "Ambiguous form context",
            audience: "General respondents",
          },
          text: {
            q1: {
              positive: ["Very helpful"],
              neutral: ["Normal routine"],
              negative: ["No opinion"],
            },
          },
        });
      };

      await prewarmForm({
        formKey,
        questions,
        settings: { audienceMode: "auto" },
        generateTextFn: mockLlm,
        skipTopUp: true,
      });

      const info = answerCache.getStatusInfo(formKey);
      assert.equal(info.detectedMode, "research");
      assert.equal(info.effectiveMode, "research");
    });
  });

  describe("4. Blocklist & Topic Words", () => {
    it("blocks past-experience phrasing in prelaunch and research", () => {
      // Past experience phrasing
      assert.equal(hasPastExperiencePhrasing("I used this app yesterday and it failed"), true);
      assert.equal(hasPastExperiencePhrasing("I tried logging in"), true);
      assert.equal(hasPastExperiencePhrasing("I bought the premium plan"), true);
      assert.equal(hasPastExperiencePhrasing("I paid for this last week"), true);
      assert.equal(hasPastExperiencePhrasing("I subscribed monthly"), true);
      assert.equal(hasPastExperiencePhrasing("My account was locked"), true);
      assert.equal(hasPastExperiencePhrasing("My ticket was never answered"), true);
      assert.equal(hasPastExperiencePhrasing("My order arrived late"), true);
      assert.equal(hasPastExperiencePhrasing("The interface crashed repeatedly"), true);
      assert.equal(hasPastExperiencePhrasing("Support ignored my message"), true);
      assert.equal(hasPastExperiencePhrasing("Customer service was terrible"), true);
      assert.equal(hasPastExperiencePhrasing("I requested a refund"), true);
      assert.equal(hasPastExperiencePhrasing("My payment was refunded"), true);
    });

    it("allows valid topic words to pass through", () => {
      assert.equal(hasPastExperiencePhrasing("BudgetBites sounds like a helpful student food app"), false);
      assert.equal(hasPastExperiencePhrasing("I usually order groceries on weekends"), false);
      assert.equal(hasPastExperiencePhrasing("There are already many apps offering meal deals"), false);
      assert.equal(hasPastExperiencePhrasing("Don't see the need for another campus tool"), false);
      assert.equal(hasPastExperiencePhrasing("Would love to see dietary filters"), false);
    });

    it("filters out past-experience answers in generateBatchedText when mode is prelaunch", async () => {
      const mockLlm = async () => {
        return JSON.stringify([
          "I used this app and my account crashed", // should be dropped
          "There are already too many apps for budget meals", // valid negative
        ]);
      };

      const result = await generateBatchedText({
        question: { id: "q1", title: "Feedback?", type: "paragraph" },
        sentiment: "negative",
        count: 2,
        generateTextFn: mockLlm,
        settings: { audienceMode: "prelaunch" },
      });

      assert.equal(result.answers.some((a) => a.includes("my account crashed")), false);
      assert.ok(result.answers.some((a) => a.includes("already too many apps")));
    });
  });

  describe("5. Diversity Filter", () => {
    it("computes Jaccard similarity correctly", () => {
      const s1 = "great affordable student meals for campus";
      const s2 = "great affordable student meals for campus";
      assert.equal(calculateJaccardSimilarity(s1, s2), 1.0);

      const s3 = "completely different sentence about transportation";
      assert.equal(calculateJaccardSimilarity(s1, s3), 0.0);

      // Overlapping strings (> 0.7)
      const s4 = "great affordable student meals on campus";
      assert.ok(calculateJaccardSimilarity(s1, s4) > 0.7);
    });

    it("drops exact and near duplicates with Jaccard > 0.7", () => {
      const items = [
        "I really like this concept for college meals",
        "I really like this concept for college meals", // exact duplicate
        "I really love this concept for college meals", // near duplicate (>0.7)
        "Skeptical that prices will remain affordable over time", // unique
      ];

      const filtered = filterDiverseAnswers(items, { maxJaccard: 0.7 });
      assert.equal(filtered.length, 2);
      assert.equal(filtered[0], "I really like this concept for college meals");
      assert.equal(filtered[1], "Skeptical that prices will remain affordable over time");
    });

    it("detects when more than 20% of answers share the first three words", () => {
      const answers = [
        "I would like more recipe options",
        "I would like better student discounts",
        "I would like a mobile widget",
        "The interface looks clean and modern",
        "Affordable prices are my main priority",
      ];
      // 3 of 5 start with "i would like" = 60% > 20%
      const repetitive = findRepetitivePrefixes(answers, 0.2);
      assert.ok(repetitive.includes("i would like"));
    });
  });
});

