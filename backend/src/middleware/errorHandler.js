import { ZodError } from "zod";

/**
 * Global Express error handler.
 * Normalises every error into:
 *   { success: false, error: { code, message, errorCode? } }
 *
 * Handles:
 *   • AppError   — operational errors we threw on purpose
 *   • ZodError   — validation failures
 *   • Everything else — unexpected / programming errors
 *
 * Stack traces are hidden in production.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const isProduction = process.env.NODE_ENV === "production";

  // --- Zod validation errors ---------------------------------------------------
  if (err instanceof ZodError) {
    const message = err.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");

    return res.status(400).json({
      success: false,
      error: {
        code: 400,
        errorCode: "VALIDATION_ERROR",
        message: `Validation error — ${message}`,
      },
    });
  }

  // --- Operational AppError ----------------------------------------------------
  const statusCode = err.statusCode || 500;
  const message =
    err.isOperational || !isProduction
      ? err.message
      : "Internal server error";

  // Log unexpected errors so we can debug them
  if (!err.isOperational) {
    console.error("💥  Unexpected error:", err);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode,
      ...(err.errorCode ? { errorCode: err.errorCode } : {}),
      message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
};

export default errorHandler;
