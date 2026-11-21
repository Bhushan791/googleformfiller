import crypto from "node:crypto";
import config from "../config/env.js";

/**
 * Creates access code middleware with optional code getter for testability.
 */
export function createAccessCodeMiddleware(getCode = () => config.ACCESS_CODE) {
  return function accessCodeMiddleware(req, res, next) {
    const requiredCode = getCode();

    // If not configured, allow all requests
    if (!requiredCode || requiredCode.trim() === "") {
      return next();
    }

    // Preflight requests should not be blocked
    if (req.method === "OPTIONS") {
      return next();
    }

    const provided = req.headers["x-access-code"];

    if (typeof provided !== "string" || !provided) {
      return res.status(401).json({
        success: false,
        error: {
          code: 401,
          errorCode: "UNAUTHORIZED",
          message: "Invalid or missing access code.",
        },
      });
    }

    // Constant-time compare using SHA-256 hash digests
    const expectedHash = crypto
      .createHash("sha256")
      .update(requiredCode)
      .digest();
    const providedHash = crypto
      .createHash("sha256")
      .update(provided)
      .digest();

    if (!crypto.timingSafeEqual(expectedHash, providedHash)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 401,
          errorCode: "UNAUTHORIZED",
          message: "Invalid or missing access code.",
        },
      });
    }

    next();
  };
}

const defaultMiddleware = createAccessCodeMiddleware();
export default defaultMiddleware;
