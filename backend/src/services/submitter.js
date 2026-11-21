import AppError from "../utils/AppError.js";
import { safeFetch, validateUrl } from "./formParser.js";

const SUBMIT_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Validates that an action URL points strictly to docs.google.com/forms/d/e/<id>/formResponse.
 */
export function validateActionUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError("Invalid action URL.", 400, "INVALID_URL");
  }
  if (parsed.protocol !== "https:") {
    throw new AppError("Action URL must use HTTPS.", 400, "HOST_NOT_ALLOWED");
  }
  if (parsed.hostname !== "docs.google.com") {
    throw new AppError(
      `Action URL host "${parsed.hostname}" is not allowed. Only docs.google.com is permitted.`,
      400,
      "HOST_NOT_ALLOWED"
    );
  }
  if (!/^\/forms\/d\/e\/[^/?#]+\/formResponse$/.test(parsed.pathname)) {
    throw new AppError(
      "Action URL must match /forms/d/e/<id>/formResponse",
      400,
      "INVALID_URL"
    );
  }
  return true;
}

/**
 * Extracts submission metadata (hidden fields and page sentinels) from the form's HTML.
 */
export async function fetchFormMetadata(formUrl) {
  validateUrl(formUrl);
  const { response } = await safeFetch(formUrl);
  const html = await response.text();

  // Hidden fields
  const hiddenFields = {};
  const hiddenMatches = html.matchAll(/<input[^>]+type=["']hidden["'][^>]*>/gi);
  for (const match of hiddenMatches) {
    const tag = match[0];
    const nameMatch = tag.match(/name=["']([^"']+)["']/i);
    const valueMatch = tag.match(/value=["']([^"']*)["']/i);
    if (nameMatch) {
      const rawVal = valueMatch ? valueMatch[1] : "";
      hiddenFields[nameMatch[1]] = rawVal
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    }
  }

  // Sentinels present in the page (e.g. entry.123456_sentinel)
  const sentinels = new Set();
  const sentinelMatches = html.matchAll(/name=["'](entry\.\d+_sentinel)["']/gi);
  for (const match of sentinelMatches) {
    sentinels.add(match[1]);
  }

  // Count sections from FB_PUBLIC_LOAD_DATA_
  let sectionCount = 1;
  const match = html.match(
    /var\s+FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/
  );
  if (match?.[1]) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data?.[1]?.[1])
        ? data[1][1]
        : Array.isArray(data?.[1]?.[4])
        ? data[1][4]
        : [];
      // Type 8 is section header
      const headers = items.filter((item) => item?.[3] === 8);
      sectionCount = Math.max(1, 1 + headers.length);
    } catch {
      // Keep sectionCount 1
    }
  }

  // Multi-section pageHistory (e.g. "0,1,2")
  let pageHistory = "0";
  if (sectionCount > 1) {
    pageHistory = Array.from({ length: sectionCount }, (_, i) => i).join(",");
  } else if (hiddenFields.pageHistory) {
    pageHistory = hiddenFields.pageHistory;
  }

  return {
    hiddenFields,
    sentinels,
    sectionCount,
    pageHistory,
  };
}

/**
 * Builds the URL-encoded payload for Google Forms /formResponse.
 */
export function buildSubmissionPayload({
  answers,
  questions,
  metadata,
}) {
  const params = new URLSearchParams();
  const hidden = metadata?.hiddenFields || {};
  const sentinels = metadata?.sentinels || new Set();

  // 1. Add hidden fields
  params.append("fvv", hidden.fvv || "1");
  if (hidden.fbzx) params.append("fbzx", hidden.fbzx);
  params.append("pageHistory", metadata?.pageHistory || hidden.pageHistory || "0");
  if (hidden.partialResponse) params.append("partialResponse", hidden.partialResponse);
  if (hidden.draftResponse) params.append("draftResponse", hidden.draftResponse);

  // 2. Map questions to entries
  const questionsByEntry = {};
  for (const q of questions) {
    if (q.entryId) questionsByEntry[q.entryId] = q;
  }

  for (const [entryId, rawValue] of Object.entries(answers)) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }

    const q = questionsByEntry[entryId];
    const type = q?.type || "short_text";

    // Date: entry.<id>_year, entry.<id>_month, entry.<id>_day
    if (type === "date" && typeof rawValue === "string") {
      const parts = rawValue.split("-");
      if (parts.length === 3) {
        params.append(`${entryId}_year`, parts[0]);
        params.append(`${entryId}_month`, parts[1]);
        params.append(`${entryId}_day`, parts[2]);
        continue;
      }
    }

    // Time: entry.<id>_hour, entry.<id>_minute
    if (type === "time" && typeof rawValue === "string") {
      const parts = rawValue.split(":");
      if (parts.length >= 2) {
        params.append(`${entryId}_hour`, parts[0]);
        params.append(`${entryId}_minute`, parts[1]);
        continue;
      }
    }

    // Checkboxes: repeat entry.<id> once per selected option
    if (type === "checkboxes" && Array.isArray(rawValue)) {
      for (const item of rawValue) {
        params.append(entryId, String(item));
      }
      const sentinelKey = `${entryId}_sentinel`;
      if (sentinels.has(sentinelKey)) {
        params.append(sentinelKey, "");
      }
      continue;
    }

    // Text / Single choice / Dropdown / Linear scale
    params.append(entryId, String(rawValue));

    // Sentinel for single-choice/dropdown if page had it
    const sentinelKey = `${entryId}_sentinel`;
    if (sentinels.has(sentinelKey)) {
      params.append(sentinelKey, "");
    }
  }

  return params.toString();
}

/**
 * Checks an HTTP response (or its text/redirect) for fatal conditions or success.
 * Returns { success: boolean, fatalError: string | null, validationError: string | null }
 */
export async function evaluateSubmissionResponse(response) {
  // 1. Redirect to sign-in
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const loc = response.headers.get("location") || "";
    if (loc.includes("accounts.google.com")) {
      return {
        success: false,
        fatalError: "LOGIN_REQUIRED",
        validationError: null,
      };
    }
  }

  // 2. HTTP 429
  if (response.status === 429) {
    return {
      success: false,
      fatalError: "BLOCKED",
      validationError: null,
    };
  }

  // 3. Inspect response HTML
  const html = await response.text();

  if (
    html.includes("accounts.google.com") &&
    (html.includes("ServiceLogin") || html.includes("signin"))
  ) {
    return {
      success: false,
      fatalError: "LOGIN_REQUIRED",
      validationError: null,
    };
  }

  if (
    html.includes("This form is no longer accepting responses") ||
    html.includes("freebirdFormviewerViewFormClosedMessage")
  ) {
    return {
      success: false,
      fatalError: "FORM_CLOSED",
      validationError: null,
    };
  }

  // CAPTCHA or unusual traffic page
  if (
    html.includes("recaptcha") ||
    html.includes("g-recaptcha") ||
    html.includes("unusual traffic from your computer network") ||
    html.includes("detected unusual traffic")
  ) {
    return {
      success: false,
      fatalError: "BLOCKED",
      validationError: null,
    };
  }

  // Success indicator: Google Forms renders the confirmation message
  const isConfirmed =
    html.includes("freebirdFormviewerViewResponseConfirmContent") ||
    html.includes("freebirdFormviewerViewResponseConfirmationMessage") ||
    html.includes("Your response has been recorded") ||
    html.includes("has been recorded");

  if (response.ok && isConfirmed) {
    return {
      success: true,
      fatalError: null,
      validationError: null,
    };
  }

  // If status is 200 but renders validation errors on fields
  if (html.includes("freebirdFormviewerViewFormError") || html.includes("This is a required question")) {
    return {
      success: false,
      fatalError: null,
      validationError: "Field validation error reported by Google Forms.",
    };
  }

  // Default fallback check
  if (response.ok) {
    return { success: true, fatalError: null, validationError: null };
  }

  return {
    success: false,
    fatalError: null,
    validationError: `HTTP ${response.status}`,
  };
}

/**
 * Submits a single response payload to actionUrl with retries (up to 3)
 * and exponential backoff + jitter for network/5xx errors.
 */
export async function submitSingleResponse({
  actionUrl,
  payload,
  fetchFn = fetch,
}) {
  validateActionUrl(actionUrl);

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetchFn(actionUrl, {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: payload,
        signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
      });

      const evaluated = await evaluateSubmissionResponse(response);

      // If fatal error, stop immediately without retry
      if (evaluated.fatalError) {
        return {
          success: false,
          fatalError: evaluated.fatalError,
          error: evaluated.fatalError,
          attempts: attempt,
        };
      }

      // If success, return
      if (evaluated.success) {
        return {
          success: true,
          fatalError: null,
          error: null,
          attempts: attempt,
        };
      }

      // If 5xx, retry with exponential backoff + jitter
      if (response.status >= 500 && attempt < maxAttempts) {
        const backoff = Math.pow(2, attempt) * 500 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      // Per-response validation error (do not retry)
      return {
        success: false,
        fatalError: null,
        error: evaluated.validationError || `HTTP ${response.status}`,
        attempts: attempt,
      };
    } catch (err) {
      if (attempt < maxAttempts) {
        // Exponential backoff + jitter for network / timeout errors
        const backoff = Math.pow(2, attempt) * 500 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      return {
        success: false,
        fatalError: null,
        error: err.message || "Network error",
        attempts: attempt,
      };
    }
  }

  return {
    success: false,
    fatalError: null,
    error: "Max retry attempts reached",
    attempts: maxAttempts,
  };
}

