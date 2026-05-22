import { z } from 'zod';
import { and, desc, eq, isNull, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, orgProcedure, requireRole } from '../trpc.js';
import { notification, userPreference, notificationChannel } from '@sitelog/db';
import { dispatchToChannels } from '../lib/notification-dispatch.js';

const CHANNEL_TYPES = ['slack', 'discord', 'email'] as const;
const CHANNEL_EVENTS = ['entry.submit', 'entry.approved', 'webhook.failed', 'project.created'] as const;

const channelCreateInput = z.object({
  type: z.enum(CHANNEL_TYPES),
  name: z.string().min(1).max(120),
  webhookUrl: z.string().url().optional(),
  emailAddress: z.string().email().optional(),
  events: z.array(z.enum(CHANNEL_EVENTS)).min(1),
});

const channelUpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  emailAddress: z.string().email().nullable().optional(),
  events: z.array(z.enum(CHANNEL_EVENTS)).min(1).optional(),
  enabled: z.boolean().optional(),
});

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

  // -----------------------------------------------------------------------
  // Outbound integration channels (Slack / Discord / Email per-org).
  // -----------------------------------------------------------------------
  channels: router({
    list: orgProcedure.query(async ({ ctx }) => {
      return ctx.db.select().from(notificationChannel)
        .where(eq(notificationChannel.organizationId, ctx.session.organizationId))
        .orderBy(desc(notificationChannel.createdAt));
    }),

    create: requireRole('owner', 'admin')
      .input(channelCreateInput)
      .mutation(async ({ ctx, input }) => {
        if ((input.type === 'slack' || input.type === 'discord') && !input.webhookUrl) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `${input.type} channel requires webhookUrl` });
        }
        if (input.type === 'email' && !input.emailAddress) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'email channel requires emailAddress' });
        }
        const [row] = await ctx.db.insert(notificationChannel).values({
          organizationId: ctx.session.organizationId,
          channelType: input.type,
          name: input.name,
          webhookUrl: input.webhookUrl ?? null,
          emailAddress: input.emailAddress ?? null,
          events: input.events as string[],
        }).returning();
        return row;
      }),

    update: requireRole('owner', 'admin')
      .input(channelUpdateInput)
      .mutation(async ({ ctx, input }) => {
        const { id, ...rest } = input;
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (rest.name !== undefined) patch.name = rest.name;
        if (rest.webhookUrl !== undefined) patch.webhookUrl = rest.webhookUrl;
        if (rest.emailAddress !== undefined) patch.emailAddress = rest.emailAddress;
        if (rest.events !== undefined) patch.events = rest.events as string[];
        if (rest.enabled !== undefined) patch.enabled = rest.enabled;
        await ctx.db.update(notificationChannel).set(patch).where(and(
          eq(notificationChannel.id, id),
          eq(notificationChannel.organizationId, ctx.session.organizationId),
        ));
        return { ok: true };
      }),

    delete: requireRole('owner', 'admin')
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db.delete(notificationChannel).where(and(
          eq(notificationChannel.id, input.id),
          eq(notificationChannel.organizationId, ctx.session.organizationId),
        ));
        return { ok: true };
      }),

    test: requireRole('owner', 'admin')
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [ch] = await ctx.db.select().from(notificationChannel).where(and(
          eq(notificationChannel.id, input.id),
          eq(notificationChannel.organizationId, ctx.session.organizationId),
        )).limit(1);
        if (!ch) throw new TRPCError({ code: 'NOT_FOUND', message: 'channel not found' });
        // Bypass the events whitelist for test pings by temporarily issuing
        // a direct dispatch via a synthetic per-channel event the row opts in to.
        // We just re-use the configured first event so the message format is realistic.
        const evt = (ch.events?.[0] as string) ?? 'test.ping';
        // Insert ad-hoc: temporarily add 'test.ping' to events for this single call by
        // dispatching via formatMessage path — easier route is to call dispatch with
        // the channel's existing event so the whitelist matches.
        const res = await dispatchToChannels(ctx.session.organizationId, evt, {
          test: true, channelName: ch.name, triggeredBy: ctx.session.user.id,
        });
        return { ok: true, ...res };
      }),
  }),
});
