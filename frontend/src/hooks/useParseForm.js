import { useState, useCallback } from 'react';
import { parseForm } from '../api/forms';

/**
 * Hook for the parse-form flow: loading, error, and data states.
 * Returns { data, loading, error, parse, reset }.
 */
export default function useParseForm() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const parse = useCallback(async (url) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await parseForm(url);
      setData(result.data);
    } catch (err) {
      // Extract the structured error from the backend response
      const serverError = err.response?.data?.error;
      if (serverError) {
        setError(serverError);
      } else {
        setError({
          code: 0,
          errorCode: "NETWORK_ERROR",
          message: "Could not reach the server. Please check your connection.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, parse, reset };
}

