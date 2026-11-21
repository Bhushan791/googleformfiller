import jobStore from "./jobStore.js";
import {
  fetchFormMetadata,
  buildSubmissionPayload,
  submitSingleResponse,
} from "./submitter.js";

class JobWorker {
  constructor() {
    this.activeJobLoops = new Set(); // job IDs currently in process loop
    this.isShuttingDown = false;
  }

  /**
   * Starts processing a job if not already running in this process.
   */
  startJob(jobId) {
    if (this.activeJobLoops.has(jobId)) return;
    this.processJobLoop(jobId).catch((err) => {
      console.error(`💥 Unhandled error in job worker loop for ${jobId}:`, err);
    });
  }

  /**
   * Boot-time recovery: resumes any jobs marked as "running" when the server started.
   */
  async resumeRunningJobsOnBoot() {
    try {
      const running = await jobStore.getRunningJobs();
      for (const j of running) {
        console.log(`🔄 Resuming running job on boot: ${j.id}`);
        this.startJob(j.id);
      }
    } catch (err) {
      console.warn("⚠️ Could not check running jobs on boot:", err.message);
    }
  }

  /**
   * Main processing loop for a single job.
   */
  async processJobLoop(jobId) {
    this.activeJobLoops.add(jobId);

    try {
      let job = await jobStore.getJob(jobId);
      if (!job) return;

      if (job.status === "queued") {
        job = await jobStore.updateJob(jobId, {
          status: "running",
          startedAt: job.startedAt || new Date().toISOString(),
        });
      }

      // Fetch metadata (hidden fields, sentinels, pageHistory) once per job
      let metadata;
      try {
        metadata = await fetchFormMetadata(job.formUrl);
      } catch (err) {
        await jobStore.updateJob(jobId, {
          status: "failed",
          error: `Could not fetch form metadata: ${err.message}`,
          finishedAt: new Date().toISOString(),
        });
        await jobStore.setJobTTL(jobId, 86400);
        return;
      }

      let consecutiveFailures = 0;

      // Process one response at a time
      while (true) {
        // Graceful shutdown check
        if (this.isShuttingDown) {
          console.log(`⏳ Shutdown in progress, suspending job ${jobId}`);
          break;
        }

        // Re-read latest job state to observe pause / cancel promptly
        job = await jobStore.getJob(jobId);
        if (!job) break;

        if (job.status === "cancelled") {
          console.log(`⏹️ Job ${jobId} was cancelled.`);
          break;
        }

        if (job.status === "paused") {
          // Sleep and re-check status every second
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        if (job.status !== "running") {
          break;
        }

        // Check if all responses processed
        const nextIndex = job.submitted + job.failed;
        if (nextIndex >= job.total) {
          const finalStatus = job.submitted > 0 ? "completed" : "failed";
          await jobStore.updateJob(jobId, {
            status: finalStatus,
            finishedAt: new Date().toISOString(),
          });
          await jobStore.setJobTTL(jobId, 86400);
          console.log(`🎉 Job ${jobId} finished with status: ${finalStatus}`);
          break;
        }

        const currentResponse = job.responses[nextIndex];
        const payload = buildSubmissionPayload({
          answers: currentResponse.answers,
          questions: job.questions,
          metadata,
        });

        // Submit single response
        const result = await submitSingleResponse({
          actionUrl: job.actionUrl,
          payload,
        });

        const now = new Date().toISOString();
        const responseResult = {
          index: nextIndex,
          status: result.success ? "success" : "failed",
          attempts: result.attempts,
          error: result.error,
          submittedAt: now,
        };

        const updatedResults = [...(job.results || []), responseResult];
        const submitted = job.submitted + (result.success ? 1 : 0);
        const failed = job.failed + (result.success ? 0 : 1);

        // Check fatal errors (LOGIN_REQUIRED, FORM_CLOSED, BLOCKED)
        if (result.fatalError) {
          console.error(`🚨 Fatal error encountered on job ${jobId}: ${result.fatalError}`);
          await jobStore.updateJob(jobId, {
            status: "failed",
            error: result.fatalError,
            submitted,
            failed,
            results: updatedResults,
            finishedAt: now,
          });
          await jobStore.setJobTTL(jobId, 86400);
          break;
        }

        // Check consecutive failure limit (5 consecutive failures pause the job)
        if (result.success) {
          consecutiveFailures = 0;
        } else {
          consecutiveFailures++;
          if (consecutiveFailures >= 5) {
            console.warn(`⚠️ 5 consecutive failures on job ${jobId} — pausing job.`);
            await jobStore.updateJob(jobId, {
              status: "paused",
              error: "TOO_MANY_FAILURES",
              submitted,
              failed,
              results: updatedResults,
            });
            continue;
          }
        }

        // Save progress to store
        job = await jobStore.updateJob(jobId, {
          submitted,
          failed,
          results: updatedResults,
        });

        // Check if finished
        if (submitted + failed >= job.total) {
          const finalStatus = submitted > 0 ? "completed" : "failed";
          await jobStore.updateJob(jobId, {
            status: finalStatus,
            finishedAt: new Date().toISOString(),
          });
          await jobStore.setJobTTL(jobId, 86400);
          break;
        }

        // Randomized delay between submissions in [minMs, maxMs]
        const minMs = job.delay?.minMs ?? 2000;
        const maxMs = job.delay?.maxMs ?? 6000;
        const delay = minMs + Math.random() * (maxMs - minMs);
        await new Promise((r) => setTimeout(r, delay));
      }
    } finally {
      this.activeJobLoops.delete(jobId);
    }
  }

  /**
   * Graceful shutdown handler.
   */
  async handleShutdown() {
    this.isShuttingDown = true;
    console.log("🛑 JobWorker: shutting down, saving running states...");
  }
}

const workerInstance = new JobWorker();
export default workerInstance;

