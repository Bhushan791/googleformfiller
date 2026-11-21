/**
 * Custom operational error class.
 * Throw this in controllers / services for expected errors (bad input, not found, etc.).
 * The global error handler knows how to serialise it.
 */
class AppError extends Error {
  /**
   * @param {string} message  Human-readable error message
   * @param {number} statusCode  HTTP status code (default 500)
   * @param {string} [errorCode]  Machine-readable error code (e.g. "FORM_NOT_FOUND")
   */
  constructor(message, statusCode = 500, errorCode = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true; // distinguishes expected from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
