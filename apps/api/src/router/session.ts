/**
 * Active session management for the authenticated user.
 * - list: all sessions across devices
 * - revoke: kill one session (logout that device)
 * - revokeOthers: kill all sessions except current (panic button)
 */
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db, session, user } from '@sitelog/db';
import { and, eq, ne, gte } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const sessionRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const rows = await db.select({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }).from(session)
      .where(and(eq(session.userId, ctx.session.user.id), gte(session.expiresAt, now)))
      .orderBy(session.createdAt);
    return rows.map(r => ({
      ...r,
      current: r.id === ctx.session.sessionId,
    }));
  }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session.sessionId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot revoke current session via this endpoint; sign out instead.' });
      }
      await db.delete(session).where(and(eq(session.userId, ctx.session.user.id), eq(session.id, input.id)));
      return { ok: true };
    }),

  revokeOthers: protectedProcedure.mutation(async ({ ctx }) => {
    const r = await db.delete(session)
      .where(and(eq(session.userId, ctx.session.user.id), ne(session.id, ctx.session.sessionId)))
      .returning();
    return { ok: true, revoked: r.length };
  }),

  twoFactorStatus: protectedProcedure.query(async ({ ctx }) => {
    const [u] = await db.select({ twoFactorEnabled: user.twoFactorEnabled })
      .from(user).where(eq(user.id, ctx.session.user.id)).limit(1);
    return { enabled: u?.twoFactorEnabled ?? false };
  }),
});
