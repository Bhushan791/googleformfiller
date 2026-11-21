import { Router } from "express";
import healthRoutes from "./health.routes.js";
import formRoutes from "./form.routes.js";
import jobRoutes from "./job.routes.js";
import llmRoutes from "./llm.routes.js";
import jobStore from "../services/jobStore.js";
import { getLLMStatus } from "../services/llm/index.js";

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

/** Global system status without exposing credentials or internal URLs */
router.get("/status", async (_req, res) => {
  const rawRedis = jobStore.getStatus();
  const redis = rawRedis === "connected" ? "connected" : "memory";
  const rawLlm = await getLLMStatus();
  const llm = (rawLlm.providers || []).map((p) => ({
    provider: p.provider,
    status: p.status,
  }));

  res.json({
    redis,
    llm,
    uptime: Math.floor(process.uptime()),
    version: "1.0.0",
  });
});

/** Form parsing & preview routes */
router.use("/", formRoutes);

/** Job management routes mounted at /api/jobs */
router.use("/jobs", jobRoutes);

/** LLM status routes mounted at /api/llm */
router.use("/llm", llmRoutes);

export { healthRoutes };
export default router;
