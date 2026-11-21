import crypto from "node:crypto";

/**
 * In-memory Cache for prewarmed Google Form responses and option classifications.
 * TTL: 1 hour, Max 20 forms (evicts oldest).
 */

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_FORMS = 20;

class AnswerCache {
  constructor() {
    this.cache = new Map(); // formKey -> formCacheObject
    this.accessCounter = 0;
  }

  /**
   * Deterministically computes a unique formKey from formId/url, questions, and audience settings.
   *
   * @param {string} formId - Form ID or URL
   * @param {Array<object>} questions - Parsed questions
   * @param {object} [settings] - Generator settings including audienceMode and scenario
   * @returns {string} 24-character hex hash
   */
  computeFormKey(formId = "", questions = [], settings = {}) {
    const qSummary = (questions || [])
      .map((q) => `${q.id || q.entryId || ""}:${(q.title || "").trim()}`)
      .sort()
      .join("|");
    const mode = (settings.audienceMode || "auto").trim();
    const scenario = (settings.scenario || "").trim().slice(0, 400);
    return crypto
      .createHash("sha256")
      .update(`${formId}:${qSummary}:${mode}:${scenario}`)
      .digest("hex")
      .slice(0, 24);
  }

  /**
   * Evicts the oldest entry based on lastAccessed timestamp.
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Retrieves a form's cache entry, checking TTL.
   *
   * @param {string} formKey
   * @returns {object|null}
   */
  get(formKey) {
    if (!formKey) return null;
    const entry = this.cache.get(formKey);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.createdAt > TTL_MS) {
      this.cache.delete(formKey);
      return null;
    }

    entry.lastAccessed = ++this.accessCounter;
    return entry;
  }

  /**
   * Initializes or resets a cache entry for a form.
   *
   * @param {string} formKey
   * @param {object} [params]
   * @param {number} [params.totalAiQuestions]
   * @param {boolean} [params.usedLLM]
   * @returns {object}
   */
  init(formKey, { totalAiQuestions = 0, usedLLM = false } = {}) {
    if (!formKey) return null;

    // Enforce max forms limit
    if (!this.cache.has(formKey) && this.cache.size >= MAX_FORMS) {
      this.evictOldest();
    }

    const now = Date.now();
    const entry = {
      status: "warming",
      optionLabels: {}, // questionId -> { [option]: sentiment }
      textBuffers: {}, // questionId -> { positive: [], neutral: [], negative: [] }
      startedAt: new Date(now).toISOString(),
      readyAt: null,
      totalAiQuestions,
      usedLLM,
      detectedMode: null,
      confidence: null,
      reason: null,
      audience: null,
      effectiveMode: "research",
      createdAt: now,
      lastAccessed: ++this.accessCounter,
    };

    this.cache.set(formKey, entry);
    return entry;
  }

  /**
   * Sets audience detection results for a form cache entry.
   *
   * @param {string} formKey
   * @param {object} detection
   */
  setDetection(formKey, detection = {}) {
    const entry = this.get(formKey);
    if (!entry) return;

    if (detection.detectedMode !== undefined) entry.detectedMode = detection.detectedMode;
    if (detection.confidence !== undefined) entry.confidence = detection.confidence;
    if (detection.reason !== undefined) entry.reason = detection.reason;
    if (detection.audience !== undefined) entry.audience = detection.audience;
    if (detection.effectiveMode !== undefined) entry.effectiveMode = detection.effectiveMode;
    entry.lastAccessed = Date.now();
  }

  /**
   * Updates status of a form cache entry.
   *
   * @param {string} formKey
   * @param {"idle"|"warming"|"ready"|"partial"|"failed"} status
   * @param {object} [extra]
   */
  setStatus(formKey, status, extra = {}) {
    const entry = this.get(formKey);
    if (!entry) return;

    entry.status = status;
    if ((status === "ready" || status === "partial") && !entry.readyAt) {
      entry.readyAt = new Date().toISOString();
    }
    if (extra.usedLLM !== undefined) {
      entry.usedLLM = extra.usedLLM;
    }
    if (extra.totalAiQuestions !== undefined) {
      entry.totalAiQuestions = extra.totalAiQuestions;
    }
    entry.lastAccessed = Date.now();
  }

  /**
   * Adds option sentiment classifications for a choice question.
   *
   * @param {string} formKey
   * @param {string} questionId
   * @param {Record<string, string>} optionLabels
   */
  addOptions(formKey, questionId, optionLabels = {}) {
    const entry = this.get(formKey);
    if (!entry || !questionId) return;

    entry.optionLabels[questionId] = {
      ...(entry.optionLabels[questionId] || {}),
      ...optionLabels,
    };
    entry.lastAccessed = Date.now();
  }

  /**
   * Gets cached option labels for a question.
   *
   * @param {string} formKey
   * @param {string} questionId
   * @returns {Record<string, string>|null}
   */
  getOptions(formKey, questionId) {
    const entry = this.get(formKey);
    return entry?.optionLabels?.[questionId] || null;
  }

  /**
   * Pushes generated text answers into a question's sentiment buffer.
   *
   * @param {string} formKey
   * @param {string} questionId
   * @param {"positive"|"neutral"|"negative"} sentiment
   * @param {string[]} answers
   */
  pushAnswers(formKey, questionId, sentiment, answers = []) {
    const entry = this.get(formKey);
    if (!entry || !questionId || !answers.length) return;

    if (!entry.textBuffers[questionId]) {
      entry.textBuffers[questionId] = { positive: [], neutral: [], negative: [] };
    }
    if (!entry.textBuffers[questionId][sentiment]) {
      entry.textBuffers[questionId][sentiment] = [];
    }

    const current = entry.textBuffers[questionId][sentiment];
    for (const ans of answers) {
      const clean = (ans || "").trim();
      if (clean && !current.includes(clean)) {
        current.push(clean);
      }
    }
    entry.lastAccessed = Date.now();
  }

  /**
   * Pops one answer from a question's sentiment buffer.
   * Never repeats because the item is removed from the buffer.
   *
   * @param {string} formKey
   * @param {string} questionId
   * @param {"positive"|"neutral"|"negative"} sentiment
   * @returns {string|null}
   */
  pop(formKey, questionId, sentiment) {
    const entry = this.get(formKey);
    if (!entry) return null;

    const buffer = entry.textBuffers?.[questionId]?.[sentiment];
    if (!buffer || buffer.length === 0) return null;

    entry.lastAccessed = Date.now();
    return buffer.shift();
  }

  /**
   * Returns current buffer size for a question and sentiment.
   *
   * @param {string} formKey
   * @param {string} questionId
   * @param {"positive"|"neutral"|"negative"} sentiment
   * @returns {number}
   */
  size(formKey, questionId, sentiment) {
    const entry = this.get(formKey);
    return entry?.textBuffers?.[questionId]?.[sentiment]?.length || 0;
  }

  /**
   * Returns true when buffer size is below 5.
   *
   * @param {string} formKey
   * @param {string} questionId
   * @param {"positive"|"neutral"|"negative"} sentiment
   * @returns {boolean}
   */
  needsRefill(formKey, questionId, sentiment) {
    return this.size(formKey, questionId, sentiment) < 5;
  }

  /**
   * Waits up to timeoutMs (default 6s) for an answer to become available in the buffer.
   *
   * @param {string} formKey
   * @param {string} questionId
   * @param {"positive"|"neutral"|"negative"} sentiment
   * @param {number} [timeoutMs=6000]
   * @returns {Promise<string|null>}
   */
  async waitForAnswer(formKey, questionId, sentiment, timeoutMs = 6000) {
    const start = Date.now();
    const immediate = this.pop(formKey, questionId, sentiment);
    if (immediate) return immediate;

    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100));
      const entry = this.get(formKey);
      if (!entry || entry.status === "failed") {
        return null;
      }
      const ans = this.pop(formKey, questionId, sentiment);
      if (ans) return ans;
      if (entry.status === "ready" && this.size(formKey, questionId, sentiment) === 0) {
        // Form is done warming and this specific buffer is empty
        return null;
      }
    }
    return null;
  }

  /**
   * Returns summary status information for the client.
   *
   * @param {string} formKey
   * @returns {object}
   */
  getStatusInfo(formKey) {
    const entry = this.get(formKey);
    if (!entry) {
      return {
        status: "idle",
        ready: 0,
        total: 0,
        usedLLM: false,
        detectedMode: null,
        confidence: null,
        reason: null,
        audience: null,
        effectiveMode: "research",
      };
    }

    // Count how many questions have buffered answers or classified options
    let readyCount = 0;
    const coveredIds = new Set([
      ...Object.keys(entry.optionLabels || {}),
      ...Object.keys(entry.textBuffers || {}),
    ]);

    for (const qid of coveredIds) {
      const hasOptions = Object.keys(entry.optionLabels[qid] || {}).length > 0;
      const buffers = entry.textBuffers[qid];
      const hasText =
        (buffers?.positive?.length || 0) > 0 ||
        (buffers?.neutral?.length || 0) > 0 ||
        (buffers?.negative?.length || 0) > 0;
      if (hasOptions || hasText) {
        readyCount++;
      }
    }

    return {
      status: entry.status,
      ready: readyCount,
      total: entry.totalAiQuestions,
      usedLLM: entry.usedLLM,
      detectedMode: entry.detectedMode || null,
      confidence: entry.confidence !== undefined ? entry.confidence : null,
      reason: entry.reason || null,
      audience: entry.audience || null,
      effectiveMode: entry.effectiveMode || "research",
    };
  }

  /**
   * Clears entire cache (for testing).
   */
  clear() {
    this.cache.clear();
  }
}

const answerCache = new AnswerCache();
export default answerCache;
export { AnswerCache };
