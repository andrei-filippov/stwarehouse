import { useEffect, useRef, useCallback } from 'react';
import { isProxyMode } from '../lib/supabase';

interface LongPollingOptions {
  tables: string[];
  companyId?: string;
  onChange: (changedTables: string[]) => void;
  enabled?: boolean;
}

/**
 * Long Polling hook for environments without WebSocket support (Yandex proxy).
 * 
 * Instead of polling every X seconds, makes one long HTTP request.
 * Server holds the connection open until data changes or timeout (30s).
 * 
 * Reduces requests from ~12/min (5s interval) to ~1-2/min.
 */
export function useLongPolling(options: LongPollingOptions) {
  const { tables, companyId, onChange, enabled = true } = options;
  const abortControllerRef = useRef<AbortController | null>(null);
  const timestampsRef = useRef<Record<string, string>>({});
  const isRunningRef = useRef(false);

  const poll = useCallback(async () => {
    if (!enabled || !companyId) return;
    if (!isProxyMode()) return; // Only use in proxy mode
    if (isRunningRef.current) return;
    
    // Don't poll during night hours
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 8) {
      // Retry after night ends
      setTimeout(poll, 10 * 60 * 1000);
      return;
    }
    
    isRunningRef.current = true;
    
    try {
      abortControllerRef.current = new AbortController();
      
      const proxyUrl = `${window.location.origin}/api/longpoll`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tables,
          companyId,
          lastTimestamps: timestampsRef.current
        }),
        signal: abortControllerRef.current.signal
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.changed) {
          // Update timestamps
          Object.entries(data.changes).forEach(([table, timestamp]) => {
            timestampsRef.current[table] = timestamp as string;
          });
          
          // Notify about changes
          onChange(Object.keys(data.changes));
        }
      }
    } catch (error) {
      // AbortError is expected when component unmounts
      if ((error as Error).name !== 'AbortError') {
        console.error('[LongPolling] Error:', error);
      }
    } finally {
      isRunningRef.current = false;
      
      // Immediately start next poll
      if (enabled && document.visibilityState === 'visible') {
        setTimeout(poll, 1000);
      }
    }
  }, [enabled, companyId, tables, onChange]);

  useEffect(() => {
    if (!enabled || !companyId) return;
    
    // Start polling
    poll();
    
    // Resume polling when tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isRunningRef.current) {
        poll();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [poll, enabled, companyId]);
}
