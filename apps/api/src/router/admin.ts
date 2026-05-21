/**
 * Sitelog super-admin (ops team) router — view all orgs across the platform.
 *
 * Access gated by SITELOG_ADMIN_EMAILS env (comma-separated allowlist).
 * Not RBAC at org level — this is platform-level superuser.
 */
import { z } from 'zod';
import { desc, eq, count, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { organization, subscription, membership, project, user } from '@sitelog/db';
import { TRPCError } from '@trpc/server';

function assertSuperAdmin(email: string) {
  const allow = (process.env.SITELOG_ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!allow.includes(email.toLowerCase())) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a Sitelog super-admin' });
  }
}

const superProcedure = protectedProcedure.use(({ ctx, next }) => {
  assertSuperAdmin(ctx.session.user.email);
  return next({ ctx });
});

export const adminRouter = router({
  orgs: superProcedure.query(async ({ ctx }) => {
    const orgs = await ctx.db.select({
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
      plan: organization.plan,
      createdAt: organization.createdAt,
      trialEndsAt: organization.trialEndsAt,
    }).from(organization).orderBy(desc(organization.createdAt));

    // Counts
    const subs = await ctx.db.select().from(subscription);
    const subMap = new Map(subs.map(s => [s.organizationId, s]));

    const memberCounts = await ctx.db.select({
      orgId: membership.organizationId,
      c: count(),
    }).from(membership).groupBy(membership.organizationId);
    const memberMap = new Map(memberCounts.map(r => [r.orgId, Number(r.c)]));

    const projectCounts = await ctx.db.select({
      orgId: project.organizationId,
      c: count(),
    }).from(project).groupBy(project.organizationId);
    const projMap = new Map(projectCounts.map(r => [r.orgId, Number(r.c)]));

    return orgs.map(o => ({
      ...o,
      subscriptionStatus: subMap.get(o.id)?.status ?? null,
      memberCount: memberMap.get(o.id) ?? 0,
      projectCount: projMap.get(o.id) ?? 0,
    }));
  }),

  stats: superProcedure.query(async ({ ctx }) => {
    const [orgCount] = await ctx.db.select({ c: count() }).from(organization);
    const [userCount] = await ctx.db.select({ c: count() }).from(user);
    const [projCount] = await ctx.db.select({ c: count() }).from(project);
    const subRows = await ctx.db.select().from(subscription);
    const planCounts: Record<string, number> = {};
    for (const s of subRows) planCounts[s.plan] = (planCounts[s.plan] ?? 0) + 1;
    return {
      orgs: Number(orgCount?.c ?? 0),
      users: Number(userCount?.c ?? 0),
      projects: Number(projCount?.c ?? 0),
      bySubscriptionPlan: planCounts,
    };
  }),
});
