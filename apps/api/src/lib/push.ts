/**
 * Push notification dispatcher — Expo + Web Push.
 *
 * Expo: https://exp.host/--/api/v2/push/send (no SDK needed; simple POST)
 * Web Push: requires `web-push` library + VAPID keys
 */
import { db, pushSubscription } from '@sitelog/db';
import { eq } from 'drizzle-orm';

interface PushPayload {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

async function sendExpo(tokens: string[], payload: PushPayload) {
  if (!tokens.length) return;
  const messages = tokens.map(to => ({
    to, title: payload.title, body: payload.body,
    data: payload.data, sound: 'default',
  }));
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (e) { console.error('[push/expo]', e); }
}

async function sendWebPush(_subs: Array<{ token: string; p256dh: string | null; authKey: string | null }>, _payload: PushPayload) {
  // Stub — wire `web-push` lib + VAPID_PUBLIC + VAPID_PRIVATE env
  // for (const s of subs) { await webpush.sendNotification({endpoint: s.token, keys: {p256dh, auth}}, JSON.stringify(payload)); }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const subs = await db.select().from(pushSubscription).where(eq(pushSubscription.userId, userId));
  const expoTokens = subs.filter(s => s.kind === 'expo').map(s => s.token);
  const webSubs = subs.filter(s => s.kind === 'web-push').map(s => ({ token: s.token, p256dh: s.p256dh, authKey: s.authKey }));
  await Promise.all([sendExpo(expoTokens, payload), sendWebPush(webSubs, payload)]);
}
