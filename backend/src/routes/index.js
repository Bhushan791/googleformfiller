import { Router } from "express";
import healthRoutes from "./health.routes.js";
import formRoutes from "./form.routes.js";
import jobRoutes from "./job.routes.js";
import llmRoutes from "./llm.routes.js";

const router = Router();

/**
 * Mount all route groups here.
 * /health is mounted at the app level (exempt from rate limiting),
 * so this file handles /api sub-routes only.
 */

/** Placeholder ping to confirm /api routing + rate limiter work. */
router.get("/ping", (_req, res) => {
  res.json({ message: "pong" });
});

/** Form parsing & preview routes */
router.use("/", formRoutes);

/** Job management routes mounted at /api/jobs */
router.use("/jobs", jobRoutes);

/** LLM status routes mounted at /api/llm */
router.use("/llm", llmRoutes);

export { healthRoutes };
export default router;
