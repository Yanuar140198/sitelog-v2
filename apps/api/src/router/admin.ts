/**
 * Sitelog super-admin (ops team) router — view all orgs across the platform.
 *
 * Access gated by SITELOG_ADMIN_EMAILS env (comma-separated allowlist).
 * Not RBAC at org level — this is platform-level superuser.
 */
import { z } from 'zod';
import { desc, eq, count } from 'drizzle-orm';
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

  orgDetail: superProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const [org] = await ctx.db.select().from(organization).where(eq(organization.slug, input.slug)).limit(1);
    if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found' });
    const [sub] = await ctx.db.select().from(subscription).where(eq(subscription.organizationId, org.id)).limit(1);
    const members = await ctx.db.select({
      userId: membership.userId, role: membership.role, acceptedAt: membership.acceptedAt,
      email: user.email, name: user.name,
    }).from(membership).innerJoin(user, eq(user.id, membership.userId))
      .where(eq(membership.organizationId, org.id)).orderBy(desc(membership.acceptedAt));
    const projects = await ctx.db.select({
      id: project.id, code: project.code, name: project.name, status: project.status, createdAt: project.createdAt,
    }).from(project).where(eq(project.organizationId, org.id)).orderBy(desc(project.createdAt));
    return { org, subscription: sub ?? null, members, projects };
  }),

  /** Recent webhook deliveries across all orgs — ops debugging. */
  recentWebhookDeliveries: superProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      const { webhookDelivery, webhookEndpoint } = await import('@sitelog/db');
      return ctx.db.select({
        id: webhookDelivery.id,
        event: webhookDelivery.event,
        responseStatus: webhookDelivery.responseStatus,
        attempts: webhookDelivery.attempts,
        createdAt: webhookDelivery.createdAt,
        deliveredAt: webhookDelivery.deliveredAt,
        endpointUrl: webhookEndpoint.url,
        organizationId: webhookEndpoint.organizationId,
      }).from(webhookDelivery)
        .innerJoin(webhookEndpoint, eq(webhookEndpoint.id, webhookDelivery.endpointId))
        .orderBy(desc(webhookDelivery.createdAt))
        .limit(input.limit);
    }),

  setPlan: superProcedure.input(z.object({
    slug: z.string(), plan: z.enum(['trial', 'starter', 'pro', 'enterprise']),
  })).mutation(async ({ ctx, input }) => {
    const [org] = await ctx.db.select().from(organization).where(eq(organization.slug, input.slug)).limit(1);
    if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
    await ctx.db.update(organization).set({ plan: input.plan }).where(eq(organization.id, org.id));
    return { ok: true, plan: input.plan };
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
