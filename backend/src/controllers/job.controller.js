import crypto from "node:crypto";
import { z } from "zod";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import jobStore, { hashIp } from "../services/jobStore.js";
import jobWorker from "../services/jobWorker.js";
import { parseGoogleForm } from "../services/formParser.js";
import { validateActionUrl } from "../services/submitter.js";
import {
  generateResponses,
  generatorSettingsSchema,
} from "../services/responseGenerator.js";
import answerCache from "../services/answerCache.js";
import { buildJobCsv } from "../utils/csvExport.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createJobSchema = z.object({
  formUrl: z.string().min(1, "Form URL is required").url("Must be a valid URL"),
  count: z.number().int().min(1, "Count must be at least 1").max(500, "Maximum count is 500").default(10),
  settings: generatorSettingsSchema.optional().default({}),
  delay: z
    .object({
      minMs: z.number().int().min(1000, "Minimum delay is 1000ms").default(2000),
      maxMs: z.number().int().min(1000, "Maximum delay must be at least 1000ms").default(6000),
    })
    .refine((d) => d.maxMs >= d.minMs, "maxMs must be greater than or equal to minMs")
    .default({ minMs: 2000, maxMs: 6000 }),
});

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /api/jobs
 * Creates a new submission job after validating form and limits.
 */
export const createJob = asyncHandler(async (req, res) => {
  const { formUrl, count, settings, delay } = createJobSchema.parse(req.body);

  const clientIp = req.ip || req.connection?.remoteAddress || "127.0.0.1";
  const ipHash = hashIp(clientIp);

  // 1. Guardrail: Job creation rate limit (5 per hour per IP)
  const hourlyCount = await jobStore.getCreationCountLastHour(ipHash);
  if (hourlyCount >= 5) {
    throw new AppError(
      "Job creation limit reached (maximum 5 jobs per hour per IP).",
      429,
      "RATE_LIMIT_EXCEEDED"
    );
  }

  // 2. Guardrail: 1 active job per IP
  const activeForIp = await jobStore.getActiveJobsForIp(ipHash);
  if (activeForIp.length > 0) {
    throw new AppError(
      "You already have an active job running. Please wait for it to complete or cancel it before starting another.",
      429,
      "ACTIVE_JOB_LIMIT"
    );
  }

  // 3. Guardrail: Max 2 active jobs globally
  const globalActive = await jobStore.getActiveJobsCount();
  if (globalActive >= 2) {
    throw new AppError(
      "Server is currently at capacity (maximum 2 concurrent jobs globally). Please try again shortly.",
      429,
      "GLOBAL_JOB_LIMIT"
    );
  }

  // 4. Server-side form re-parse (do not trust client-supplied questions)
  const parsedForm = await parseGoogleForm(formUrl);

  if (!parsedForm.actionUrl) {
    throw new AppError(
      "Could not determine form submission URL.",
      400,
      "INVALID_ACTION_URL"
    );
  }

  // 5. Re-validate action URL host and pattern
  validateActionUrl(parsedForm.actionUrl);

  // 6. Generate the first chunk of 10 responses immediately from cache
  const formKey = answerCache.computeFormKey(
    parsedForm.formId || parsedForm.actionUrl,
    parsedForm.questions,
    settings
  );
  const initialChunkSize = Math.min(10, count);

  const { responses: initialResponses, metadata: genMeta } = await generateResponses({
    questions: parsedForm.questions,
    count: initialChunkSize,
    settings: {
      ...settings,
      count: initialChunkSize,
    },
    formContext: {
      title: parsedForm.title,
      description: parsedForm.description,
    },
    formKey,
  });

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newJob = {
    id: jobId,
    formUrl,
    actionUrl: parsedForm.actionUrl,
    status: "queued",
    total: count, // requested count
    submitted: 0,
    failed: 0,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    error: null,
    ipHash,
    delay,
    questions: parsedForm.questions,
    hiddenFields: parsedForm.hiddenFields || {},
    settings,
    formKey,
    formContext: {
      title: parsedForm.title,
      description: parsedForm.description,
    },
    responses: initialResponses,
    results: [],
    warnings: genMeta?.warnings || [],
  };

  await jobStore.createJob(newJob);

  // Start processing in background worker loop
  jobWorker.startJob(jobId);

  res.status(201).json({
    success: true,
    data: {
      jobId,
      status: "queued",
      total: count,
    },
  });
});

/**
 * GET /api/jobs/:id
 * Returns current job status and progress (omits full responses array).
 */
export const getJobStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = await jobStore.getJob(id);

  if (!job) {
    throw new AppError("Job not found.", 404, "JOB_NOT_FOUND");
  }

  const remaining = Math.max(0, job.total - job.submitted - job.failed);

  // Estimate remaining time
  const avgDelaySeconds = ((job.delay?.minMs || 2000) + (job.delay?.maxMs || 6000)) / 2000;
  const etaSeconds = job.status === "running" ? Math.round(remaining * avgDelaySeconds) : 0;

  // Extract last 5 errors
  const recentErrors = (job.results || [])
    .filter((r) => r.status === "failed")
    .slice(-5)
    .map((r) => ({
      index: r.index,
      error: r.error || "Unknown error",
      submittedAt: r.submittedAt,
    }));

  res.json({
    success: true,
    data: {
      id: job.id,
      status: job.status,
      total: job.total,
      submitted: job.submitted,
      failed: job.failed,
      remaining,
      etaSeconds,
      error: job.error,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      recentErrors,
    },
  });
});

/**
 * POST /api/jobs/:id/pause
 */
export const pauseJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = await jobStore.getJob(id);

  if (!job) {
    throw new AppError("Job not found.", 404, "JOB_NOT_FOUND");
  }

  if (job.status === "running" || job.status === "queued") {
    await jobStore.updateJob(id, { status: "paused" });
  }

  res.json({ success: true, message: "Job paused." });
});

/**
 * POST /api/jobs/:id/resume
 */
export const resumeJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = await jobStore.getJob(id);

  if (!job) {
    throw new AppError("Job not found.", 404, "JOB_NOT_FOUND");
  }

  if (job.status === "paused") {
    await jobStore.updateJob(id, { status: "running", error: null });
    jobWorker.startJob(id);
  }

  res.json({ success: true, message: "Job resumed." });
});

/**
 * POST /api/jobs/:id/cancel
 */
export const cancelJob = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = await jobStore.getJob(id);

  if (!job) {
    throw new AppError("Job not found.", 404, "JOB_NOT_FOUND");
  }

  if (job.status !== "completed" && job.status !== "cancelled") {
    await jobStore.updateJob(id, {
      status: "cancelled",
      finishedAt: new Date().toISOString(),
    });
    await jobStore.setJobTTL(id, 86400);
  }

  res.json({ success: true, message: "Job cancelled." });
});

/**
 * GET /api/jobs/:id/export
 * Downloads the job's generated and submitted responses as a CSV.
 */
export const exportJobCsv = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const job = await jobStore.getJob(id);

  if (!job) {
    throw new AppError("Job not found.", 404, "JOB_NOT_FOUND");
  }

  const csvContent = buildJobCsv(job);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="autofillr_job_${id.slice(0, 8)}.csv"`
  );

  res.send(csvContent);
});

