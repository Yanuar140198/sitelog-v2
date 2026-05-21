/**
 * Member invite + management — role-scoped.
 */
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { router, requireRole, protectedProcedure } from '../trpc.js';
import { invitation, membership, organization } from '@sitelog/db';
import { TRPCError } from '@trpc/server';
import { randomBytes } from 'node:crypto';
import { sendEmail } from '../lib/email.js';
import { renderInvite } from '@sitelog/emails';
import { audit } from '../lib/audit.js';

const roleSchema = z.enum(['owner', 'admin', 'estimator', 'scheduler', 'supervisor', 'viewer']);

export const inviteRouter = router({
  list: requireRole('owner', 'admin').query(async ({ ctx }) => {
    return ctx.db.select().from(invitation)
      .where(eq(invitation.organizationId, ctx.session.organizationId));
  }),

  create: requireRole('owner', 'admin')
    .input(z.object({ email: z.string().email(), role: roleSchema }))
    .mutation(async ({ ctx, input }) => {
      const token = randomBytes(32).toString('hex');
      const [row] = await ctx.db.insert(invitation).values({
        organizationId: ctx.session.organizationId,
        email: input.email.toLowerCase(),
        role: input.role,
        token,
        invitedById: ctx.session.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).returning();

      const [org] = await ctx.db.select().from(organization)
        .where(eq(organization.id, ctx.session.organizationId)).limit(1);
      const acceptUrl = `${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/invite/${token}`;
      await audit(ctx, { action: 'invite.create', resource: 'invitation', resourceId: row?.id, after: { email: input.email, role: input.role } });
      (async () => {
        const html = await renderInvite({
          orgName: org?.name ?? 'Sitelog',
          inviterName: ctx.session.user.name ?? ctx.session.user.email,
          acceptUrl,
        });
        await sendEmail({
          to: input.email,
          subject: `Join ${org?.name ?? 'Sitelog'} on Sitelog`,
          html,
          text: `${ctx.session.user.name ?? ctx.session.user.email} invited you to join ${org?.name} on Sitelog. Accept: ${acceptUrl}`,
        });
      })().catch(e => console.error('[invite] email failed', e));

      return row;
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [inv] = await ctx.db.select().from(invitation)
        .where(eq(invitation.token, input.token)).limit(1);
      if (!inv) throw new TRPCError({ code: 'NOT_FOUND' });
      if (inv.acceptedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already accepted' });
      if (inv.expiresAt < new Date()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Expired' });
      if (inv.email.toLowerCase() !== ctx.session.user.email.toLowerCase()) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Invite for different email' });
      }
      await ctx.db.insert(membership).values({
        userId: ctx.session.user.id,
        organizationId: inv.organizationId,
        role: inv.role,
        acceptedAt: new Date(),
      });
      await ctx.db.update(invitation).set({ acceptedAt: new Date() })
        .where(eq(invitation.id, inv.id));
      return { ok: true, organizationId: inv.organizationId };
    }),

  revoke: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(invitation)
        .where(and(eq(invitation.id, input.id), eq(invitation.organizationId, ctx.session.organizationId)));
      return { ok: true };
    }),

  updateMemberRole: requireRole('owner')
    .input(z.object({ membershipId: z.string().uuid(), role: roleSchema }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.update(membership).set({ role: input.role })
        .where(and(eq(membership.id, input.membershipId), eq(membership.organizationId, ctx.session.organizationId)))
        .returning();
      return row;
    }),

  removeMember: requireRole('owner', 'admin')
    .input(z.object({ membershipId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(membership)
        .where(and(eq(membership.id, input.membershipId), eq(membership.organizationId, ctx.session.organizationId)));
      return { ok: true };
    }),
});
