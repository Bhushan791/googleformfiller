import asyncHandler from "../utils/asyncHandler.js";
import { getLLMStatus } from "../services/llm/index.js";

/**
 * GET /api/llm/status
 * Returns LLM status without leaking API keys.
 * Query parameter ?refresh=1 forces a rate-limited connectivity re-test.
 */
export const getStatus = asyncHandler(async (req, res) => {
  const refresh = req.query.refresh === "1" || req.query.refresh === "true";
  const status = await getLLMStatus({ refresh });
  res.json({
    success: true,
    data: status,
  });
});

