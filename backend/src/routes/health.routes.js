import { Router } from "express";
import getHealth from "../controllers/health.controller.js";

const router = Router();

/** Liveness / readiness probe — exempt from rate limiting. */
router.get("/", getHealth);

export default router;

