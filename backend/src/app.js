import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import config from "./config/env.js";
import apiRoutes, { healthRoutes } from "./routes/index.js";
import apiLimiter from "./middleware/rateLimiter.js";
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
// CORS — allow origins from FRONTEND_URL (comma-separated).
// In non-production, also allow the Vite dev server default.
// ---------------------------------------------------------------------------
const allowedOrigins = config.FRONTEND_URL.split(",").map((o) => o.trim());

if (config.NODE_ENV !== "production") {
  if (!allowedOrigins.includes("http://localhost:5173")) {
    allowedOrigins.push("http://localhost:5173");
  }
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no Origin header (curl, server-to-server, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
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
// Body parsers
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check — no rate limiter
app.use("/health", healthRoutes);

// All /api routes — rate-limited
app.use("/api", apiLimiter, apiRoutes);

// ---------------------------------------------------------------------------
// Error handling (must be registered AFTER routes)
// ---------------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

export default app;

