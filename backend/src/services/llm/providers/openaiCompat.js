import AppError from "../../../utils/AppError.js";

/**
 * Generic OpenAI-compatible /chat/completions adapter using native fetch.
 * Covers Groq, OpenRouter, and other OpenAI-compatible endpoints.
 */
export async function openaiCompatAdapter({
  prompt,
  maxTokens = 1000,
  temperature = 0.7,
  jsonMode = false,
  apiKey,
  model,
  baseUrl = "https://api.groq.com/openai/v1",
  signal,
  fetchFn = fetch,
}) {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const url = `${cleanBase}/chat/completions`;

  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  const res = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
      `OpenAI-compatible provider error (${res.status}): ${errMessage}`,
      res.status,
      "LLM_PROVIDER_ERROR"
    );
    error.status = res.status;
    throw error;
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new AppError(
      "OpenAI-compatible provider returned empty or invalid response structure.",
      502,
      "LLM_EMPTY_RESPONSE"
    );
  }

  return text;
}

