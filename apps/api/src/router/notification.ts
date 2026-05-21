import { z } from 'zod';
import { and, desc, eq, isNull, count } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { notification, userPreference } from '@sitelog/db';

export const notificationRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20), unreadOnly: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [eq(notification.userId, ctx.session.user.id)];
      if (input?.unreadOnly) conds.push(isNull(notification.readAt));
      return ctx.db.select().from(notification)
        .where(and(...conds))
        .orderBy(desc(notification.createdAt))
        .limit(input?.limit ?? 20);
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db.select({ c: count() }).from(notification)
      .where(and(eq(notification.userId, ctx.session.user.id), isNull(notification.readAt)));
    return { count: Number(row?.c ?? 0) };
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(notification).set({ readAt: new Date() })
        .where(and(eq(notification.id, input.id), eq(notification.userId, ctx.session.user.id)));
      return { ok: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.update(notification).set({ readAt: new Date() })
      .where(and(eq(notification.userId, ctx.session.user.id), isNull(notification.readAt)));
    return { ok: true };
  }),

  preferences: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db.select().from(userPreference)
      .where(eq(userPreference.userId, ctx.session.user.id)).limit(1);
    return row ?? {
      userId: ctx.session.user.id,
      emailDigestWeekly: true, emailMentions: true, emailBilling: true,
      onboardingCompletedAt: null, onboardingSteps: null, updatedAt: new Date(),
    };
  }),

  updatePreferences: protectedProcedure
    .input(z.object({
      emailDigestWeekly: z.boolean().optional(),
      emailMentions: z.boolean().optional(),
      emailBilling: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.select().from(userPreference)
        .where(eq(userPreference.userId, ctx.session.user.id)).limit(1);
      if (row) {
        await ctx.db.update(userPreference).set({ ...input, updatedAt: new Date() })
          .where(eq(userPreference.userId, ctx.session.user.id));
      } else {
        await ctx.db.insert(userPreference).values({ userId: ctx.session.user.id, ...input });
      }
      return { ok: true };
    }),
});
