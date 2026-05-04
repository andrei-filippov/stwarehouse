import { useEffect, useRef, useCallback } from 'react';

/**
 * Universal polling hook for environments without WebSocket support (e.g., Yandex proxy)
 * 
 * @param callback - function to call on each poll
 * @param intervalMs - polling interval in milliseconds (default: 10000 = 10s)
 * @param enabled - whether polling is enabled (default: true when using proxy)
 */
export function usePolling(
  callback: () => void,
  intervalMs: number = 10000,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (enabled) {
      intervalRef.current = setInterval(() => {
        savedCallback.current();
      }, intervalMs);
    }
  }, [enabled, intervalMs]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  return { startPolling, stopPolling };
}

/**
 * Check if we're running through proxy (no WebSocket support)
 */
export function isProxyMode(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.includes('yandexcloud.net');
}
