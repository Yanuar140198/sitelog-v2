/**
 * Stripe metered billing reporter.
 *
 * Periodically (e.g. daily cron) aggregate usage_record per org → push to Stripe meter event.
 * Requires STRIPE_METER_EVENT_NAME_* env vars per metric.
 */
import { db, subscription, organization } from '@sitelog/db';
import { eq, isNull, not } from 'drizzle-orm';
import { aggregateMonth, type UsageMetric } from './usage.js';
import { stripe } from './stripe.js';

const METER_EVENTS: Record<UsageMetric, string | undefined> = {
  ai_calls: process.env.STRIPE_METER_AI_CALLS,
  photos_uploaded_mb: process.env.STRIPE_METER_STORAGE_MB,
  api_calls: process.env.STRIPE_METER_API_CALLS,
  entries_submitted: undefined,
};

export async function reportAllOrgMeters(): Promise<{ orgs: number; reported: number; errors: number }> {
  if (!stripe) return { orgs: 0, reported: 0, errors: 0 };
  const subs = await db.select().from(subscription).where(not(isNull(subscription.stripeCustomerId)));
  let reported = 0, errors = 0;
  for (const sub of subs) {
    if (!sub.stripeCustomerId) continue;
    for (const [metric, eventName] of Object.entries(METER_EVENTS)) {
      if (!eventName) continue;
      try {
        const value = await aggregateMonth(sub.organizationId, metric as UsageMetric);
        if (value <= 0) continue;
        // Stripe meter event create — needs stripe>=v17 with billing.meterEvent
        await (stripe as any).billing?.meterEvents?.create({
          event_name: eventName,
          payload: {
            stripe_customer_id: sub.stripeCustomerId,
            value: String(Math.round(value)),
          },
        });
        reported++;
      } catch (e) {
        console.error('[meters]', metric, sub.organizationId, e);
        errors++;
      }
    }
  }
  return { orgs: subs.length, reported, errors };
}
