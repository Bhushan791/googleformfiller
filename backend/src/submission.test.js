import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  validateActionUrl,
  buildSubmissionPayload,
  evaluateSubmissionResponse,
  submitSingleResponse,
} from "./services/submitter.js";
import { escapeCsvCell, buildJobCsv } from "./utils/csvExport.js";
import { MemoryJobStore, RedisJobStore, hashIp } from "./services/jobStore.js";

describe("Submission Engine Tests", () => {
  describe("validateActionUrl", () => {
    test("accepts valid Google Form response URL", () => {
      const validUrl =
        "https://docs.google.com/forms/d/e/1FAIpQLSd9_sampleFormId123456789/formResponse";
      assert.doesNotThrow(() => validateActionUrl(validUrl));
    });

    test("rejects non-HTTPS URL", () => {
      const httpUrl =
        "http://docs.google.com/forms/d/e/1FAIpQLSd9_sampleFormId123456789/formResponse";
      assert.throws(
        () => validateActionUrl(httpUrl),
        (err) =>
          err.name === "AppError" &&
          err.statusCode === 400 &&
          err.errorCode === "HOST_NOT_ALLOWED"
      );
    });

    test("rejects non-Google hosts (SSRF prevention)", () => {
      const evilUrl =
        "https://malicious-site.com/forms/d/e/1FAIpQLSd9_sampleFormId123456789/formResponse";
      assert.throws(
        () => validateActionUrl(evilUrl),
        (err) =>
          err.name === "AppError" &&
          err.statusCode === 400 &&
          err.errorCode === "HOST_NOT_ALLOWED"
      );
    });

    test("rejects viewform URL instead of formResponse", () => {
      const viewUrl =
        "https://docs.google.com/forms/d/e/1FAIpQLSd9_sampleFormId123456789/viewform";
      assert.throws(
        () => validateActionUrl(viewUrl),
        (err) =>
          err.name === "AppError" &&
          err.statusCode === 400 &&
          err.errorCode === "INVALID_URL"
      );
    });

    test("rejects malformed action URL path", () => {
      const badPath = "https://docs.google.com/forms/random/path";
      assert.throws(
        () => validateActionUrl(badPath),
        (err) =>
          err.name === "AppError" &&
          err.statusCode === 400 &&
          err.errorCode === "INVALID_URL"
      );
    });
  });

  describe("buildSubmissionPayload", () => {
    const questions = [
      { id: "q1", entryId: "entry.1001", type: "short_text", title: "Name" },
      { id: "q2", entryId: "entry.1002", type: "checkboxes", title: "Hobbies" },
      { id: "q3", entryId: "entry.1003", type: "date", title: "Birthdate" },
      { id: "q4", entryId: "entry.1004", type: "time", title: "Appointment Time" },
    ];

    test("encodes hidden fields, pageHistory, dates, times, checkboxes, and sentinels", () => {
      const answers = {
        "entry.1001": "Alice",
        "entry.1002": ["Reading", "Hiking"],
        "entry.1003": "1995-08-25",
        "entry.1004": "14:30",
      };

      const metadata = {
        hiddenFields: {
          fvv: "1",
          fbzx: "-123456789",
          pageHistory: "0,1,2",
          draftResponse: "draft123",
        },
        sentinels: new Set(["entry.1002_sentinel"]),
        pageHistory: "0,1,2",
      };

      const payload = buildSubmissionPayload({ answers, questions, metadata });
      const params = new URLSearchParams(payload);

      // Hidden fields
      assert.equal(params.get("fvv"), "1");
      assert.equal(params.get("fbzx"), "-123456789");
      assert.equal(params.get("pageHistory"), "0,1,2");
      assert.equal(params.get("draftResponse"), "draft123");

      // Short text
      assert.equal(params.get("entry.1001"), "Alice");

      // Checkboxes: multiple values for entry.1002
      assert.deepEqual(params.getAll("entry.1002"), ["Reading", "Hiking"]);
      // Sentinel for checkboxes
      assert.equal(params.get("entry.1002_sentinel"), "");

      // Date decomposed
      assert.equal(params.get("entry.1003_year"), "1995");
      assert.equal(params.get("entry.1003_month"), "08");
      assert.equal(params.get("entry.1003_day"), "25");

      // Time decomposed
      assert.equal(params.get("entry.1004_hour"), "14");
      assert.equal(params.get("entry.1004_minute"), "30");
    });

    test("includes tag and submissionTimestamp in submission payload for Google Forms bot protection", () => {
      const answers = { "entry.1001": "Bob" };
      const metadata = {
        hiddenFields: {
          fvv: "1",
          fbzx: "-9999",
          tag: "security_tag_token_abc==",
          submissionTimestamp: "-1",
        },
      };

      const payload = buildSubmissionPayload({ answers, questions, metadata });
      const params = new URLSearchParams(payload);

      assert.equal(params.get("tag"), "security_tag_token_abc==");
      assert.equal(params.get("submissionTimestamp"), "-1");
      assert.equal(params.get("fbzx"), "-9999");
      assert.equal(params.get("entry.1001"), "Bob");
    });
  });

  describe("evaluateSubmissionResponse", () => {
    test("identifies standard success confirmation message", async () => {
      const mockRes = {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () =>
          "<html><body><div class='freebirdFormviewerViewResponseConfirmationMessage'>Your response has been recorded.</div></body></html>",
      };

      const res = await evaluateSubmissionResponse(mockRes);
      assert.equal(res.success, true);
      assert.equal(res.fatalError, null);
    });

    test("detects LOGIN_REQUIRED from 302 redirect to accounts.google.com", async () => {
      const mockRes = {
        ok: false,
        status: 302,
        headers: new Headers({
          location: "https://accounts.google.com/ServiceLogin?continue=https://docs.google.com/forms",
        }),
        text: async () => "",
      };

      const res = await evaluateSubmissionResponse(mockRes);
      assert.equal(res.success, false);
      assert.equal(res.fatalError, "LOGIN_REQUIRED");
    });

    test("detects LOGIN_REQUIRED from HTML body", async () => {
      const mockRes = {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () =>
          "<html><body>accounts.google.com/ServiceLogin?service=wise</body></html>",
      };

      const res = await evaluateSubmissionResponse(mockRes);
      assert.equal(res.success, false);
      assert.equal(res.fatalError, "LOGIN_REQUIRED");
    });

    test("detects FORM_CLOSED message", async () => {
      const mockRes = {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () =>
          "<html><body><div class='freebirdFormviewerViewFormClosedMessage'>This form is no longer accepting responses</div></body></html>",
      };

      const res = await evaluateSubmissionResponse(mockRes);
      assert.equal(res.success, false);
      assert.equal(res.fatalError, "FORM_CLOSED");
    });

    test("detects BLOCKED from HTTP 429", async () => {
      const mockRes = {
        ok: false,
        status: 429,
        headers: new Headers(),
        text: async () => "Too Many Requests",
      };

      const res = await evaluateSubmissionResponse(mockRes);
      assert.equal(res.success, false);
      assert.equal(res.fatalError, "BLOCKED");
    });

    test("detects BLOCKED from CAPTCHA in HTML", async () => {
      const mockRes = {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () =>
          "<html><body><div class='g-recaptcha'>Please solve CAPTCHA</div></body></html>",
      };

      const res = await evaluateSubmissionResponse(mockRes);
      assert.equal(res.success, false);
      assert.equal(res.fatalError, "BLOCKED");
    });

    test("detects validation error on form fields", async () => {
      const mockRes = {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () =>
          "<html><body><div class='freebirdFormviewerViewFormError'>This is a required question</div></body></html>",
      };

      const res = await evaluateSubmissionResponse(mockRes);
      assert.equal(res.success, false);
      assert.equal(res.fatalError, null);
      assert.ok(res.validationError.includes("validation error"));
    });
  });

  describe("submitSingleResponse & Retry Logic", () => {
    const actionUrl =
      "https://docs.google.com/forms/d/e/1FAIpQLSd9_sampleFormId123456789/formResponse";

    test("succeeds on first attempt", async () => {
      let callCount = 0;
      const mockFetch = async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => "Your response has been recorded",
        };
      };

      const result = await submitSingleResponse({
        actionUrl,
        payload: "entry.100=hello",
        fetchFn: mockFetch,
      });

      assert.equal(result.success, true);
      assert.equal(result.attempts, 1);
      assert.equal(callCount, 1);
    });

    test("sends Origin, Referer, and Cookie headers", async () => {
      let capturedHeaders = null;
      const mockFetch = async (_url, options) => {
        capturedHeaders = options.headers;
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => "Your response has been recorded",
        };
      };

      await submitSingleResponse({
        actionUrl,
        payload: "entry.100=hello",
        cookies: "S=spreadsheet_forms=xyz; NID=abc",
        formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSd9_sampleFormId123456789/viewform",
        fetchFn: mockFetch,
      });

      assert.equal(capturedHeaders["Origin"], "https://docs.google.com");
      assert.equal(
        capturedHeaders["Referer"],
        "https://docs.google.com/forms/d/e/1FAIpQLSd9_sampleFormId123456789/viewform"
      );
      assert.equal(capturedHeaders["Cookie"], "S=spreadsheet_forms=xyz; NID=abc");
    });

    test("retries on 500 error and succeeds on 2nd attempt", async () => {
      let callCount = 0;
      const mockFetch = async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 500,
            headers: new Headers(),
            text: async () => "Internal Server Error",
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => "Your response has been recorded",
        };
      };

      const result = await submitSingleResponse({
        actionUrl,
        payload: "entry.100=hello",
        fetchFn: mockFetch,
      });

      assert.equal(result.success, true);
      assert.equal(result.attempts, 2);
      assert.equal(callCount, 2);
    });

    test("does NOT retry on fatal error (LOGIN_REQUIRED)", async () => {
      let callCount = 0;
      const mockFetch = async () => {
        callCount++;
        return {
          ok: false,
          status: 302,
          headers: new Headers({
            location: "https://accounts.google.com/ServiceLogin",
          }),
          text: async () => "",
        };
      };

      const result = await submitSingleResponse({
        actionUrl,
        payload: "entry.100=hello",
        fetchFn: mockFetch,
      });

      assert.equal(result.success, false);
      assert.equal(result.fatalError, "LOGIN_REQUIRED");
      assert.equal(result.attempts, 1);
      assert.equal(callCount, 1);
    });
  });

  describe("CSV Export & Formula Injection Escaping", () => {
    test("prefixes dangerous formula trigger characters (=, +, -, @, \\t, \\r) with single quote", () => {
      assert.equal(escapeCsvCell("=SUM(A1:B10)"), `"'=SUM(A1:B10)"`);
      assert.equal(escapeCsvCell("+12345"), ` "'+12345"`.trim());
      assert.equal(escapeCsvCell("-10"), ` "'-10"`.trim());
      assert.equal(escapeCsvCell("@echo"), `"'@echo"`);
      assert.equal(escapeCsvCell("\tcmd"), `"'	cmd"`);
      assert.equal(escapeCsvCell('Normal "quoted" text'), '"Normal ""quoted"" text"');
    });

    test("buildJobCsv formats rows and headers correctly", () => {
      const mockJob = {
        questions: [
          { entryId: "entry.1", title: "Favorite Math Formula" },
          { entryId: "entry.2", title: "Comment" },
        ],
        responses: [
          {
            index: 0,
            sentiment: "neutral",
            answers: {
              "entry.1": "=cmd|' /C calc'!A0",
              "entry.2": "Great form!",
            },
          },
        ],
        results: [
          {
            index: 0,
            status: "success",
            submittedAt: "2026-11-20T10:00:00Z",
          },
        ],
      };

      const csv = buildJobCsv(mockJob);
      const lines = csv.split("\r\n");
      assert.equal(lines.length, 2);

      // Header row
      assert.ok(lines[0].includes('"Favorite Math Formula"'));
      assert.ok(lines[0].includes('"Comment"'));

      // Data row sanitized
      assert.ok(lines[1].includes(`"'=cmd|' /C calc'!A0"`));
      assert.ok(lines[1].includes('"Great form!"'));
      assert.ok(lines[1].includes('"success"'));
    });
  });

  describe("JobStore Limits and Controls", () => {
    let store;

    beforeEach(() => {
      store = new MemoryJobStore();
    });

    test("enforces hourly job creation rate limit per IP", async () => {
      const clientIp = "192.168.1.50";
      const ipHash = hashIp(clientIp);

      for (let i = 1; i <= 5; i++) {
        await store.createJob({
          id: `job-${i}`,
          ipHash,
          status: "completed",
        });
      }

      const count = await store.getCreationCountLastHour(ipHash);
      assert.equal(count, 5);
    });

    test("tracks active jobs per IP and globally", async () => {
      const ip1 = hashIp("10.0.0.1");
      const ip2 = hashIp("10.0.0.2");

      // Create running job 1 for ip1
      await store.createJob({
        id: "job-1",
        ipHash: ip1,
        status: "running",
      });

      const activeIp1 = await store.getActiveJobsForIp(ip1);
      const activeIp2 = await store.getActiveJobsForIp(ip2);
      assert.equal(activeIp1.length, 1);
      assert.equal(activeIp2.length, 0);
      assert.equal(await store.getActiveJobsCount(), 1);

      // Create running job 2 for ip2
      await store.createJob({
        id: "job-2",
        ipHash: ip2,
        status: "running",
      });

      const activeIp2After = await store.getActiveJobsForIp(ip2);
      assert.equal(activeIp2After.length, 1);
      assert.equal(await store.getActiveJobsCount(), 2);

      // Complete job-1
      await store.updateJob("job-1", { status: "completed" });
      const activeIp1After = await store.getActiveJobsForIp(ip1);
      assert.equal(activeIp1After.length, 0);
      assert.equal(await store.getActiveJobsCount(), 1);
    });

    test("updates job state transitions: queued -> running -> paused -> running -> cancelled", async () => {
      await store.createJob({
        id: "test-job",
        ipHash: "testhash",
        status: "queued",
        submitted: 0,
        failed: 0,
      });

      let job = await store.getJob("test-job");
      assert.equal(job.status, "queued");

      job = await store.updateJob("test-job", { status: "running" });
      assert.equal(job.status, "running");

      job = await store.updateJob("test-job", { status: "paused" });
      assert.equal(job.status, "paused");

      job = await store.updateJob("test-job", { status: "running" });
      assert.equal(job.status, "running");

      job = await store.updateJob("test-job", { status: "cancelled" });
      assert.equal(job.status, "cancelled");
    });

    test("retrieves running jobs on simulated reboot", async () => {
      await store.createJob({
        id: "reboot-job-1",
        ipHash: "hash1",
        status: "running",
      });
      await store.createJob({
        id: "reboot-job-2",
        ipHash: "hash2",
        status: "completed",
      });
      await store.createJob({
        id: "reboot-job-3",
        ipHash: "hash3",
        status: "running",
      });

      const runningJobs = await store.getRunningJobs();
      assert.equal(runningJobs.length, 2);
      const ids = runningJobs.map((j) => j.id).sort();
      assert.deepEqual(ids, ["reboot-job-1", "reboot-job-3"]);
    });
  });

  describe("RedisJobStore (Mocked Offline)", () => {
    let mockClient;
    let redisStore;
    let storeMap;

    beforeEach(() => {
      storeMap = new Map();
      const zsets = new Map();

      mockClient = {
        async set(key, val) {
          storeMap.set(key, val);
          return "OK";
        },
        async get(key) {
          return storeMap.get(key) || null;
        },
        async del(key) {
          storeMap.delete(key);
          return 1;
        },
        async keys(pattern) {
          const prefix = pattern.replace("*", "");
          return Array.from(storeMap.keys()).filter((k) => k.startsWith(prefix));
        },
        async expire(_key, _seconds) {
          return 1;
        },
        async zadd(key, score, member) {
          if (!zsets.has(key)) zsets.set(key, []);
          zsets.get(key).push({ score, member });
          return 1;
        },
        async zremrangebyscore(key, min, max) {
          if (!zsets.has(key)) return 0;
          const remaining = zsets.get(key).filter((item) => item.score < min || item.score > max);
          zsets.set(key, remaining);
          return 1;
        },
        async zcard(key) {
          return (zsets.get(key) || []).length;
        },
        async ping() {
          return "PONG";
        },
        on() {},
      };

      redisStore = new RedisJobStore("rediss://mock", { client: mockClient });
    });

    test("persists, reads, updates, and applies 24h TTL on finished jobs with faf: prefix", async () => {
      const job = {
        id: "mock-123",
        ipHash: "hash-mock",
        status: "queued",
        total: 5,
      };

      await redisStore.createJob(job);
      const fetched = await redisStore.getJob("mock-123");
      assert.equal(fetched.id, "mock-123");
      assert.ok(storeMap.has("faf:job:mock-123"));

      const updated = await redisStore.updateJob("mock-123", { status: "completed" });
      assert.equal(updated.status, "completed");

      const activeCount = await redisStore.getActiveJobsCount();
      assert.equal(activeCount, 0);
    });

    test("tracks running jobs and IP rate limits offline", async () => {
      const ip = hashIp("1.2.3.4");
      await redisStore.createJob({ id: "run-1", ipHash: ip, status: "running" });
      await redisStore.createJob({ id: "run-2", ipHash: ip, status: "running" });

      const running = await redisStore.getRunningJobs();
      assert.equal(running.length, 2);

      const activeForIp = await redisStore.getActiveJobsForIp(ip);
      assert.equal(activeForIp.length, 2);

      const count = await redisStore.getCreationCountLastHour(ip);
      assert.equal(count, 2);
    });
  });
});
