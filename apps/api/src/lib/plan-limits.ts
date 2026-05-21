/**
 * Plan limits enforcement — checked at mutation time for resource creation.
 */
import { db, subscription, project } from '@sitelog/db';
import { and, eq, isNull, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export interface PlanLimits {
  projects: number;       // -1 = unlimited
  seats: number;
  storageGb: number;
  aiCallsPerMonth: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  trial:      { projects: 3,   seats: 5,  storageGb: 1,   aiCallsPerMonth: 50 },
  starter:    { projects: 10,  seats: 5,  storageGb: 10,  aiCallsPerMonth: 500 },
  pro:        { projects: 100, seats: 25, storageGb: 100, aiCallsPerMonth: 5000 },
  enterprise: { projects: -1,  seats: -1, storageGb: -1,  aiCallsPerMonth: -1 },
};

export async function getOrgPlanLimits(orgId: string): Promise<PlanLimits> {
  const [sub] = await db.select().from(subscription).where(eq(subscription.organizationId, orgId)).limit(1);
  const plan = sub?.plan ?? 'trial';
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial!;
}

export async function assertProjectQuota(orgId: string) {
  const limits = await getOrgPlanLimits(orgId);
  if (limits.projects === -1) return;
  const [row] = await db.select({ c: count() }).from(project)
    .where(and(eq(project.organizationId, orgId), isNull(project.deletedAt)));
  const current = Number(row?.c ?? 0);
  if (current >= limits.projects) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Plan limit reached: ${limits.projects} projects max. Upgrade to add more.`,
    });
  }
}
