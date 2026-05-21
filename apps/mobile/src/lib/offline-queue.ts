/**
 * Offline-first sync queue for daily entries.
 *
 * Persistence: MMKV (fast, sync I/O).
 * Strategy:
 *   1. User submits entry → if online, POST direct via tRPC; if fail/offline, enqueue.
 *   2. App-foreground / network reconnect → flush queue oldest-first.
 *   3. Each item has retry count, max 5 attempts before flagging needs-review.
 */
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'sitelog-offline' });
const KEY = 'entry-queue.v1';

export interface QueuedEntry {
  id: string;             // ULID
  payload: unknown;       // matches entry.submit input
  attempts: number;
  enqueuedAt: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}

function load(): QueuedEntry[] {
  const raw = storage.getString(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function save(q: QueuedEntry[]) {
  storage.set(KEY, JSON.stringify(q));
}

export function enqueue(payload: unknown): QueuedEntry {
  const item: QueuedEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload, attempts: 0, enqueuedAt: Date.now(), status: 'pending',
  };
  const q = load(); q.push(item); save(q);
  return item;
}

export function list(): QueuedEntry[] { return load(); }

export function size(): number { return load().length; }

export function remove(id: string) {
  save(load().filter(x => x.id !== id));
}

export function markFailed(id: string, error: string) {
  const q = load();
  const idx = q.findIndex(x => x.id === id);
  if (idx < 0) return;
  q[idx]!.attempts += 1;
  q[idx]!.lastError = error;
  q[idx]!.status = q[idx]!.attempts >= 5 ? 'failed' : 'pending';
  save(q);
}

export function markSyncing(id: string) {
  const q = load();
  const idx = q.findIndex(x => x.id === id);
  if (idx < 0) return;
  q[idx]!.status = 'syncing';
  save(q);
}

/**
 * Flush — caller passes a sender (typically tRPC mutation runner).
 * Returns counts: { sent, failed, remaining }.
 */
export async function flush(send: (payload: unknown) => Promise<unknown>) {
  let sent = 0, failed = 0;
  const queue = load();
  for (const item of queue) {
    if (item.status === 'failed' && item.attempts >= 5) continue;
    markSyncing(item.id);
    try {
      await send(item.payload);
      remove(item.id);
      sent++;
    } catch (e: any) {
      markFailed(item.id, e?.message ?? String(e));
      failed++;
    }
  }
  return { sent, failed, remaining: list().length };
}
