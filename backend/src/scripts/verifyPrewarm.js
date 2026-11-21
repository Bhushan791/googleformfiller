import { parseGoogleForm } from "../services/formParser.js";
import answerCache from "../services/answerCache.js";
import { prewarmForm } from "../services/prewarm.js";
import { generateResponses } from "../services/responseGenerator.js";
import { fetchFormMetadata, buildSubmissionPayload, submitSingleResponse } from "../services/submitter.js";

const TEST_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSc1c7RCqZBqFbqB7ZziM2bCN-N7cO5ypDIVPSlUrrfp2YXFEQ/viewform";

async function main() {
  console.log("🚀 Testing BudgetBites form with real keys & prewarming...");

  // 1. Parse form
  const parseStart = Date.now();
  const parsed = await parseGoogleForm(TEST_FORM_URL);
  const formKey = answerCache.computeFormKey(parsed.formId || TEST_FORM_URL, parsed.questions);
  console.log(`📋 Form parsed in ${Date.now() - parseStart}ms. Title: "${parsed.title}", formKey: ${formKey}`);

  // 2. Prewarm form in background and measure time until status === ready
  const prewarmStart = Date.now();
  const prewarmPromise = prewarmForm({
    formKey,
    questions: parsed.questions,
    formContext: { title: parsed.title, description: parsed.description },
  });

  // Poll status until ready
  let readyStatus;
  while (true) {
    readyStatus = answerCache.getStatusInfo(formKey);
    if (readyStatus.status === "ready" || readyStatus.status === "partial" || readyStatus.status === "failed") {
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  const timeToReady = Date.now() - prewarmStart;
  console.log(`⚡ Prewarm status: ${readyStatus.status} (${readyStatus.ready}/${readyStatus.total} ready) in ${timeToReady}ms`);

  // 3. Dry run latency (preview 5 responses using prewarmed cache)
  const dryRunStart = Date.now();
  const dryRun = await generateResponses({
    questions: parsed.questions,
    count: 5,
    settings: { count: 5 },
    formContext: { title: parsed.title, description: parsed.description },
    formKey,
  });
  const dryRunLatency = Date.now() - dryRunStart;
  console.log(`✨ Dry run completed in ${dryRunLatency}ms (usedLLM: ${dryRun.metadata.usedLLM}, fallbackUsed: ${dryRun.metadata.fallbackUsed})`);

  // 4. Job start -> first submission latency
  const jobStart = Date.now();
  const { responses: initialChunk } = await generateResponses({
    questions: parsed.questions,
    count: 10,
    settings: { count: 10 },
    formContext: { title: parsed.title, description: parsed.description },
    formKey,
  });
  const chunkGenTime = Date.now() - jobStart;
  console.log(`📦 Job initial chunk of 10 created in ${chunkGenTime}ms`);

  // Fetch metadata & submit first response
  const metaStart = Date.now();
  const metadata = await fetchFormMetadata(TEST_FORM_URL);
  const payload = buildSubmissionPayload({
    answers: initialChunk[0].answers,
    questions: parsed.questions,
    metadata,
  });
  const subResult = await submitSingleResponse({
    actionUrl: parsed.actionUrl,
    payload,
  });
  const totalSubmissionLatency = Date.now() - jobStart;
  console.log(`🎯 First response submitted in ${totalSubmissionLatency}ms (status: ${subResult.success ? "success" : "failed"})`);

  console.log("\n=== VERIFICATION METRICS ===");
  console.log(`Time form load -> ready: ${timeToReady}ms`);
  console.log(`Dry run latency after ready: ${dryRunLatency}ms`);
  console.log(`Job start -> first submission: ${totalSubmissionLatency}ms`);

  // Extract 3 sample answers from the open text Feedback question
  const feedbackQ =
    parsed.questions.find((q) => q.type === "paragraph") ||
    parsed.questions.find((q) => /suggestions|feedback|improve/i.test(q.title));

  const sampleAnswers = [];
  if (feedbackQ) {
    for (const r of [...dryRun.responses, ...initialChunk]) {
      const val = r.answers?.[feedbackQ.entryId];
      if (val && !sampleAnswers.includes(val)) {
        sampleAnswers.push(val);
        if (sampleAnswers.length >= 3) break;
      }
    }
  }

  console.log(`\n=== 3 SAMPLE FEEDBACK ANSWERS ("${feedbackQ?.title}") ===`);
  sampleAnswers.forEach((ans, idx) => console.log(`${idx + 1}. "${ans}"`));

  // Clean up
  await prewarmPromise.catch(() => {});
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

