import client from './client';

/**
 * POST /api/preview — generate 5 sample responses for preview without submitting.
 *
 * @param {Array<object>} questions - Parsed questions
 * @param {object} settings - Generator settings (mix, perQuestion, pools, etc.)
 * @returns {Promise<object>} - { success: true, data: { responses, metadata } }
 */
export async function previewResponses(questions, settings, formKey = null) {
  const { data } = await client.post('/api/preview', {
    questions,
    settings,
    formKey,
  });
  return data;
}

