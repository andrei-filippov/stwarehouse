import { useEffect, useRef, useCallback } from 'react';
import { isProxyMode } from '../lib/supabase';

interface SmartSyncOptions {
  table: string;
  companyId?: string;
  onChange: () => void;
  /** Critical tables sync more frequently */
  critical?: boolean;
  /** Disable auto-sync, only manual refresh */
  manualOnly?: boolean;
}

/**
 * Smart sync hook that balances real-time feel with egress economy.
 * 
 * Strategy:
 * - After mutations: immediate local update (optimistic)
 * - For other users: polling with adaptive intervals
 * - Background tabs: completely paused
 * - Night hours: minimal sync
 */
export function useSmartSync(options: SmartSyncOptions) {
  const { table, companyId, onChange, critical = false, manualOnly = false } = options;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncRef = useRef<number>(0);

  const getInterval = useCallback(() => {
    if (manualOnly) return null;
    
    const hour = new Date().getHours();
    const isNight = hour >= 23 || hour < 8;
    
    // Night: minimal syncing
    if (isNight) return critical ? 120000 : 300000; // 2-5 min
    
    // Day: adaptive based on criticality
    if (critical) return 15000;  // 15 sec for critical (checklists, finances)
    if (isProxyMode()) return 60000; // 1 min for proxy mode
    return 120000; // 2 min for normal tables
  }, [critical, manualOnly]);

  useEffect(() => {
    if (!companyId || manualOnly) return;

    const intervalMs = getInterval();
    if (!intervalMs) return;

    const tick = () => {
      // Skip if tab hidden
      if (document.hidden) return;
      
      // Skip if recently synced (cache window)
      const now = Date.now();
      if (now - lastSyncRef.current < 5000) return;
      lastSyncRef.current = now;
      
      onChange();
    };

    // Initial sync
    tick();

    intervalRef.current = setInterval(tick, intervalMs);

    // Resume on visibility change
    const handleVisibility = () => {
      if (!document.hidden) {
        lastSyncRef.current = 0; // Reset to force sync
        tick();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [companyId, onChange, getInterval, manualOnly]);

  return {
    /** Force immediate sync */
    syncNow: () => {
      lastSyncRef.current = 0;
      onChange();
    }
  };
}
