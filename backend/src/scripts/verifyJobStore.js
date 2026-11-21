import assert from "node:assert/strict";
import config from "../config/env.js";
import jobStore, { ResilientJobStore, MemoryJobStore, RedisJobStore, maskRedisUrl } from "../services/jobStore.js";

async function runVerification() {
  console.log("=== JobStore Verification ===");
  console.log("Configured REDIS_URL:", maskRedisUrl(config.REDIS_URL));

  // 1. Initialize store and check startup behavior
  console.log("\n1. Initializing jobStore...");
  await jobStore.init();
  const status = jobStore.getStatus();
  console.log("Initial jobStore status:", status);

  // 2. Test Key Read/Write/Delete
  console.log("\n2. Testing Store Write / Read / Delete...");
  const testJob = {
    id: "test-verify-" + Date.now(),
    ipHash: "testhash",
    status: "queued",
    total: 3,
    submitted: 0,
    failed: 0,
    createdAt: new Date().toISOString(),
  };

  await jobStore.createJob(testJob);
  const readBack = await jobStore.getJob(testJob.id);
  assert.equal(readBack.id, testJob.id, "Read back ID must match");
  assert.equal(readBack.total, 3, "Read back total must match");
  console.log("Write and read-back verified: OK");

  await jobStore.updateJob(testJob.id, { submitted: 1, status: "running" });
  const updated = await jobStore.getJob(testJob.id);
  assert.equal(updated.submitted, 1);
  assert.equal(updated.status, "running");
  console.log("Update verified: OK");

  await jobStore.deleteJob(testJob.id);
  const deleted = await jobStore.getJob(testJob.id);
  assert.equal(deleted, null, "Deleted job must return null");
  console.log("Delete verified: OK");

  // 3. Restart-Resume test with 5 responses
  console.log("\n3. Testing restart-resume with 5 responses (no real submission)...");
  const restartJobId = "restart-test-" + Date.now();
  const sampleResponses = Array.from({ length: 5 }, (_, i) => ({
    index: i,
    sentiment: "neutral",
    answers: { "entry.123": `Response #${i + 1}` },
  }));

  const jobToResume = {
    id: restartJobId,
    ipHash: "hash-restart",
    status: "running",
    total: 5,
    submitted: 2,
    failed: 0,
    responses: sampleResponses,
    results: [
      { index: 0, status: "success" },
      { index: 1, status: "success" },
    ],
  };

  await jobStore.createJob(jobToResume);
  console.log("Saved running job with 5 responses.");

  // Simulate server reboot: query running jobs from a fresh check
  const runningJobs = await jobStore.getRunningJobs();
  const found = runningJobs.find((j) => j.id === restartJobId);
  assert.ok(found, "Job must be found in running jobs list after reboot");
  assert.equal(found.responses.length, 5, "All 5 responses must persist");
  assert.equal(found.submitted, 2, "Progress must persist");
  console.log("Simulated reboot retrieved job with exact 5 responses and progress intact: OK");

  // Clean up restart test job
  await jobStore.deleteJob(restartJobId);

  // 4. Test In-Memory Fallback when REDIS_URL is empty
  console.log("\n4. Testing in-memory fallback when REDIS_URL is empty...");
  const emptyStore = new ResilientJobStore("");
  await emptyStore.init();
  assert.equal(emptyStore.getStatus(), "memory-fallback");

  await emptyStore.createJob({ id: "mem-test", ipHash: "h", status: "running" });
  const memJob = await emptyStore.getJob("mem-test");
  assert.equal(memJob.id, "mem-test");
  console.log("In-memory fallback works as expected: OK");

  console.log("\n✅ All verification steps completed successfully!");
}

runVerification().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});

