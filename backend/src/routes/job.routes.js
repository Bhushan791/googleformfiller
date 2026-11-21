import { Router } from "express";
import {
  createJob,
  getJobStatus,
  pauseJob,
  resumeJob,
  cancelJob,
  exportJobCsv,
} from "../controllers/job.controller.js";
import { jobCreationLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/", jobCreationLimiter, createJob);
router.get("/:id", getJobStatus);
router.post("/:id/pause", pauseJob);
router.post("/:id/resume", resumeJob);
router.post("/:id/cancel", cancelJob);
router.get("/:id/export", exportJobCsv);

export default router;

