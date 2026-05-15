import { useEffect, useRef, useCallback } from 'react';
import { supabase, isProxyMode, safeChannel } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeTableConfig {
  table: string;
  filter?: string;
  onChange: () => void;
}

interface UseRealtimeWithFallbackOptions {
  channelName: string;
  tables: RealtimeTableConfig[];
  companyId?: string;
  /** Polling interval in proxy mode (ms). Default: 60000 */
  pollingIntervalMs?: number;
  /** Whether to enable at all */
  enabled?: boolean;
}

/**
 * Universal hook: uses Supabase Realtime on Vercel,
 * falls back to smart polling on Yandex proxy.
 * 
 * Features:
 * - Realtime (WebSocket) on Vercel - instant updates
 * - Smart polling on Yandex - respects document.hidden, night hours
 * - Optimistic mutations compatible
 */
export function useRealtimeWithFallback(options: UseRealtimeWithFallbackOptions) {
  const {
    channelName,
    tables,
    companyId,
    pollingIntervalMs = 60000,
    enabled = true
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tablesRef = useRef(tables);
  const isProxy = isProxyMode();

  // Keep tables ref up to date without triggering re-subscription
  tablesRef.current = tables;

  // Cleanup function
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !companyId) return;

    cleanup();

    if (isProxy) {
      // PROXY MODE: Smart polling with visibility check
      const tick = () => {
        // Skip if tab hidden
        if (document.hidden) return;
        
        // Skip night hours (23:00 - 08:00)
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 8) return;
        
        // Trigger all callbacks (use ref to avoid stale closures)
        tablesRef.current.forEach(t => t.onChange());
      };

      // Initial tick - but delay slightly to avoid mount storm
      const initialTimeout = setTimeout(tick, 2000);

      intervalRef.current = setInterval(tick, pollingIntervalMs);

      // Resume when tab becomes visible
      const handleVisibility = () => {
        if (!document.hidden) tick();
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        clearTimeout(initialTimeout);
        cleanup();
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }

    // NORMAL MODE: Supabase Realtime (WebSocket)
    const channel = safeChannel(channelName);

    tablesRef.current.forEach(t => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: t.table,
          filter: t.filter,
        },
        () => {
          // Skip if tab hidden to save egress
          if (document.hidden) return;
          t.onChange();
        }
      );
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Subscribed to ${channelName}`);
      }
    });

    channelRef.current = channel;

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, companyId, channelName, pollingIntervalMs, isProxy]);

  return { isProxy };
}
