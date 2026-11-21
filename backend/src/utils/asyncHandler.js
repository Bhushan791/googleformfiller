/**
 * Wraps an async route handler so rejected promises are forwarded to
 * Express's next() instead of crashing the process.
 *
 * Usage:  router.get("/path", asyncHandler(async (req, res) => { ... }));
 *
 * @param {Function} fn  Async express handler (req, res, next)
 * @returns {Function}   Express-compatible middleware
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;

