import axios from 'axios';

/**
 * Pre-configured axios instance.
 * Base URL comes from VITE_API_URL env var (defaults to localhost:5000).
 */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 15_000, // 15 seconds
  headers: { 'Content-Type': 'application/json' },
});

export default client;

