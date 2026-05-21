import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { webhookEndpoint, webhookDelivery } from '@sitelog/db';
import { TRPCError } from '@trpc/server';
import { generateWebhookSecret } from '../lib/webhooks.js';

const EVENTS = ['*', 'project.created', 'project.updated', 'boq.changed', 'entry.submitted', 'fleet.assigned', 'invite.created'] as const;

export const webhooksRouter = router({
  list: requireRole('owner', 'admin').query(async ({ ctx }) => {
    return ctx.db.select().from(webhookEndpoint)
      .where(eq(webhookEndpoint.organizationId, ctx.session.organizationId))
      .orderBy(desc(webhookEndpoint.createdAt));
  }),

  create: requireRole('owner', 'admin')
    .input(z.object({
      url: z.string().url(),
      events: z.array(z.enum(EVENTS)).min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const secret = generateWebhookSecret();
      const [row] = await ctx.db.insert(webhookEndpoint).values({
        organizationId: ctx.session.organizationId,
        url: input.url,
        events: input.events.join(','),
        secret,
        description: input.description,
        createdById: ctx.session.user.id,
      }).returning();
      return { ...row, secret };  // only returned at create time
    }),

  toggle: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(webhookEndpoint).set({ active: input.active })
        .where(and(eq(webhookEndpoint.id, input.id), eq(webhookEndpoint.organizationId, ctx.session.organizationId)));
      return { ok: true };
    }),

  delete: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(webhookEndpoint)
        .where(and(eq(webhookEndpoint.id, input.id), eq(webhookEndpoint.organizationId, ctx.session.organizationId)));
      return { ok: true };
    }),

  deliveries: requireRole('owner', 'admin')
    .input(z.object({ endpointId: z.string().uuid(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(webhookDelivery)
        .where(eq(webhookDelivery.endpointId, input.endpointId))
        .orderBy(desc(webhookDelivery.createdAt))
        .limit(input.limit);
    }),
});
