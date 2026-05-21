/**
 * Photo upload queue with R2 retry.
 *
 * Each item: local file URI + projectId + metadata. On flush:
 *   1. Get presigned URL via tRPC
 *   2. PUT bytes to R2
 *   3. On success → remove from queue
 *   4. On fail → increment attempts, retry later with backoff
 */
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'sitelog-photos' });
const KEY = 'photo-queue.v1';

export interface QueuedPhoto {
  id: string;
  localUri: string;
  projectId: string;
  contentType: string;
  ext: string;
  caption?: string;
  lat?: number;
  lng?: number;
  attempts: number;
  enqueuedAt: number;
  status: 'pending' | 'uploading' | 'failed';
  lastError?: string;
  // Set after successful PUT:
  storageKey?: string;
}

function load(): QueuedPhoto[] {
  const raw = storage.getString(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function save(q: QueuedPhoto[]) { storage.set(KEY, JSON.stringify(q)); }

export function enqueuePhoto(p: Omit<QueuedPhoto, 'id' | 'attempts' | 'enqueuedAt' | 'status'>): QueuedPhoto {
  const item: QueuedPhoto = {
    ...p, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    attempts: 0, enqueuedAt: Date.now(), status: 'pending',
  };
  const q = load(); q.push(item); save(q);
  return item;
}

export function list(): QueuedPhoto[] { return load(); }
export function size(): number { return load().filter(p => !p.storageKey).length; }
export function remove(id: string) { save(load().filter(x => x.id !== id)); }

export function markStatus(id: string, status: QueuedPhoto['status'], error?: string, storageKey?: string) {
  const q = load();
  const idx = q.findIndex(x => x.id === id);
  if (idx < 0) return;
  q[idx]!.status = status;
  if (error) { q[idx]!.lastError = error; q[idx]!.attempts++; }
  if (storageKey) q[idx]!.storageKey = storageKey;
  save(q);
}

/**
 * Flush — caller provides presign + upload functions.
 * Returns { uploaded: number, failed: number, remaining: number }.
 */
export async function flushPhotos(
  presign: (projectId: string, contentType: string, ext: string) => Promise<{ url: string; storageKey: string; stub: boolean }>,
) {
  let uploaded = 0, failed = 0;
  const items = load().filter(p => !p.storageKey && p.attempts < 5);
  for (const item of items) {
    markStatus(item.id, 'uploading');
    try {
      const presigned = await presign(item.projectId, item.contentType, item.ext);
      if (presigned.stub) { markStatus(item.id, 'failed', 'R2 not configured'); failed++; continue; }
      // Use FileSystem from React Native side via the caller; here we do simple fetch-based PUT via blob URL.
      const fileRes = await fetch(item.localUri);
      const blob = await fileRes.blob();
      const putRes = await fetch(presigned.url, {
        method: 'PUT',
        headers: { 'content-type': item.contentType },
        body: blob,
      });
      if (!putRes.ok) throw new Error(`PUT ${putRes.status}`);
      markStatus(item.id, 'pending', undefined, presigned.storageKey);
      uploaded++;
    } catch (e: any) {
      markStatus(item.id, 'failed', e?.message ?? String(e));
      failed++;
    }
  }
  return { uploaded, failed, remaining: size() };
}
