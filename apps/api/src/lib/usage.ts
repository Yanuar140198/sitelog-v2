/**
 * Usage recording — increments usage_record rows per metric per period.
 *
 * For Stripe metered billing, a periodic job aggregates these and reports via
 * stripe.subscriptionItems.createUsageRecord.
 */
import { db, usageRecord } from '@sitelog/db';
import { and, eq, gte, lte, sum } from 'drizzle-orm';

export type UsageMetric = 'ai_calls' | 'photos_uploaded_mb' | 'api_calls' | 'entries_submitted';

function periodBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

export async function recordUsage(orgId: string, metric: UsageMetric, value: number = 1) {
  if (!orgId) return;
  const { start, end } = periodBounds();
  try {
    await db.insert(usageRecord).values({
      organizationId: orgId,
      metric,
      value: String(value),
      periodStart: start,
      periodEnd: end,
    });
  } catch (e) {
    console.error('[usage] failed', metric, e);
  }
}

export async function aggregateMonth(orgId: string, metric: UsageMetric, when = new Date()) {
  const { start, end } = periodBounds(when);
  const [row] = await db.select({ total: sum(usageRecord.value) }).from(usageRecord)
    .where(and(
      eq(usageRecord.organizationId, orgId),
      eq(usageRecord.metric, metric),
      gte(usageRecord.periodStart, start),
      lte(usageRecord.periodEnd, end),
    ));
  return Number(row?.total ?? 0);
}
