import AppError from "../utils/AppError.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hosts we allow before and after every redirect hop. */
const ALLOWED_HOSTS = new Set([
  "docs.google.com",
  "forms.google.com",
  "forms.gle",
]);

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // ~2 MB
const MAX_REDIRECTS = 5;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Google's internal question type codes → our friendly names.
// Codes observed from real FB_PUBLIC_LOAD_DATA_ arrays:
//   0  = short_text
//   1  = paragraph
//   2  = multiple_choice
//   3  = dropdown
//   4  = checkboxes
//   5  = linear_scale
//   7  = grid (unsupported)
//   8  = section_header (skipped)
//   9  = date
//   10 = time
//   13 = file_upload (unsupported)
const TYPE_MAP = {
  0: "short_text",
  1: "paragraph",
  2: "multiple_choice",
  3: "dropdown",
  4: "checkboxes",
  5: "linear_scale",
  7: "grid",         // unsupported
  9: "date",
  10: "time",
  13: "file_upload", // unsupported
};

const UNSUPPORTED_TYPES = new Set(["grid", "file_upload"]);

// ---------------------------------------------------------------------------
// Host validation
// ---------------------------------------------------------------------------

/**
 * Validates a URL string and returns a URL object.
 * Throws INVALID_URL or HOST_NOT_ALLOWED.
 */
function validateUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppError("Invalid URL.", 400, "INVALID_URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AppError("Only HTTP(S) URLs are allowed.", 400, "INVALID_URL");
  }
  if (parsed.hostname === "accounts.google.com") {
    throw new AppError(
      "This form requires sign-in and cannot be parsed.",
      403,
      "LOGIN_REQUIRED"
    );
  }
  if (parsed.hostname === "consent.google.com") {
    throw new AppError(
      "Google presented a consent page.",
      403,
      "CONSENT_PAGE"
    );
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new AppError(
      `Host "${parsed.hostname}" is not allowed. Only Google Forms URLs are accepted.`,
      400,
      "HOST_NOT_ALLOWED"
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Fetch with redirect-safe resolution
// ---------------------------------------------------------------------------

/**
 * Fetches the final URL after following up to MAX_REDIRECTS hops.
 * Re-checks the host after EVERY redirect to prevent SSRF.
 * Returns { response, finalUrl }.
 */
async function safeFetch(url) {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    validateUrl(currentUrl); // re-check host every hop

    let res;
    try {
      res = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual", // handle redirects ourselves
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        throw new AppError(
          "Request to Google Forms timed out.",
          504,
          "FETCH_TIMEOUT"
        );
      }
      throw new AppError(
        `Failed to fetch form: ${err.message}`,
        502,
        "PARSE_FAILED"
      );
    }

    // --- Follow redirects manually -------------------------------------------
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) {
        throw new AppError("Redirect with no Location header.", 502, "PARSE_FAILED");
      }
      const nextUrl = new URL(location, currentUrl);

      // Check if redirect hop goes to accounts.google.com
      if (nextUrl.hostname === "accounts.google.com") {
        throw new AppError(
          "This form requires sign-in and cannot be parsed.",
          403,
          "LOGIN_REQUIRED"
        );
      }

      // Check if redirect hop goes to consent.google.com
      if (nextUrl.hostname === "consent.google.com") {
        throw new AppError(
          "Google presented a consent page.",
          403,
          "CONSENT_PAGE"
        );
      }

      currentUrl = nextUrl.href;
      continue;
    }

    const finalParsed = new URL(currentUrl);
    if (finalParsed.hostname === "accounts.google.com") {
      throw new AppError(
        "This form requires sign-in and cannot be parsed.",
        403,
        "LOGIN_REQUIRED"
      );
    }
    if (finalParsed.hostname === "consent.google.com") {
      throw new AppError(
        "Google presented a consent page.",
        403,
        "CONSENT_PAGE"
      );
    }

    return { response: res, finalUrl: currentUrl };
  }

  throw new AppError("Too many redirects.", 502, "PARSE_FAILED");
}

// ---------------------------------------------------------------------------
// Hidden form fields extraction
// ---------------------------------------------------------------------------

/**
 * Extracts hidden input fields from the raw HTML page (e.g. fbzx, pageHistory, fvv).
 * Needed for response submission.
 */
function extractHiddenFields(html) {
  const fields = {};
  const hiddenMatches = html.matchAll(/<input[^>]+type=["']hidden["'][^>]*>/gi);
  for (const match of hiddenMatches) {
    const tag = match[0];
    const nameMatch = tag.match(/name=["']([^"']+)["']/i);
    const valueMatch = tag.match(/value=["']([^"']*)["']/i);
    if (nameMatch) {
      const rawVal = valueMatch ? valueMatch[1] : "";
      const val = rawVal
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      fields[nameMatch[1]] = val;
    }
  }
  return fields;
}

/**
 * Detects if a page without form data is a Google Consent page.
 */
function isConsentPage(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  if (/before you continue to google/i.test(title) || /^consent$/i.test(title)) {
    return true;
  }
  if (
    html.includes("consent.google.com") &&
    (/before you continue to google/i.test(html) || /google terms of service/i.test(html))
  ) {
    return true;
  }
  return false;
}

/**
 * Detects if a page without form data clearly is a Google Sign-In page.
 */
function isSignInPage(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Title indicates sign-in (e.g. "Google Forms - Sign in", "Sign in - Google Accounts")
  if (/sign\s*in/i.test(title) || /log\s*in/i.test(title)) {
    return true;
  }

  // Active form action pointing to accounts.google.com
  if (
    /<form[^>]+action=["'][^"']*accounts\.google\.com[^"']*(?:ServiceLogin|signin)[^"']*["']/i.test(
      html
    )
  ) {
    return true;
  }

  // Prominent sign-in messages in body
  if (
    /Sign in to continue to Forms/i.test(html) ||
    /Sign in to Google Forms/i.test(html) ||
    /Sign in with your Google Account/i.test(html) ||
    /Use your Google Account/i.test(html)
  ) {
    return true;
  }

  // Sign-in input element identifiers
  if (
    html.includes('id="identifierId"') ||
    html.includes('name="identifier"') ||
    html.includes('id="Email"')
  ) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// HTML → FB_PUBLIC_LOAD_DATA_ extraction
// ---------------------------------------------------------------------------

/**
 * Reads the response body with a size cap, then extracts the
 * FB_PUBLIC_LOAD_DATA_ JSON blob and hidden input fields from the HTML.
 */
async function extractFormData(response) {
  // Read body with size limit
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.length;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      reader.cancel();
      throw new AppError("Response too large.", 502, "PARSE_FAILED");
    }
    chunks.push(value);
  }

  const html = new TextDecoder().decode(
    Buffer.concat(chunks.map((c) => Buffer.from(c)))
  );

  // --- Extract FB_PUBLIC_LOAD_DATA_ -----------------------------------------
  // The data lives in a <script> tag as: var FB_PUBLIC_LOAD_DATA_ = [...];
  const regex = /var\s+FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/;
  const match = html.match(regex);

  if (!match?.[1]) {
    // 1. Consent page check
    if (isConsentPage(html)) {
      throw new AppError(
        "Google presented a consent page.",
        403,
        "CONSENT_PAGE"
      );
    }

    // 2. Clear sign-in page check
    if (isSignInPage(html)) {
      throw new AppError(
        "This form requires sign-in and cannot be parsed.",
        403,
        "LOGIN_REQUIRED"
      );
    }

    // 3. Closed form check
    if (
      html.includes("This form is no longer accepting responses") ||
      (!html.includes("formResponse") &&
        html.includes("freebirdFormviewerViewFormClosedMessage"))
    ) {
      throw new AppError(
        "This form is no longer accepting responses.",
        409,
        "FORM_CLOSED"
      );
    }

    // 4. Not found check
    if (response.status === 404 || html.includes("Sorry, unable to open the file")) {
      throw new AppError("Form not found.", 404, "FORM_NOT_FOUND");
    }

    throw new AppError(
      "Could not find form data in the page. The form may be private or the URL may be wrong.",
      502,
      "PARSE_FAILED"
    );
  }

  // --- Detect closed forms when FB_PUBLIC_LOAD_DATA_ is present --------------
  if (
    html.includes("This form is no longer accepting responses") ||
    (!html.includes("formResponse") &&
      html.includes("freebirdFormviewerViewFormClosedMessage"))
  ) {
    throw new AppError(
      "This form is no longer accepting responses.",
      409,
      "FORM_CLOSED"
    );
  }

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new AppError(
      "Failed to parse form data JSON.",
      502,
      "PARSE_FAILED"
    );
  }

  const hiddenFields = extractHiddenFields(html);

  return { data, hiddenFields, html };
}

// ---------------------------------------------------------------------------
// Question parser
// ---------------------------------------------------------------------------

/**
 * Parses the FB_PUBLIC_LOAD_DATA_ array into a structured form object.
 *
 * Layout observed from REAL live Google Forms:
 *   data[3]          → Form title (or fallback to data[1][8] / data[1][0])
 *   data[1][0]       → Form description / subtitle (if string and not same as title)
 *   data[1][1]       → Array of question / section items (or fallback to data[1][4])
 *   data[1][10][6]   → 1 if login required
 *
 * Each question item:
 *   item[0]          → Internal numeric question ID
 *   item[1]          → Question title (string)
 *   item[2]          → Help text / description (string or null)
 *   item[3]          → Type code (number: 0=short_text, 1=paragraph, 2=mc, 3=dropdown,
 *                      4=checkboxes, 5=scale, 7=grid, 8=section_header, 9=date, 10=time, 13=file)
 *   item[4]          → Answer config array (null for section headers / decoration)
 *     answerData = item[4][0]:
 *       answerData[0]  → Numeric entry ID (e.g. 1734133505 → "entry.1734133505")
 *       answerData[1]  → Options array for select/dropdown/scale ([["Label", ...], ...])
 *       answerData[2]  → 1 if required, 0 if optional
 *       answerData[3]  → Scale min/max labels array (["Min label", "Max label"])
 */
function parseQuestions(data) {
  // Title: check data[3], data[1][8], or data[1][0]
  const title =
    data?.[3] ??
    data?.[1]?.[8] ??
    data?.[1]?.[0] ??
    "Untitled form";

  // Description: string at data[1][0] (if different from title), or data[1][1] if string
  let description = "";
  if (typeof data?.[1]?.[0] === "string" && data[1][0] !== title) {
    description = data[1][0];
  } else if (typeof data?.[1]?.[2] === "string") {
    description = data[1][2];
  }

  // Question groups: real Google Forms place questions in data[1][1];
  // some fixtures / older forms place them in data[1][4].
  const questionGroups = Array.isArray(data?.[1]?.[1])
    ? data[1][1]
    : Array.isArray(data?.[1]?.[4])
    ? data[1][4]
    : null;

  if (!Array.isArray(questionGroups)) {
    throw new AppError(
      "No questions found in form data.",
      502,
      "PARSE_FAILED"
    );
  }

  const questions = [];
  const unsupported = [];
  let skippedNonQuestions = 0;
  let hasMultipleSections = false;

  for (const item of questionGroups) {
    if (!item) {
      skippedNonQuestions++;
      continue;
    }

    const questionTitle = item?.[1] ?? "";
    const helpText = item?.[2] ?? "";
    const typeCode = item?.[3];

    // Section headers (type 8), page breaks (6), images (11), videos (12)
    if (typeCode === 8) {
      hasMultipleSections = true;
      skippedNonQuestions++;
      continue;
    }
    if (typeCode === 6 || typeCode === 11 || typeCode === 12) {
      skippedNonQuestions++;
      continue;
    }

    // No answer config → decorative element
    const answerConfig = item?.[4];
    if (!Array.isArray(answerConfig) || answerConfig.length === 0) {
      skippedNonQuestions++;
      continue;
    }

    const answerData = answerConfig[0];
    const typeName = TYPE_MAP[typeCode] ?? `unknown_${typeCode}`;

    // --- Entry ID extraction -------------------------------------------------
    // In real Google Forms: answerData[0] is the numeric ID (e.g. 2112281434).
    // In older mock fixtures: answerData[2] was the numeric ID.
    let rawEntryId = null;
    if (
      typeof answerData?.[0] === "number" ||
      (typeof answerData?.[0] === "string" && /^\d+$/.test(answerData[0]))
    ) {
      rawEntryId = answerData[0];
    } else if (
      typeof answerData?.[2] === "number" ||
      (typeof answerData?.[2] === "string" && /^\d+$/.test(answerData[2]))
    ) {
      rawEntryId = answerData[2];
    }
    const entryId = rawEntryId != null ? `entry.${rawEntryId}` : null;

    // --- Required flag extraction --------------------------------------------
    // In real Google Forms: answerData[2] is 1 (required) or 0 (optional).
    // In older mock fixtures: answerData[1] was 1 or 0 (when not an array of options).
    let required = false;
    if (answerData?.[2] === 1) {
      required = true;
    } else if (answerData?.[1] === 1 && !Array.isArray(answerData?.[1])) {
      required = true;
    }

    // --- Unsupported types (grid, file upload) --------------------------------
    if (UNSUPPORTED_TYPES.has(typeName)) {
      // For grid questions, answerConfig has multiple rows; check if any row is required
      const isGridRequired = answerConfig.some(
        (row) => row?.[2] === 1 || (row?.[1] === 1 && !Array.isArray(row?.[1]))
      );
      const isActuallyRequired = required || isGridRequired;

      const reason =
        typeName === "grid"
          ? "Grid questions are not supported."
          : "File upload questions are not supported.";

      unsupported.push({
        title: questionTitle,
        type: typeName,
        reason,
        required: isActuallyRequired,
      });

      if (isActuallyRequired) {
        throw new AppError(
          `Required question "${questionTitle}" uses unsupported type "${typeName}". Cannot auto-fill this form.`,
          422,
          "UNSUPPORTED_REQUIRED_QUESTION"
        );
      }
      continue;
    }

    // --- Options extraction (for multiple_choice, dropdown, checkboxes) -------
    // In real Google Forms: answerData[1] is array of options [["Label", ...], ...]
    // In older mock fixtures: answerData[0] was array of options
    const rawOptions = Array.isArray(answerData?.[1])
      ? answerData[1]
      : Array.isArray(answerData?.[0])
      ? answerData[0]
      : [];
    const options = rawOptions
      .map((opt) => (Array.isArray(opt) ? opt[0] : opt))
      .filter((opt) => typeof opt === "string" && opt.length > 0);

    // --- Scale range (for linear_scale) ---------------------------------------
    // Derived dynamically from real data:
    //   Steps list: answerData[1] (e.g. [["1"],["2"],["3"],["4"],["5"]])
    //   Labels: answerData[3] (e.g. ["Very bad", "Very good"])
    let scaleRange = null;
    if (typeName === "linear_scale") {
      const steps = Array.isArray(answerData?.[1])
        ? answerData[1]
        : Array.isArray(answerData?.[0])
        ? answerData[0]
        : [];

      if (steps.length >= 2) {
        const firstStep = Array.isArray(steps[0]) ? steps[0][0] : steps[0];
        const lastStep =
          Array.isArray(steps[steps.length - 1])
            ? steps[steps.length - 1][0]
            : steps[steps.length - 1];

        const minVal = Number(firstStep);
        const maxVal = Number(lastStep);
        const min = Number.isNaN(minVal) ? 1 : minVal;
        const max = Number.isNaN(maxVal) ? steps.length : maxVal;

        // Labels in real data live at answerData[3]
        const labels = Array.isArray(answerData?.[3]) ? answerData[3] : [];
        const minLabel = labels[0] ?? "";
        const maxLabel = labels[1] ?? "";

        scaleRange = { min, max, minLabel, maxLabel };
      }
    }

    questions.push({
      id: item?.[0] ?? null,
      entryId,
      title: questionTitle,
      helpText,
      type: typeName,
      required,
      options: typeName === "linear_scale" ? [] : options,
      scaleRange,
    });
  }

  return {
    title,
    description,
    formId: null, // set by parseGoogleForm from resolved URL path
    actionUrl: null,
    requiresLogin: false,
    questions,
    unsupported,
    skippedNonQuestions,
    hasMultipleSections,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches and parses a public Google Form.
 * Derives formId and actionUrl from the resolved URL path (/d/e/<id>/).
 *
 * @param {string} url  The Google Forms URL
 * @returns {Promise<object>}  Structured form data
 */
export async function parseGoogleForm(url) {
  // 1. Validate the initial URL
  validateUrl(url);

  // 2. Fetch with safe redirect following
  const { response, finalUrl } = await safeFetch(url);

  // 3. After all redirects, make sure we landed on a docs.google.com/forms page
  const finalParsed = new URL(finalUrl);
  if (
    finalParsed.hostname !== "docs.google.com" ||
    !finalParsed.pathname.startsWith("/forms")
  ) {
    throw new AppError(
      "URL did not resolve to a Google Forms page.",
      400,
      "HOST_NOT_ALLOWED"
    );
  }

  // 4. 404 check
  if (response.status === 404) {
    throw new AppError("Form not found.", 404, "FORM_NOT_FOUND");
  }

  // 5. Extract and parse FB_PUBLIC_LOAD_DATA_ + hidden fields
  const { data, hiddenFields } = await extractFormData(response);

  // 6. Parse questions
  const result = parseQuestions(data);

  // 7. Derive the public form ID and action URL from the resolved URL path
  //    /forms/d/e/<formId>/viewform → https://docs.google.com/forms/d/e/<formId>/formResponse
  const deMatch = finalUrl.match(/\/forms\/d\/e\/([^/?#]+)/);
  if (deMatch) {
    result.formId = deMatch[1];
    result.actionUrl = `https://docs.google.com/forms/d/e/${deMatch[1]}/formResponse`;
  } else {
    const dMatch = finalUrl.match(/\/forms\/d\/([^/?#]+)/);
    if (dMatch) {
      result.formId = dMatch[1];
      result.actionUrl = `https://docs.google.com/forms/d/${dMatch[1]}/formResponse`;
    }
  }

  // 8. Attach hidden fields for future response submission
  result.hiddenFields = hiddenFields;
  if (hiddenFields?.pageHistory !== undefined) {
    result.hasMultipleSections =
      result.hasMultipleSections || hiddenFields.pageHistory !== "0";
  }

  return result;
}

// Also export internals for testing
export {
  validateUrl,
  parseQuestions,
  extractFormData,
  extractHiddenFields,
  safeFetch,
  isSignInPage,
  isConsentPage,
  FETCH_HEADERS,
};
