import { useEffect, useRef, useCallback } from 'react';
import { supabase, safeChannel } from '../lib/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Check if we're running through proxy (no WebSocket support)
 */
export function isProxyMode(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.includes('yandexcloud.net');
}

interface RealtimeConfig {
  channelName: string;
  tables: Array<{
    table: string;
    filter?: string;
    onChange: (payload: RealtimePostgresChangesPayload<any>) => void;
  }>;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Universal hook that uses Supabase Realtime when available,
 * or falls back to polling when running through proxy (no WebSocket)
 */
export function useRealtimeOrPolling(
  config: RealtimeConfig,
  deps: React.DependencyList = [],
  pollingIntervalMs: number = 60000
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    cleanup();

    if (isProxyMode()) {
      // Polling mode: trigger all onChange handlers periodically
      // Only poll when tab is visible to save egress
      intervalRef.current = setInterval(() => {
        if (document.hidden) return;
        config.tables.forEach(t => {
          t.onChange({ eventType: '*', new: {}, old: {} } as any);
        });
      }, pollingIntervalMs);
      config.onConnect?.();
      return cleanup;
    }

    // Realtime mode: use Supabase WebSocket
    const channel = safeChannel(config.channelName);
    
    config.tables.forEach(t => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: t.table,
          filter: t.filter,
        },
        t.onChange
      );
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        config.onConnect?.();
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        config.onDisconnect?.();
      }
    });

    channelRef.current = channel;
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { isProxy: isProxyMode() };
}
