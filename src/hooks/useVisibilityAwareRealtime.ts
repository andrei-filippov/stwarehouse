import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook that manages Supabase Realtime subscriptions with visibility awareness.
 * Unsubscribes when tab is hidden to prevent background fetch requests.
 * Resubscribes when tab becomes visible again.
 */
export function useVisibilityAwareRealtime(
  subscribeFn: () => RealtimeChannel,
  deps: React.DependencyList = []
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        // Tab hidden: unsubscribe to stop background traffic
        if (channelRef.current && isSubscribedRef.current) {
          supabase.removeChannel(channelRef.current);
          isSubscribedRef.current = false;
          channelRef.current = null;
        }
      } else {
        // Tab visible: resubscribe
        if (!isSubscribedRef.current) {
          channelRef.current = subscribeFn();
          isSubscribedRef.current = true;
        }
      }
    };

    // Initial subscription (only if visible)
    if (!document.hidden) {
      channelRef.current = subscribeFn();
      isSubscribedRef.current = true;
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        isSubscribedRef.current = false;
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
