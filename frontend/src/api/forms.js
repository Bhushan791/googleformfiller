import client from './client';

/**
 * POST /api/parse-form — send a Google Form URL for parsing.
 * @param {string} url  The Google Forms URL
 * @param {object} [settings] Optional generation settings
 * @returns {Promise<object>}  { success, data: { title, description, formId, ... } }
 */
export async function parseForm(url, settings = {}) {
  const { data } = await client.post('/api/parse-form', { url, settings });
  return data;
}

/**
 * POST /api/prewarm — trigger background prewarming when settings change.
 */
export async function triggerPrewarm({ formKey, questions, formContext, settings }) {
  const { data } = await client.post('/api/prewarm', {
    formKey,
    questions,
    formContext,
    settings,
  });
  return data;
}

/**
 * GET /api/prewarm/:formKey — poll status of prewarmed answers.
 */
export async function getPrewarmStatus(formKey) {
  const { data } = await client.get(`/api/prewarm/${formKey}`);
  return data;
}

