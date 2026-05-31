/**
 * Error-log viewer (super-admin) + a client report mutation.
 *   - report:  any signed-in client can log an error (also available unauthenticated
 *              via POST /api/errors in server.ts).
 *   - recent / stats / clear: super-admin only.
 */
import { z } from 'zod';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc.js';
import { errorLog } from '@sitelog/db';
import { recordError } from '../lib/error-log.js';

function assertSuperAdmin(email: string) {
  const allow = (process.env.SITELOG_ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!allow.includes(email.toLowerCase())) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a Sitelog super-admin' });
  }
}

export const errorLogRouter = router({
  /** Log a client-side error (authenticated path). */
  report: orgProcedure
    .input(z.object({
      message: z.string().min(1).max(4000),
      stack: z.string().max(12000).optional(),
      url: z.string().max(1024).optional(),
      path: z.string().max(512).optional(),
      level: z.string().max(16).optional(),
      context: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await recordError({
        source: 'client',
        level: input.level ?? 'error',
        message: input.message,
        stack: input.stack,
        url: input.url,
        path: input.path,
        organizationId: ctx.session.organizationId,
        userId: ctx.session.user.id,
        context: input.context,
      });
      return { ok: true };
    }),

  /** Recent errors (super-admin). */
  recent: orgProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).default(100),
      source: z.enum(['client', 'trpc', 'rest', 'server']).optional(),
      sinceHours: z.number().min(1).max(720).optional(),
    }))
    .query(async ({ ctx, input }) => {
      assertSuperAdmin(ctx.session.user.email);
      const conds = [];
      if (input.source) conds.push(eq(errorLog.source, input.source));
      if (input.sinceHours) conds.push(gte(errorLog.createdAt, new Date(Date.now() - input.sinceHours * 3600_000)));
      return ctx.db.select().from(errorLog)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(errorLog.createdAt))
        .limit(input.limit);
    }),

  /** Counts by source for the last 24h (super-admin). */
  stats: orgProcedure.query(async ({ ctx }) => {
    assertSuperAdmin(ctx.session.user.email);
    const rows = await ctx.db.select({
      source: errorLog.source,
      n: sql<number>`count(*)::int`,
    }).from(errorLog)
      .where(gte(errorLog.createdAt, new Date(Date.now() - 24 * 3600_000)))
      .groupBy(errorLog.source);
    const total = rows.reduce((s, r) => s + Number(r.n), 0);
    return { total, bySource: rows };
  }),

  /** Delete all error logs (super-admin). */
  clear: orgProcedure.mutation(async ({ ctx }) => {
    assertSuperAdmin(ctx.session.user.email);
    await ctx.db.delete(errorLog);
    return { ok: true };
  }),
});
