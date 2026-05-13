import { useEffect, useRef, useCallback } from 'react';

interface PollingOptions {
  /** Polling interval in ms (default: 60000) */
  intervalMs?: number;
  /** Whether polling is enabled */
  enabled?: boolean;
  /** Pause when tab is hidden (default: true) */
  pauseWhenHidden?: boolean;
  /** Run immediately on start (default: true) */
  immediate?: boolean;
  /** Only poll when user is on specific tabs (array of tab IDs) */
  activeTabs?: string[];
  /** Current active tab ID (to check against activeTabs) */
  currentTab?: string;
  /** Minimum time between successful polls in ms (cache window) */
  minPollIntervalMs?: number;
}

/**
 * Smart polling hook for environments without WebSocket support (e.g., Yandex proxy)
 * 
 * Features:
 * - Pausable when tab is hidden (visibility API)
 * - Only polls when user is on relevant pages
 * - Configurable interval
 * - Immediate first run
 * - Clean start/stop controls
 */
export function usePolling(
  callback: () => void | Promise<void>,
  options: PollingOptions = {}
) {
  const {
    intervalMs = 60000,
    enabled = true,
    pauseWhenHidden = true,
    immediate = true,
    activeTabs,
    currentTab,
    minPollIntervalMs = 5000,
  } = options;

  const savedCallback = useRef(callback);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(false);
  const lastPollTimeRef = useRef<number>(0);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  const shouldPoll = useCallback(() => {
    // Don't poll if tab is hidden
    if (pauseWhenHidden && document.hidden) return false;
    // Don't poll if not on active tab
    if (activeTabs && currentTab && !activeTabs.includes(currentTab)) return false;
    // Don't poll during night hours (23:00 - 08:00) to save egress
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 8) return false;
    return true;
  }, [pauseWhenHidden, activeTabs, currentTab]);

  const tick = useCallback(async () => {
    if (!shouldPoll()) return;
    // Skip if polled recently (cache)
    const now = Date.now();
    if (now - lastPollTimeRef.current < minPollIntervalMs) return;
    lastPollTimeRef.current = now;
    await savedCallback.current();
  }, [shouldPoll, minPollIntervalMs]);

  const startPolling = useCallback(() => {
    if (intervalRef.current || !enabled) return;
    
    isRunningRef.current = true;
    
    // Immediate first tick (only if should poll)
    if (shouldPoll()) {
      tick();
    }
    
    intervalRef.current = setInterval(() => {
      tick();
    }, intervalMs);
  }, [enabled, intervalMs, tick, shouldPoll]);

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

  // Restart polling when tab changes
  useEffect(() => {
    if (!enabled) return;
    stopPolling();
    startPolling();
  }, [currentTab, enabled, startPolling, stopPolling]);

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
