import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getJobStatus,
  pauseJob as apiPauseJob,
  resumeJob as apiResumeJob,
  cancelJob as apiCancelJob,
} from '../api/jobs';

export default function useJob(jobId) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const pollingRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    if (!jobId) {
      setJob(null);
      return null;
    }
    try {
      const res = await getJobStatus(jobId);
      if (res?.data) {
        setJob(res.data);
        setError(null);
        return res.data;
      }
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to fetch job status.';
      setError(msg);
    }
    return null;
  }, [jobId]);

  // Initial fetch and polling loop
  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const checkAndSchedule = async () => {
      const current = await fetchStatus();
      if (!isMounted) return;
      setLoading(false);

      const status = current?.status;
      // Continue polling only if active or paused
      if (status === 'queued' || status === 'running' || status === 'paused') {
        pollingRef.current = setTimeout(checkAndSchedule, 2000);
      }
    };

    checkAndSchedule();

    return () => {
      isMounted = false;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [jobId, fetchStatus]);

  const pause = useCallback(async () => {
    if (!jobId) return;
    setActionLoading(true);
    try {
      await apiPauseJob(jobId);
      await fetchStatus();
    } catch (err) {
      setError(
        err.response?.data?.error?.message || 'Failed to pause job.'
      );
    } finally {
      setActionLoading(false);
    }
  }, [jobId, fetchStatus]);

  const resume = useCallback(async () => {
    if (!jobId) return;
    setActionLoading(true);
    try {
      await apiResumeJob(jobId);
      await fetchStatus();
    } catch (err) {
      setError(
        err.response?.data?.error?.message || 'Failed to resume job.'
      );
    } finally {
      setActionLoading(false);
    }
  }, [jobId, fetchStatus]);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    setActionLoading(true);
    try {
      await apiCancelJob(jobId);
      await fetchStatus();
    } catch (err) {
      setError(
        err.response?.data?.error?.message || 'Failed to cancel job.'
      );
    } finally {
      setActionLoading(false);
    }
  }, [jobId, fetchStatus]);

  return {
    job,
    loading,
    error,
    actionLoading,
    refresh: fetchStatus,
    pause,
    resume,
    cancel,
  };
}

