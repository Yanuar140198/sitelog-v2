import { z } from 'zod';
import { router, protectedProcedure, orgProcedure, requireRole } from '../trpc.js';
import { eq } from 'drizzle-orm';
import { organization, membership } from '@sitelog/db';
import { TRPCError } from '@trpc/server';

export const orgRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({ org: organization, role: membership.role })
      .from(membership)
      .innerJoin(organization, eq(membership.organizationId, organization.id))
      .where(eq(membership.userId, ctx.session.user.id));
    return rows;
  }),

  current: orgProcedure.query(async ({ ctx }) => {
    const [org] = await ctx.db
      .select()
      .from(organization)
      .where(eq(organization.id, ctx.session.organizationId))
      .limit(1);
    if (!org) throw new TRPCError({ code: 'NOT_FOUND' });
    return { ...org, role: ctx.session.role };
  }),

  create: protectedProcedure
    .input(z.object({
      slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/),
      name: z.string().min(1).max(255),
    }))
    .mutation(async ({ ctx, input }) => {
      const [org] = await ctx.db.insert(organization).values({
        slug: input.slug,
        name: input.name,
        plan: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      }).returning();
      if (!org) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await ctx.db.insert(membership).values({
        userId: ctx.session.user.id,
        organizationId: org.id,
        role: 'owner',
        acceptedAt: new Date(),
      });
      return org;
    }),

  members: requireRole('owner', 'admin').query(async ({ ctx }) => {
    return ctx.db.query.membership.findMany({
      where: eq(membership.organizationId, ctx.session.organizationId),
      with: { user: true },
    });
  }),

  update: requireRole('owner', 'admin')
    .input(z.object({
      name: z.string().optional(),
      logo: z.string().url().optional().or(z.literal('')),
      currency: z.string().length(3).optional(),
      locale: z.string().max(8).optional(),
      timezone: z.string().max(64).optional(),
      brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      brandSecondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      customDomain: z.string().max(128).optional().or(z.literal('')),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.update(organization).set({ ...input, updatedAt: new Date() })
        .where(eq(organization.id, ctx.session.organizationId)).returning();
      return row;
    }),

  /** Public branding lookup by slug — no auth (for login/share pages). */
  brandingBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [o] = await ctx.db.select({
        name: organization.name, logo: organization.logo,
        brandColor: organization.brandColor, brandSecondary: organization.brandSecondary,
      }).from(organization).where(eq(organization.slug, input.slug)).limit(1);
      return o ?? null;
    }),
});
