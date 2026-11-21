import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeOrigin } from "./config/env.js";
import { createAccessCodeMiddleware } from "./middleware/accessCode.js";

describe("Production Readiness & Security Tests", () => {
  describe("normalizeOrigin", () => {
    it("strips trailing slashes and extracts origin", () => {
      assert.equal(normalizeOrigin("https://formbot.vercel.app/"), "https://formbot.vercel.app");
      assert.equal(normalizeOrigin("https://formbot.vercel.app///"), "https://formbot.vercel.app");
      assert.equal(normalizeOrigin("http://localhost:5173/path/to/page"), "http://localhost:5173");
      assert.equal(normalizeOrigin("  https://my-domain.com  "), "https://my-domain.com");
    });

    it("handles empty or invalid inputs gracefully", () => {
      assert.equal(normalizeOrigin(""), "");
      assert.equal(normalizeOrigin(null), "");
      assert.equal(normalizeOrigin(undefined), "");
    });
  });

  describe("accessCodeMiddleware", () => {
    it("passes through if ACCESS_CODE is unset or empty", (t, done) => {
      const middleware = createAccessCodeMiddleware(() => undefined);
      const req = { headers: {} };
      const res = {};
      middleware(req, res, () => {
        done();
      });
    });

    it("passes through for OPTIONS preflight requests even if ACCESS_CODE is set", (t, done) => {
      const middleware = createAccessCodeMiddleware(() => "supersecret");
      const req = { method: "OPTIONS", headers: {} };
      const res = {};
      middleware(req, res, () => {
        done();
      });
    });

    it("rejects with 401 when ACCESS_CODE is set and x-access-code header is missing", () => {
      const middleware = createAccessCodeMiddleware(() => "supersecret");
      const req = { method: "POST", headers: {} };
      let statusCode = null;
      let jsonPayload = null;

      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(payload) {
          jsonPayload = payload;
          return this;
        },
      };

      middleware(req, res, () => {});

      assert.equal(statusCode, 401);
      assert.equal(jsonPayload.success, false);
      assert.equal(jsonPayload.error.errorCode, "UNAUTHORIZED");
    });

    it("rejects with 401 when x-access-code header is incorrect", () => {
      const middleware = createAccessCodeMiddleware(() => "supersecret");
      const req = { method: "POST", headers: { "x-access-code": "wrongcode" } };
      let statusCode = null;
      let jsonPayload = null;

      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(payload) {
          jsonPayload = payload;
          return this;
        },
      };

      middleware(req, res, () => {});

      assert.equal(statusCode, 401);
      assert.equal(jsonPayload.success, false);
      assert.equal(jsonPayload.error.errorCode, "UNAUTHORIZED");
    });

    it("passes through when x-access-code header matches", (t, done) => {
      const middleware = createAccessCodeMiddleware(() => "supersecret");
      const req = { method: "POST", headers: { "x-access-code": "supersecret" } };
      const res = {};

      middleware(req, res, () => {
        done();
      });
    });
  });
});
