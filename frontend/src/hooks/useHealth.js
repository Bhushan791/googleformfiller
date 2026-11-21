import { useState, useEffect, useRef, useCallback } from 'react';
import client from '../api/client';

const POLL_INTERVAL = 45_000; // 45 seconds
const SLOW_THRESHOLD = 5_000; // 5 seconds

/**
 * Polls GET /health and derives a status:
 *   "online"  – success, response < 5 s
 *   "waking"  – success but slow, or first request still pending after 5 s
 *   "offline" – request failed / timed out
 *
 * Returns { status, responseTime, lastChecked, checkNow }.
 */
export default function useHealth() {
  const [status, setStatus] = useState('waking');        // initial = waking
  const [responseTime, setResponseTime] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const intervalRef = useRef(null);
  const inFlightRef = useRef(false); // prevent overlapping requests
  const wakingTimerRef = useRef(null);

  const check = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    // If this is the very first request, set a 5 s timer to flip to "waking"
    // in case the server is cold-starting.
    if (lastChecked === null) {
      wakingTimerRef.current = setTimeout(() => {
        setStatus((prev) => (prev !== 'online' ? 'waking' : prev));
      }, SLOW_THRESHOLD);
    }

    const start = performance.now();

    try {
      await client.get('/health');
      const elapsed = Math.round(performance.now() - start);

      setResponseTime(elapsed);
      setLastChecked(new Date());
      setStatus(elapsed >= SLOW_THRESHOLD ? 'waking' : 'online');
    } catch {
      setResponseTime(null);
      setLastChecked(new Date());
      setStatus('offline');
    } finally {
      inFlightRef.current = false;
      clearTimeout(wakingTimerRef.current);
    }
  }, [lastChecked]);

  // Start polling on mount
  useEffect(() => {
    check(); // immediate first check

    intervalRef.current = setInterval(check, POLL_INTERVAL);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(wakingTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, responseTime, lastChecked, checkNow: check };
}

