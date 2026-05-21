/**
 * Plan limits enforcement — checked at mutation time for resource creation.
 *
 * Quota math + limits table comes from @sitelog/shared (unit-tested).
 * This module just adds the DB lookup + TRPCError throw wrapper.
 */
import { db, subscription, project } from '@sitelog/db';
import { and, eq, isNull, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getPlanLimits, checkProjectQuota, type PlanLimits } from '@sitelog/shared';

export { PLAN_LIMITS, type PlanLimits } from '@sitelog/shared';

export async function getOrgPlanLimits(orgId: string): Promise<PlanLimits> {
  const [sub] = await db.select().from(subscription).where(eq(subscription.organizationId, orgId)).limit(1);
  return getPlanLimits(sub?.plan ?? 'trial');
}

export async function getOrgPlan(orgId: string): Promise<string> {
  const [sub] = await db.select().from(subscription).where(eq(subscription.organizationId, orgId)).limit(1);
  return sub?.plan ?? 'trial';
}

export async function assertProjectQuota(orgId: string) {
  const plan = await getOrgPlan(orgId);
  const [row] = await db.select({ c: count() }).from(project)
    .where(and(eq(project.organizationId, orgId), isNull(project.deletedAt)));
  const current = Number(row?.c ?? 0);
  const err = checkProjectQuota(plan, current);
  if (err) throw new TRPCError({ code: 'FORBIDDEN', message: err });
}
