import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { pushSubscription } from '@sitelog/db';

export const pushRouter = router({
  register: protectedProcedure
    .input(z.object({
      kind: z.enum(['expo', 'web-push']),
      token: z.string().min(10),
      p256dh: z.string().optional(),
      authKey: z.string().optional(),
      deviceLabel: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Upsert by token (unique)
      const existing = await ctx.db.select().from(pushSubscription).where(eq(pushSubscription.token, input.token)).limit(1);
      if (existing.length > 0) {
        await ctx.db.update(pushSubscription).set({
          userId: ctx.session.user.id,
          lastSeenAt: new Date(), deviceLabel: input.deviceLabel,
        }).where(eq(pushSubscription.id, existing[0]!.id));
        return { ok: true, updated: true };
      }
      await ctx.db.insert(pushSubscription).values({
        userId: ctx.session.user.id,
        kind: input.kind, token: input.token,
        p256dh: input.p256dh, authKey: input.authKey,
        deviceLabel: input.deviceLabel,
      });
      return { ok: true, inserted: true };
    }),

  unregister: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(pushSubscription)
        .where(and(eq(pushSubscription.token, input.token), eq(pushSubscription.userId, ctx.session.user.id)));
      return { ok: true };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select({
      id: pushSubscription.id, kind: pushSubscription.kind,
      deviceLabel: pushSubscription.deviceLabel, lastSeenAt: pushSubscription.lastSeenAt,
      createdAt: pushSubscription.createdAt,
    }).from(pushSubscription).where(eq(pushSubscription.userId, ctx.session.user.id));
  }),
});
