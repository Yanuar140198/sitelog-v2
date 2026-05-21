/**
 * Onboarding progress tracking — per user.
 *
 * Steps:
 *   1. create_project — first project created
 *   2. add_boq_scope — first BOQ item
 *   3. add_unit — first fleet unit
 *   4. invite_member — first invite sent
 *   5. submit_entry — first daily entry submitted
 */
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { userPreference } from '@sitelog/db';

const STEP_KEYS = ['create_project', 'add_boq_scope', 'add_unit', 'invite_member', 'submit_entry'] as const;

async function loadSteps(db: any, userId: string): Promise<string[]> {
  const [row] = await db.select().from(userPreference).where(eq(userPreference.userId, userId)).limit(1);
  if (!row?.onboardingSteps) return [];
  try { return JSON.parse(row.onboardingSteps); } catch { return []; }
}

export const onboardingRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db.select().from(userPreference)
      .where(eq(userPreference.userId, ctx.session.user.id)).limit(1);
    const completed = row?.onboardingSteps ? JSON.parse(row.onboardingSteps) : [];
    return {
      steps: STEP_KEYS.map(k => ({ key: k, completed: completed.includes(k) })),
      finishedAt: row?.onboardingCompletedAt ?? null,
      progressPct: Math.round((completed.length / STEP_KEYS.length) * 100),
    };
  }),

  markStep: protectedProcedure
    .input(z.object({ step: z.enum(STEP_KEYS) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await loadSteps(ctx.db, ctx.session.user.id);
      if (existing.includes(input.step)) return { ok: true, alreadyDone: true };
      const next = [...existing, input.step];
      const finishedAt = next.length === STEP_KEYS.length ? new Date() : null;
      const stepsJson = JSON.stringify(next);
      const [row] = await ctx.db.select().from(userPreference).where(eq(userPreference.userId, ctx.session.user.id)).limit(1);
      if (row) {
        await ctx.db.update(userPreference).set({
          onboardingSteps: stepsJson, onboardingCompletedAt: finishedAt ?? row.onboardingCompletedAt, updatedAt: new Date(),
        }).where(eq(userPreference.userId, ctx.session.user.id));
      } else {
        await ctx.db.insert(userPreference).values({
          userId: ctx.session.user.id, onboardingSteps: stepsJson, onboardingCompletedAt: finishedAt,
        });
      }
      return { ok: true, completedCount: next.length, totalCount: STEP_KEYS.length };
    }),

  dismiss: protectedProcedure.mutation(async ({ ctx }) => {
    const [row] = await ctx.db.select().from(userPreference).where(eq(userPreference.userId, ctx.session.user.id)).limit(1);
    if (row) {
      await ctx.db.update(userPreference).set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
        .where(eq(userPreference.userId, ctx.session.user.id));
    } else {
      await ctx.db.insert(userPreference).values({ userId: ctx.session.user.id, onboardingCompletedAt: new Date() });
    }
    return { ok: true };
  }),
});
