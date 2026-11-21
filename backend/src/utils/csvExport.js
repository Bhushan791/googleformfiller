/**
 * Escapes a single cell for CSV, preventing CSV formula injection.
 * Any cell starting with =, +, -, or @ is prefixed with a single quote (').
 */
export function escapeCsvCell(val) {
  if (val === undefined || val === null) {
    return '""';
  }

  let str = Array.isArray(val) ? val.join("; ") : String(val);

  // Prevent CSV Formula Injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape internal double quotes
  const escaped = str.replace(/"/g, '""');

  return `"${escaped}"`;
}

/**
 * Builds a full CSV string for a job's responses and results.
 */
export function buildJobCsv(job) {
  const questions = job.questions || [];
  const responses = job.responses || [];
  const results = job.results || [];

  // Map results by index
  const resultsByIndex = {};
  for (const r of results) {
    resultsByIndex[r.index] = r;
  }

  // Header row
  const headers = [
    "Index",
    "Sentiment",
    "Submission Status",
    "Submitted At",
    ...questions.map((q) => q.title || q.entryId),
  ];

  const rows = [headers.map(escapeCsvCell).join(",")];

  for (let i = 0; i < responses.length; i++) {
    const resp = responses[i];
    const res = resultsByIndex[resp.index] || resultsByIndex[i];

    const status = res ? res.status : "pending";
    const timestamp = res?.submittedAt || "";

    const rowCells = [
      resp.index + 1,
      resp.sentiment,
      status,
      timestamp,
      ...questions.map((q) => {
        const answerVal = resp.answers?.[q.entryId];
        return answerVal !== undefined && answerVal !== null ? answerVal : "";
      }),
    ];

    rows.push(rowCells.map(escapeCsvCell).join(","));
  }

  return rows.join("\r\n");
}

