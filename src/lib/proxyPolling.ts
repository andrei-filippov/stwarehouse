/**
 * Unified polling manager for Yandex proxy mode (no WebSocket).
 * Single interval instead of multiple per-hook intervals.
 * Reduces requests by batching and caching.
 */

import { isProxyMode } from './supabase';

interface PollingTask {
  id: string;
  callback: () => void;
  intervalMs: number;
  lastRun: number;
}

const tasks = new Map<string, PollingTask>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const TICK_MS = 5000; // Check every 5 seconds which tasks are due

function tick() {
  if (!isProxyMode()) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  // Night hours: 23:00 - 08:00 - no polling
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 8) return;

  const now = Date.now();
  for (const task of tasks.values()) {
    if (now - task.lastRun >= task.intervalMs) {
      task.lastRun = now;
      try {
        task.callback();
      } catch (e) {
        console.error('[ProxyPolling] Task error:', task.id, e);
      }
    }
  }
}

function start() {
  if (isRunning) return;
  isRunning = true;
  intervalId = setInterval(tick, TICK_MS);
}

function stop() {
  if (!isRunning) return;
  isRunning = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function registerProxyPolling(
  id: string,
  callback: () => void,
  intervalMs: number = 60000
) {
  if (!isProxyMode()) return () => {}; // No-op on Vercel

  tasks.set(id, { id, callback, intervalMs, lastRun: 0 });
  start();

  return () => {
    tasks.delete(id);
    if (tasks.size === 0) {
      stop();
    }
  };
}

// Auto-stop when tab hidden
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Don't stop, just skip ticks. Tasks resume when visible.
    }
  });
}
