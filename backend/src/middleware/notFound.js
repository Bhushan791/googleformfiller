import AppError from "../utils/AppError.js";

/**
 * Catch-all for undefined routes.
 * Returns the same JSON error shape the global handler uses.
 */
const notFound = (req, res, next) => {
  next(new AppError(`Not Found — ${req.method} ${req.originalUrl}`, 404));
};

export default notFound;

