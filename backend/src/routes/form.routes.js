import { Router } from "express";
import { parseForm, previewResponses } from "../controllers/form.controller.js";
import { parseLimiter, previewLimiter } from "../middleware/rateLimiter.js";

const router = Router();

/** POST /api/parse-form — parse a public Google Form URL */
router.post("/parse-form", parseLimiter, parseForm);

/** POST /api/preview — generate 5 preview responses (dry run) */
router.post("/preview", previewLimiter, previewResponses);

export default router;
