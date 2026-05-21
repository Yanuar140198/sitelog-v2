/**
 * Web Push subscription helper — client side.
 *
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY env. Server signs notifications with private key.
 */
'use client';

function urlBase64ToUint8(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

export async function subscribeWebPush(): Promise<{ endpoint: string; p256dh: string; authKey: string } | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) { console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY missing'); return null; }
  const reg = await navigator.serviceWorker.register('/sw.js');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8(vapid),
  });
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    authKey: json.keys?.auth ?? '',
  };
}
