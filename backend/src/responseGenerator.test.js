import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  pickSentiment,
  pickLinearScaleValue,
  isScaleReversed,
  pickCheckboxOptions,
} from "./services/sentimentEngine.js";
import {
  detectObviousFieldType,
  generateObviousFieldValue,
  PoolManager,
  stripMarkdownFences,
  generateBatchedText,
} from "./services/textGenerator.js";
import { generateResponses } from "./services/responseGenerator.js";

describe("responseGenerator & sentimentEngine", () => {
  // -------------------------------------------------------------------------
  // 1. Sentiment mix distribution over 1000 picks
  // -------------------------------------------------------------------------
  it("sentiment mix distribution over 1000 picks is within tolerance", () => {
    const mix = { positive: 70, neutral: 20, negative: 10 };
    const counts = { positive: 0, neutral: 0, negative: 0 };

    for (let i = 0; i < 1000; i++) {
      const s = pickSentiment(mix);
      counts[s]++;
    }

    // Expected: 700 / 200 / 100 with ±6% tolerance (640..760, 140..260, 50..150)
    assert.ok(
      counts.positive >= 640 && counts.positive <= 760,
      `positive count ${counts.positive} out of range 640..760`
    );
    assert.ok(
      counts.neutral >= 140 && counts.neutral <= 260,
      `neutral count ${counts.neutral} out of range 140..260`
    );
    assert.ok(
      counts.negative >= 50 && counts.negative <= 150,
      `negative count ${counts.negative} out of range 50..150`
    );
  });

  // -------------------------------------------------------------------------
  // 2. Scale banding and reversed-scale handling
  // -------------------------------------------------------------------------
  it("scale banding assigns top third to positive and bottom third to negative", () => {
    const normalScale = { min: 1, max: 5, minLabel: "Poor", maxLabel: "Excellent" };
    assert.equal(isScaleReversed(normalScale), false);

    // Normal scale 1..5: bottom third = [1, 2], middle third = [3], top third = [4, 5]
    for (let i = 0; i < 50; i++) {
      const posVal = Number(pickLinearScaleValue(normalScale, "positive"));
      assert.ok([4, 5].includes(posVal), `positive ${posVal} not in [4, 5]`);

      const neuVal = Number(pickLinearScaleValue(normalScale, "neutral"));
      assert.equal(neuVal, 3);

      const negVal = Number(pickLinearScaleValue(normalScale, "negative"));
      assert.ok([1, 2].includes(negVal), `negative ${negVal} not in [1, 2]`);
    }
  });

  it("reversed scale flips positive and negative bands", () => {
    const reversedScale = { min: 1, max: 5, minLabel: "Excellent", maxLabel: "Terrible" };
    assert.equal(isScaleReversed(reversedScale), true);

    // When reversed: 1 is "Excellent" (positive), 5 is "Terrible" (negative)
    for (let i = 0; i < 50; i++) {
      const posVal = Number(pickLinearScaleValue(reversedScale, "positive"));
      assert.ok([1, 2].includes(posVal), `reversed positive ${posVal} not in [1, 2]`);

      const negVal = Number(pickLinearScaleValue(reversedScale, "negative"));
      assert.ok([4, 5].includes(negVal), `reversed negative ${negVal} not in [4, 5]`);
    }
  });

  // -------------------------------------------------------------------------
  // 3. Per-question overrides
  // -------------------------------------------------------------------------
  it("respects per-question overrides (fixed, pool, mix, random)", async () => {
    const questions = [
      { id: "q1", entryId: "entry.101", title: "Fixed Q", type: "short_text", required: true },
      { id: "q2", entryId: "entry.102", title: "Pool Q", type: "short_text", required: true },
      { id: "q3", entryId: "entry.103", title: "Mix Q", type: "multiple_choice", options: ["Good", "Bad"], required: true },
    ];

    const settings = {
      mix: { positive: 100, neutral: 0, negative: 0 }, // overall positive
      count: 10,
      pools: {
        departmentList: ["Engineering", "Product", "Design"],
      },
      perQuestion: {
        q1: { mode: "fixed", value: "Constant Answer" },
        q2: { mode: "pool", poolName: "departmentList" },
        q3: { mode: "mix", mix: { positive: 0, neutral: 0, negative: 100 } }, // override to 100% negative
      },
    };

    const { responses } = await generateResponses({
      questions,
      count: 10,
      settings,
      anthropicClient: null,
    });

    assert.equal(responses.length, 10);
    for (const r of responses) {
      // Fixed override
      assert.equal(r.answers["entry.101"], "Constant Answer");
      // Pool override
      assert.ok(["Engineering", "Product", "Design"].includes(r.answers["entry.102"]));
    }
  });

  // -------------------------------------------------------------------------
  // 4. Checkbox limits
  // -------------------------------------------------------------------------
  it("checkbox limits never exceed checkboxMax", () => {
    const q = {
      title: "Hobbies",
      options: ["Reading", "Gaming", "Cooking", "Hiking", "Swimming", "Music"],
    };

    for (let i = 0; i < 50; i++) {
      const picked = pickCheckboxOptions(q, "positive", {}, 2);
      assert.ok(Array.isArray(picked));
      assert.ok(picked.length >= 1 && picked.length <= 2, `picked length ${picked.length} > 2`);
      // No duplicate picks in checkboxes
      assert.equal(new Set(picked).size, picked.length);
    }
  });

  // -------------------------------------------------------------------------
  // 5. Required questions never empty, optional skip rate respected
  // -------------------------------------------------------------------------
  it("required questions are never empty, optional questions respect skip rate", async () => {
    const questions = [
      { id: "req1", entryId: "entry.201", title: "Mandatory", type: "short_text", required: true },
      { id: "opt1", entryId: "entry.202", title: "Optional", type: "short_text", required: false },
    ];

    const { responses } = await generateResponses({
      questions,
      count: 100,
      settings: {
        optionalSkipRate: 0.5,
      },
      anthropicClient: null,
    });

    let optionalPresent = 0;
    let optionalSkipped = 0;

    for (const r of responses) {
      assert.ok(
        r.answers["entry.201"] !== undefined && r.answers["entry.201"] !== "",
        "Required question was left empty!"
      );

      if (r.answers["entry.202"] !== undefined) {
        optionalPresent++;
      } else {
        optionalSkipped++;
      }
    }

    // With 50% skip rate over 100, some must be present and some skipped
    assert.ok(optionalPresent > 20, `optionalPresent ${optionalPresent} too low`);
    assert.ok(optionalSkipped > 20, `optionalSkipped ${optionalSkipped} too low`);
  });

  // -------------------------------------------------------------------------
  // 6. JSON-fence stripping and retry logic
  // -------------------------------------------------------------------------
  it("strips markdown fences from JSON output", () => {
    const textWithFences = "```json\n[\"Answer 1\", \"Answer 2\"]\n```";
    const cleaned = stripMarkdownFences(textWithFences);
    assert.equal(cleaned, '["Answer 1", "Answer 2"]');
    assert.deepEqual(JSON.parse(cleaned), ["Answer 1", "Answer 2"]);
  });

  it("retries once when Anthropic returns bad JSON", async () => {
    let callCount = 0;
    const mockClient = {
      messages: {
        create: async () => {
          callCount++;
          if (callCount === 1) {
            // First call fails with invalid JSON
            return { content: [{ text: "Invalid JSON not an array" }] };
          }
          // Second call succeeds
          return { content: [{ text: '["Valid response 1", "Valid response 2"]' }] };
        },
      },
    };

    const question = { title: "Feedback", helpText: "", type: "short_text" };
    const result = await generateBatchedText({
      question,
      sentiment: "positive",
      count: 2,
      anthropicClient: mockClient,
    });

    assert.equal(callCount, 2, "Expected exactly 1 retry (2 total calls)");
    assert.equal(result.usedLLM, true);
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.answers[0], "Valid response 1");
    assert.equal(result.answers[1], "Valid response 2");
  });

  // -------------------------------------------------------------------------
  // 7. Pool no-repeat behavior
  // -------------------------------------------------------------------------
  it("pool draws without repeating until exhausted", () => {
    const manager = new PoolManager({
      testPool: ["Item A", "Item B", "Item C"],
    });

    // Draw 3 times — all 3 items must be unique
    const firstRound = [
      manager.pick("testPool"),
      manager.pick("testPool"),
      manager.pick("testPool"),
    ];
    assert.equal(new Set(firstRound).size, 3);
    assert.ok(firstRound.includes("Item A"));
    assert.ok(firstRound.includes("Item B"));
    assert.ok(firstRound.includes("Item C"));

    // 4th draw resets and returns one of the 3 items
    const fourth = manager.pick("testPool");
    assert.ok(["Item A", "Item B", "Item C"].includes(fourth));
  });

  // -------------------------------------------------------------------------
  // 8. Email generator only uses example.com
  // -------------------------------------------------------------------------
  it("email generator always uses @example.com domain", () => {
    for (let i = 0; i < 100; i++) {
      const email = generateObviousFieldValue("email");
      assert.ok(
        email.endsWith("@example.com"),
        `Email ${email} did not end with @example.com`
      );
      assert.match(email, /^[a-z]+\.[a-z]+\d+@example.com$/);
    }
  });

  it("detects obvious field types from titles", () => {
    assert.equal(detectObviousFieldType("Your Full Name"), "name");
    assert.equal(detectObviousFieldType("Email Address"), "email");
    assert.equal(detectObviousFieldType("Mobile Phone Number"), "phone");
    assert.equal(detectObviousFieldType("Current Age"), "age");
    assert.equal(detectObviousFieldType("City / Town"), "city");
    assert.equal(detectObviousFieldType("What is your favorite color?"), null);
  });
});

