import client from './client';

/**
 * Creates a new submission job.
 * @param {object} payload - { formUrl, count, settings, delay }
 * @returns {Promise<object>} - { success: true, data: { jobId, total, ... } }
 */
export async function createJob({ formUrl, count, settings, delay }) {
  const { data } = await client.post('/api/jobs', {
    formUrl,
    count,
    settings,
    delay,
  });
  return data;
}

/**
 * Fetches current job status and progress.
 * @param {string} jobId
 * @returns {Promise<object>} - { success: true, data: { id, status, submitted, failed, remaining, etaSeconds, ... } }
 */
export async function getJobStatus(jobId) {
  const { data } = await client.get(`/api/jobs/${jobId}`);
  return data;
}

/**
 * Pauses a running job.
 * @param {string} jobId
 */
export async function pauseJob(jobId) {
  const { data } = await client.post(`/api/jobs/${jobId}/pause`);
  return data;
}

/**
 * Resumes a paused job.
 * @param {string} jobId
 */
export async function resumeJob(jobId) {
  const { data } = await client.post(`/api/jobs/${jobId}/resume`);
  return data;
}

/**
 * Cancels a job.
 * @param {string} jobId
 */
export async function cancelJob(jobId) {
  const { data } = await client.post(`/api/jobs/${jobId}/cancel`);
  return data;
}

/**
 * Returns the absolute URL to download the job CSV export.
 * @param {string} jobId
 */
export function getExportCsvUrl(jobId) {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  return `${baseURL}/api/jobs/${jobId}/export.csv`;
}

