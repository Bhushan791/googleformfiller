import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  validateUrl,
  parseQuestions,
  extractHiddenFields,
  extractFormData,
} from "./services/formParser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(
  join(__dirname, "__fixtures__", "sampleForm.html"),
  "utf-8"
);

/**
 * Extract FB_PUBLIC_LOAD_DATA_ from the fixture the same way the service does.
 */
function extractFixtureData(html) {
  const regex =
    /var\s+FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/;
  const match = html.match(regex);
  if (!match?.[1]) throw new Error("Fixture has no FB_PUBLIC_LOAD_DATA_");
  return JSON.parse(match[1]);
}

let formData;
let result;

// ---------------------------------------------------------------------------
// Parse fixture
// ---------------------------------------------------------------------------
describe("formParser", () => {
  before(() => {
    formData = extractFixtureData(fixtureHtml);
    result = parseQuestions(formData);
  });

  // ---- Basic metadata -------------------------------------------------------
  it("extracts form title", () => {
    assert.equal(result.title, "Sanitized Test Form");
  });

  it("identifies multi-section forms", () => {
    assert.equal(result.hasMultipleSections, true);
  });

  // ---- Question count -------------------------------------------------------
  it("returns the correct number of parsed questions", () => {
    // 9 real questions (time, short_text, dropdown, date, dropdown, checkboxes, mc, paragraph, linear_scale)
    // 2 grid questions → unsupported
    // 1 section header → skipped
    assert.equal(result.questions.length, 9);
    assert.equal(result.unsupported.length, 2);
    assert.equal(result.skippedNonQuestions, 1);
  });

  // ---- Type mapping ---------------------------------------------------------
  it("parses short_text (type 0)", () => {
    const q = result.questions.find((q) => q.type === "short_text");
    assert.ok(q, "short_text question missing");
    assert.equal(q.title, "Name - your fully name;");
    assert.equal(q.entryId, "entry.2112281434");
    assert.equal(q.required, true);
  });

  it("parses paragraph (type 1)", () => {
    const q = result.questions.find((q) => q.type === "paragraph");
    assert.ok(q);
    assert.equal(q.title, "Long paragraph");
    assert.equal(q.entryId, "entry.1085560899");
    assert.equal(q.required, false);
  });

  it("parses multiple_choice (type 2)", () => {
    const q = result.questions.find((q) => q.type === "multiple_choice");
    assert.ok(q);
    assert.equal(q.title, "Your choice");
    assert.equal(q.entryId, "entry.1682233942");
    assert.deepEqual(q.options, ["Okay", "I don't know"]);
    assert.equal(q.required, true);
  });

  it("parses checkboxes (type 4)", () => {
    const q = result.questions.find((q) => q.type === "checkboxes");
    assert.ok(q);
    assert.equal(q.title, "Place");
    assert.equal(q.entryId, "entry.819260047");
    assert.ok(q.options.includes("Home"));
    assert.ok(q.options.includes("Garden"));
    assert.equal(q.required, true);
  });

  it("parses dropdown (type 3)", () => {
    const q = result.questions.find((q) => q.type === "dropdown" && q.title === "Where");
    assert.ok(q);
    assert.equal(q.entryId, "entry.1600556346");
    assert.deepEqual(q.options, ["Ahihi?", "New York", "Sài Gòn", "Paris"]);
    assert.equal(q.required, true);
  });

  it("derives linear_scale (type 5) min/max and labels dynamically from data", () => {
    const q = result.questions.find((q) => q.type === "linear_scale");
    assert.ok(q);
    assert.equal(q.entryId, "entry.1816363029");
    assert.ok(q.scaleRange);
    assert.equal(q.scaleRange.min, 1);
    assert.equal(q.scaleRange.max, 5);
    assert.equal(q.scaleRange.minLabel, "Very bad");
    assert.equal(q.scaleRange.maxLabel, "Very good");
  });

  it("parses date (type 9)", () => {
    const q = result.questions.find((q) => q.type === "date");
    assert.ok(q);
    assert.equal(q.title, "Date");
    assert.equal(q.entryId, "entry.77071893");
    assert.equal(q.required, true);
  });

  it("parses time (type 10)", () => {
    const q = result.questions.find((q) => q.type === "time");
    assert.ok(q);
    assert.equal(q.title, "Time?");
    assert.equal(q.entryId, "entry.1734133505");
    assert.equal(q.required, false);
  });

  // ---- Section headers skipped -----------------------------------------------
  it("skips section headers", () => {
    assert.equal(result.skippedNonQuestions, 1);
    const sectionInQuestions = result.questions.find(
      (q) => q.title === "Untitled Section"
    );
    assert.equal(sectionInQuestions, undefined);
  });

  // ---- Unsupported types ----------------------------------------------------
  it("puts grid questions in unsupported array", () => {
    const g = result.unsupported.find((u) => u.title === "Grid Choice");
    assert.ok(g);
    assert.equal(g.type, "grid");
  });

  // ---- Entry IDs ------------------------------------------------------------
  it("extracts entry IDs matching entry.xxxx for all questions", () => {
    for (const q of result.questions) {
      assert.ok(q.entryId, `Missing entryId for "${q.title}"`);
      assert.match(q.entryId, /^entry\.\d+$/);
    }
  });

  // ---- Hidden fields extraction --------------------------------------------
  it("extracts hidden form fields from HTML", () => {
    const hidden = extractHiddenFields(fixtureHtml);
    assert.equal(hidden.fvv, "1");
    assert.equal(hidden.pageHistory, "0");
    assert.equal(hidden.fbzx, "1234567890");
    assert.equal(hidden.partialResponse, '[null,null,"1234567890"]');
  });

  // ---- Missing data → PARSE_FAILED -----------------------------------------
  it("throws PARSE_FAILED when question groups are missing", () => {
    assert.throws(
      () => parseQuestions([null, [null, null, null, null, null]]),
      (err) => err.errorCode === "PARSE_FAILED"
    );
  });

  // ---- Host validation -------------------------------------------------------
  describe("validateUrl", () => {
    it("accepts docs.google.com", () => {
      assert.doesNotThrow(() =>
        validateUrl("https://docs.google.com/forms/d/abc/viewform")
      );
    });

    it("accepts forms.gle", () => {
      assert.doesNotThrow(() =>
        validateUrl("https://forms.gle/abc123")
      );
    });

    it("accepts forms.google.com", () => {
      assert.doesNotThrow(() =>
        validateUrl("https://forms.google.com/something")
      );
    });

    it("rejects non-Google URLs", () => {
      assert.throws(
        () => validateUrl("https://evil.com/forms/d/abc"),
        (err) => err.errorCode === "HOST_NOT_ALLOWED"
      );
    });

    it("rejects plain strings that are not URLs", () => {
      assert.throws(
        () => validateUrl("not-a-url"),
        (err) => err.errorCode === "INVALID_URL"
      );
    });

    it("rejects file:// protocol", () => {
      assert.throws(
        () => validateUrl("file:///etc/passwd"),
        (err) => err.errorCode === "INVALID_URL"
      );
    });
  });

  // ---- Required unsupported question → error --------------------------------
  it("throws UNSUPPORTED_REQUIRED_QUESTION for required grid question", () => {
    const dataWithRequiredGrid = JSON.parse(JSON.stringify(formData));
    // Grid Choice is at index 10 in data[1][1]
    // Set required = 1 in answerConfig[0][2]
    dataWithRequiredGrid[1][1][10][4][0][2] = 1;

    assert.throws(
      () => parseQuestions(dataWithRequiredGrid),
      (err) => err.errorCode === "UNSUPPORTED_REQUIRED_QUESTION"
    );
  });

  // ---- Public page with accounts / ServiceLogin strings ----------------------
  describe("LOGIN_REQUIRED and CONSENT_PAGE detection", () => {
    function createMockResponse(html, status = 200) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(html));
          controller.close();
        },
      });
      return { status, body: stream };
    }

    it("parses public form even when HTML contains accounts.google.com and ServiceLogin/signin", async () => {
      // Injects sign-in links and scripts into fixture HTML
      const htmlWithSignInLinks = fixtureHtml.replace(
        "</body>",
        `<a href="https://accounts.google.com/ServiceLogin?signin=true">Sign In</a>
         <script>var x = "https://accounts.google.com/v3/signin/identifier";</script>
         </body>`
      );

      const parsed = await extractFormData(createMockResponse(htmlWithSignInLinks));
      assert.ok(parsed.data, "Form data should be extracted successfully");
      assert.equal(parsed.data[3], "Sanitized Test Form");
    });

    it("throws LOGIN_REQUIRED when FB_PUBLIC_LOAD_DATA_ is missing AND page is clearly a sign-in page", async () => {
      const signInHtml = `<!DOCTYPE html><html>
        <head><title>Sign in - Google Accounts</title></head>
        <body>
          <form action="https://accounts.google.com/ServiceLogin" method="post">
            <input type="email" id="identifierId" name="identifier" />
          </form>
        </body></html>`;

      await assert.rejects(
        () => extractFormData(createMockResponse(signInHtml)),
        (err) => err.errorCode === "LOGIN_REQUIRED"
      );
    });

    it("throws CONSENT_PAGE when FB_PUBLIC_LOAD_DATA_ is missing and page is a consent page", async () => {
      const consentHtml = `<!DOCTYPE html><html>
        <head><title>Before you continue to Google</title></head>
        <body>
          <h1>Before you continue to Google</h1>
          <form action="https://consent.google.com/save"></form>
        </body></html>`;

      await assert.rejects(
        () => extractFormData(createMockResponse(consentHtml)),
        (err) => err.errorCode === "CONSENT_PAGE"
      );
    });

    it("validateUrl triggers LOGIN_REQUIRED for accounts.google.com", () => {
      assert.throws(
        () => validateUrl("https://accounts.google.com/ServiceLogin?continue=https://docs.google.com"),
        (err) => err.errorCode === "LOGIN_REQUIRED"
      );
    });

    it("validateUrl triggers CONSENT_PAGE for consent.google.com", () => {
      assert.throws(
        () => validateUrl("https://consent.google.com/m?continue=https://docs.google.com"),
        (err) => err.errorCode === "CONSENT_PAGE"
      );
    });
  });
});
