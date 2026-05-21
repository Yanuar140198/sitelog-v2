/**
 * Webhook delivery retry — exponential backoff.
 *
 * Run periodically (e.g. every 5 min via cron). Finds failed deliveries < 5 attempts
 * and replays them with computed delay since last attempt.
 */
import { db, webhookDelivery, webhookEndpoint } from '@sitelog/db';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { signPayload } from './webhooks.js';

const BACKOFF_MIN = [60, 300, 900, 3600, 14400];  // seconds: 1m, 5m, 15m, 1h, 4h

export async function retryFailedDeliveries(): Promise<{ retried: number; succeeded: number; abandoned: number }> {
  const failed = await db.select().from(webhookDelivery)
    .where(and(isNull(webhookDelivery.deliveredAt), lt(webhookDelivery.attempts, 5)));
  let retried = 0, succeeded = 0, abandoned = 0;
  for (const d of failed) {
    const idx = Math.min(d.attempts, BACKOFF_MIN.length - 1);
    const waitSec = BACKOFF_MIN[idx]!;
    const last = d.failedAt ?? d.createdAt;
    if (Date.now() - new Date(last).getTime() < waitSec * 1000) continue;

    const [ep] = await db.select().from(webhookEndpoint).where(eq(webhookEndpoint.id, d.endpointId)).limit(1);
    if (!ep || !ep.active) { abandoned++; continue; }

    retried++;
    const sig = signPayload(ep.secret, d.payload);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);
    let ok = false, status: number | null = null, body: string | null = null;
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-sitelog-event': d.event,
          'x-sitelog-signature': sig,
          'x-sitelog-retry': String(d.attempts + 1),
          'user-agent': 'Sitelog-Webhook/1.0',
        },
        body: d.payload,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      status = res.status; body = (await res.text()).slice(0, 1000); ok = res.ok;
    } catch (e: any) {
      clearTimeout(timer);
      body = String(e.message ?? e).slice(0, 500);
    }
    await db.update(webhookDelivery).set({
      attempts: sql`${webhookDelivery.attempts} + 1`,
      responseStatus: status, responseBody: body,
      deliveredAt: ok ? new Date() : null,
      failedAt: ok ? null : new Date(),
    }).where(eq(webhookDelivery.id, d.id));
    if (ok) succeeded++;
  }
  return { retried, succeeded, abandoned };
}
