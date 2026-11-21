import AppError from "../../../utils/AppError.js";

/**
 * Gemini REST adapter using native fetch.
 * Key passed strictly in `x-goog-api-key` header (never in URL, never logged).
 */
export async function geminiAdapter({
  prompt,
  maxTokens = 1000,
  temperature = 0.7,
  jsonMode = false,
  apiKey,
  model,
  baseUrl = "https://generativelanguage.googleapis.com/v1beta",
  signal,
  fetchFn = fetch,
}) {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const url = `${cleanBase}/models/${model}:generateContent`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  const res = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let errMessage = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      errMessage = errJson?.error?.message || errMessage;
    } catch {
      // ignore JSON parse error
    }
    const error = new AppError(
      `Gemini provider error (${res.status}): ${errMessage}`,
      res.status,
      "LLM_PROVIDER_ERROR"
    );
    error.status = res.status;
    throw error;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new AppError(
      "Gemini returned empty or invalid response structure.",
      502,
      "LLM_EMPTY_RESPONSE"
    );
  }

  return text;
}

