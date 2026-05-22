/**
 * Feature flag resolution + admin CRUD.
 * - resolveAll: orgProcedure, returns all flags with computed enabled state for this org
 * - list (super-admin): global flag inventory
 * - set (super-admin): toggle global + rollout pct
 * - setOverride (super-admin): per-org override
 */
import { z } from 'zod';
import { router, protectedProcedure, orgProcedure } from '../trpc.js';
import { db, featureFlag, featureFlagOverride } from '@sitelog/db';
import { eq, and } from 'drizzle-orm';
import { evaluateFlag } from '@sitelog/shared';
import { TRPCError } from '@trpc/server';

function assertSuperAdmin(email: string) {
  const allow = (process.env.SITELOG_ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!allow.includes(email.toLowerCase())) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a Sitelog super-admin' });
  }
}

export const featureFlagRouter = router({
  /** Get all flags + their computed state for the current org. */
  resolveAll: orgProcedure.query(async ({ ctx }) => {
    const flags = await db.select().from(featureFlag);
    const overrides = await db.select().from(featureFlagOverride)
      .where(eq(featureFlagOverride.organizationId, ctx.session.organizationId));
    const overrideMap = new Map(overrides.map(o => [o.flagKey, o.enabled]));
    return flags.map(f => ({
      key: f.key,
      description: f.description,
      enabled: evaluateFlag(
        { enabledGlobally: f.enabledGlobally, rolloutPct: f.rolloutPct },
        ctx.session.organizationId,
        overrideMap.has(f.key) ? overrideMap.get(f.key)! : null,
      ),
      enabledGlobally: f.enabledGlobally,
      rolloutPct: f.rolloutPct,
      hasOverride: overrideMap.has(f.key),
    }));
  }),

  /** Super-admin: list all flag definitions. */
  list: protectedProcedure.query(async ({ ctx }) => {
    assertSuperAdmin(ctx.session.user.email);
    return db.select().from(featureFlag);
  }),

  /** Super-admin: update global flag state + rollout %. */
  set: protectedProcedure
    .input(z.object({
      key: z.string().min(1).max(120),
      enabledGlobally: z.boolean(),
      rolloutPct: z.number().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      assertSuperAdmin(ctx.session.user.email);
      await db.update(featureFlag)
        .set({ enabledGlobally: input.enabledGlobally, rolloutPct: input.rolloutPct, updatedAt: new Date() })
        .where(eq(featureFlag.key, input.key));
      return { ok: true };
    }),

  /** Super-admin: per-org override (set or clear). */
  setOverride: protectedProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      flagKey: z.string(),
      enabled: z.boolean().nullable(),  // null = clear override
    }))
    .mutation(async ({ ctx, input }) => {
      assertSuperAdmin(ctx.session.user.email);
      if (input.enabled === null) {
        await db.delete(featureFlagOverride).where(and(
          eq(featureFlagOverride.organizationId, input.organizationId),
          eq(featureFlagOverride.flagKey, input.flagKey),
        ));
      } else {
        await db.insert(featureFlagOverride).values({
          organizationId: input.organizationId,
          flagKey: input.flagKey,
          enabled: input.enabled,
        }).onConflictDoUpdate({
          target: [featureFlagOverride.organizationId, featureFlagOverride.flagKey],
          set: { enabled: input.enabled },
        });
      }
      return { ok: true };
    }),
});
