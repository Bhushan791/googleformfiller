import client from './client';

/**
 * POST /api/parse-form — send a Google Form URL for parsing.
 * @param {string} url  The Google Forms URL
 * @returns {Promise<object>}  { success, data: { title, description, formId, ... } }
 */
export async function parseForm(url) {
  const { data } = await client.post('/api/parse-form', { url });
  return data;
}

