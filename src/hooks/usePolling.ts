import { useEffect, useRef, useCallback } from 'react';

interface PollingOptions {
  /** Polling interval in ms (default: 10000) */
  intervalMs?: number;
  /** Whether polling is enabled */
  enabled?: boolean;
  /** Pause when tab is hidden (default: true) */
  pauseWhenHidden?: boolean;
  /** Run immediately on start (default: true) */
  immediate?: boolean;
}

/**
 * Smart polling hook for environments without WebSocket support (e.g., Yandex proxy)
 * 
 * Features:
 * - Pausable when tab is hidden (visibility API)
 * - Configurable interval
 * - Immediate first run
 * - Clean start/stop controls
 */
export function usePolling(
  callback: () => void | Promise<void>,
  options: PollingOptions = {}
) {
  const {
    intervalMs = 10000,
    enabled = true,
    pauseWhenHidden = true,
    immediate = true,
  } = options;

  const savedCallback = useRef(callback);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const tick = useCallback(async () => {
    if (pauseWhenHidden && document.hidden) return;
    await savedCallback.current();
  }, [pauseWhenHidden]);

  const startPolling = useCallback(() => {
    if (intervalRef.current || !enabled) return;
    
    isRunningRef.current = true;
    
    // Immediate first tick
    tick();
    
    intervalRef.current = setInterval(() => {
      tick();
    }, intervalMs);
  }, [enabled, intervalMs, tick]);

  const stopPolling = useCallback(() => {
    isRunningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Handle visibility changes
  useEffect(() => {
    if (!pauseWhenHidden) return;

    const handleVisibility = () => {
      if (!document.hidden && isRunningRef.current) {
        // Immediate check when tab becomes visible
        tick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pauseWhenHidden, tick]);

  // Listen for background sync events from Service Worker
  useEffect(() => {
    if (!enabled) return;
    
    const handleBackgroundSync = () => {
      if (!document.hidden) {
        tick();
      }
    };
    
    window.addEventListener('background-sync', handleBackgroundSync);
    return () => window.removeEventListener('background-sync', handleBackgroundSync);
  }, [enabled, tick]);

  // Auto-start/stop
  useEffect(() => {
    if (enabled && immediate) {
      startPolling();
    }
    return () => stopPolling();
  }, [enabled, immediate, startPolling, stopPolling]);

  return { startPolling, stopPolling, isRunning: () => isRunningRef.current };
}

/**
 * Check if we're running through proxy (no WebSocket support)
 */
export function isProxyMode(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.includes('yandexcloud.net');
}
