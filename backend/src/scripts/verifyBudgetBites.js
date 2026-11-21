import { parseGoogleForm } from "../services/formParser.js";
import answerCache from "../services/answerCache.js";
import { prewarmForm } from "../services/prewarm.js";
import { generateResponses } from "../services/responseGenerator.js";

const BUDGET_BITES_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSc1c7RCqZBqFbqB7ZziM2bCN-N7cO5ypDIVPSlUrrfp2YXFEQ/viewform";

async function main() {
  console.log("🔍 Parsing BudgetBites Form...");
  const parsed = await parseGoogleForm(BUDGET_BITES_URL);
  console.log(`Title: "${parsed.title}"`);
  console.log(`Description: "${parsed.description}"`);

  const formKey = answerCache.computeFormKey(
    parsed.formId || BUDGET_BITES_URL,
    parsed.questions,
    { audienceMode: "auto" }
  );

  console.log(`\n⏳ Running Prewarm & Audience Auto-Detection (formKey: ${formKey})...`);
  await prewarmForm({
    formKey,
    questions: parsed.questions,
    formContext: { title: parsed.title, description: parsed.description },
    settings: { audienceMode: "auto" },
    skipTopUp: true,
  });

  const status = answerCache.getStatusInfo(formKey);
  console.log(`\n📊 Detection Results:`);
  console.log(`Detected Mode: ${status.detectedMode}`);
  console.log(`Confidence: ${Math.round((status.confidence || 0) * 100)}%`);
  console.log(`Reason: ${status.reason}`);
  console.log(`Audience: ${status.audience}`);

  const feedbackQ =
    parsed.questions.find((q) => q.type === "paragraph") ||
    parsed.questions.find((q) => /feedback|suggestions|thoughts|improve/i.test(q.title)) ||
    parsed.questions[parsed.questions.length - 1];

  console.log(`\nFeedback Question: "${feedbackQ.title}" (${feedbackQ.entryId})`);

  // Generate 6 Feedback answers at 100% negative
  console.log("\n--- Generating 6 answers at 100% Negative ---");
  const negGen = await generateResponses({
    questions: parsed.questions,
    count: 6,
    settings: {
      mix: { positive: 0, neutral: 0, negative: 100 },
      count: 6,
      audienceMode: "auto",
      optionalSkipRate: 0,
    },
    formContext: { title: parsed.title, description: parsed.description },
    formKey,
  });

  const negAnswers = negGen.responses.map((r) => r.answers[feedbackQ.entryId]);

  // Generate 6 Feedback answers at 100% positive
  console.log("\n--- Generating 6 answers at 100% Positive ---");
  const posGen = await generateResponses({
    questions: parsed.questions,
    count: 6,
    settings: {
      mix: { positive: 100, neutral: 0, negative: 0 },
      count: 6,
      audienceMode: "auto",
      optionalSkipRate: 0,
    },
    formContext: { title: parsed.title, description: parsed.description },
    formKey,
  });

  const posAnswers = posGen.responses.map((r) => r.answers[feedbackQ.entryId]);

  console.log("\n=== 6 NEGATIVE FEEDBACK ANSWERS ===");
  negAnswers.forEach((ans, i) => console.log(`${i + 1}. "${ans}"`));

  console.log("\n=== 6 POSITIVE FEEDBACK ANSWERS ===");
  posAnswers.forEach((ans, i) => console.log(`${i + 1}. "${ans}"`));

  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
