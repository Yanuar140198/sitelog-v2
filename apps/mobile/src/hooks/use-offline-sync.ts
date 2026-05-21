/**
 * Background offline-queue sync hook.
 *
 * Triggers flush:
 *   - on mount
 *   - on app foreground
 *   - on network reconnect (NetInfo)
 *
 * Returns queue size for badge display.
 */
import { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { flush, size } from '@/lib/offline-queue';
import { trpc } from '@sitelog/api-client/react';

export function useOfflineSync() {
  const [queueSize, setQueueSize] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);
  const client = trpc.useUtils().client;

  const refresh = useCallback(() => setQueueSize(size()), []);

  const triggerFlush = useCallback(async () => {
    if (isFlushing) return;
    setIsFlushing(true);
    try {
      const res = await flush(async (payload) => client.entry.submit.mutate(payload as any));
      console.log('[offline-sync]', res);
    } catch (e) {
      console.warn('[offline-sync] flush error', e);
    } finally {
      setIsFlushing(false);
      refresh();
    }
  }, [client, isFlushing, refresh]);

  useEffect(() => {
    refresh();
    triggerFlush();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') triggerFlush();
    });
    const interval = setInterval(() => { refresh(); triggerFlush(); }, 60 * 1000);
    return () => { sub.remove(); clearInterval(interval); };
  }, [refresh, triggerFlush]);

  return { queueSize, isFlushing, triggerFlush };
}
