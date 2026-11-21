import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import config, { normalizeOrigin } from "./config/env.js";
import apiRoutes, { healthRoutes } from "./routes/index.js";
import apiLimiter from "./middleware/rateLimiter.js";
import accessCodeMiddleware from "./middleware/accessCode.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";

/**
 * Create and configure the Express application.
 * Exported separately from server.js so it can be tested without starting a listener.
 */
const app = express();

// ---------------------------------------------------------------------------
// Trust the first proxy (Render, Heroku, etc.) so rate-limiting uses the
// real client IP instead of the proxy's.
// ---------------------------------------------------------------------------
app.set("trust proxy", 1);

// ---------------------------------------------------------------------------
// CORS — allow origins from FRONTEND_URL (comma-separated, normalized).
// In non-production, also allow the Vite dev server default.
// ---------------------------------------------------------------------------
const allowedOrigins = config.FRONTEND_URL.split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

if (config.NODE_ENV !== "production") {
  const devOrigin = normalizeOrigin("http://localhost:5173");
  if (!allowedOrigins.includes(devOrigin)) {
    allowedOrigins.push(devOrigin);
  }
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no Origin header (curl, server-to-server, etc.)
      if (!origin) {
        return callback(null, true);
      }
      const normalized = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Security & logging
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(morgan(config.NODE_ENV === "production" ? "combined" : "dev"));

// ---------------------------------------------------------------------------
// Body parsers (JSON body limit 1mb)
// ---------------------------------------------------------------------------
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check — fast, no DB/LLM dependency, exempt from rate limiter & auth
app.use("/health", healthRoutes);

// All /api routes — rate-limited and access-code checked
app.use("/api", apiLimiter, accessCodeMiddleware, apiRoutes);

// ---------------------------------------------------------------------------
// Error handling (must be registered AFTER routes)
// ---------------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

export default app;

