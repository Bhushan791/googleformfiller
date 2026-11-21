import rateLimit from "express-rate-limit";

/**
 * Reusable rate limiter — 100 requests per 15-minute window per IP.
 * Applied only to /api routes; /health is exempt.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      code: 429,
      message: "Too many requests — please try again later.",
    },
  },
});

/**
 * Stricter rate limiter for form parsing.
 * 20 requests per 15 minutes per IP.
 */
export const parseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 429,
      message: "Too many parse requests — please try again later.",
    },
  },
});

/**
 * Rate limiter for preview generation.
 * 30 requests per 15 minutes per IP.
 */
export const previewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 429,
      message: "Too many preview requests — please try again later.",
    },
  },
});

// Keep the default export for backwards compatibility with app.js
export default apiLimiter;
