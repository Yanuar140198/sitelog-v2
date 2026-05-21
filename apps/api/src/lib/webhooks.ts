/**
 * Outgoing webhook dispatcher with HMAC signing.
 *
 * Pattern: in mutation after success, call:
 *   await dispatchEvent(orgId, 'project.created', { projectId, code, name });
 */
import { db, webhookEndpoint, webhookDelivery } from '@sitelog/db';
import { and, eq } from 'drizzle-orm';
import { createHmac, randomBytes } from 'node:crypto';
import { detectChatTarget, formatForChat } from './chat-notify.js';

export function generateWebhookSecret() {
  return 'whsec_' + randomBytes(32).toString('hex');
}

export function signPayload(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function matchesEvent(subscribed: string, event: string): boolean {
  const events = subscribed.split(',').map(s => s.trim());
  return events.includes('*') || events.includes(event);
}

export async function dispatchEvent(orgId: string, event: string, data: unknown) {
  if (!orgId) return;
  const endpoints = await db.select().from(webhookEndpoint)
    .where(and(eq(webhookEndpoint.organizationId, orgId), eq(webhookEndpoint.active, true)));
  for (const ep of endpoints) {
    if (!matchesEvent(ep.events, event)) continue;
    const target = detectChatTarget(ep.url);
    const body = target === 'generic'
      ? { event, orgId, ts: new Date().toISOString(), data }
      : formatForChat(target, event, { orgId, ts: new Date().toISOString(), ...data as object });
    const payload = JSON.stringify(body);
    const sig = signPayload(ep.secret, payload);
    let respStatus: number | null = null, respBody: string | null = null;
    let delivered = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-sitelog-event': event,
          'x-sitelog-signature': sig,
          'user-agent': 'Sitelog-Webhook/1.0',
        },
        body: payload,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      respStatus = res.status;
      respBody = (await res.text()).slice(0, 1000);
      delivered = res.ok;
    } catch (e: any) {
      clearTimeout(timer);
      respBody = String(e.message ?? e).slice(0, 500);
    }
    await db.insert(webhookDelivery).values({
      endpointId: ep.id, event, payload,
      responseStatus: respStatus, responseBody: respBody,
      attempts: 1,
      deliveredAt: delivered ? new Date() : null,
      failedAt: delivered ? null : new Date(),
    }).catch(() => {});
    await db.update(webhookEndpoint).set({
      lastFiredAt: new Date(), lastStatus: respStatus, lastError: delivered ? null : respBody,
    }).where(eq(webhookEndpoint.id, ep.id)).catch(() => {});
    // Metrics
    import('../metrics.js').then(m => m.bump('webhook_dispatched_total')).catch(() => {});
  }
}
