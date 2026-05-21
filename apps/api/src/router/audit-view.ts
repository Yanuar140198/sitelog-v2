/**
 * Audit log read API — for /app/audit page.
 */
import { z } from 'zod';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { router, requireRole } from '../trpc.js';
import { auditLog, user } from '@sitelog/db';

const searchInput = z.object({
  action: z.string().optional(),
  resource: z.string().optional(),
  actorId: z.string().uuid().optional(),
  q: z.string().optional(),
  from: z.date().optional(),
  to: z.date().optional(),
  limit: z.number().min(1).max(500).default(100),
  offset: z.number().min(0).default(0),
});

function buildConds(ctx: any, input?: z.infer<typeof searchInput>) {
  const conds: any[] = [eq(auditLog.organizationId, ctx.session.organizationId)];
  if (input?.action) conds.push(eq(auditLog.action, input.action));
  if (input?.resource) conds.push(eq(auditLog.resource, input.resource));
  if (input?.actorId) conds.push(eq(auditLog.actorId, input.actorId));
  if (input?.from) conds.push(gte(auditLog.createdAt, input.from));
  if (input?.to) conds.push(lte(auditLog.createdAt, input.to));
  if (input?.q) conds.push(sql`(${auditLog.action} ILIKE ${'%' + input.q + '%'} OR ${auditLog.resource} ILIKE ${'%' + input.q + '%'} OR ${auditLog.resourceId} ILIKE ${'%' + input.q + '%'})`);
  return conds;
}

export const auditRouter = router({
  list: requireRole('owner', 'admin')
    .input(searchInput.optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ log: auditLog, actorEmail: user.email, actorName: user.name })
        .from(auditLog)
        .leftJoin(user, eq(auditLog.actorId, user.id))
        .where(and(...buildConds(ctx, input)))
        .orderBy(desc(auditLog.createdAt))
        .limit(input?.limit ?? 100)
        .offset(input?.offset ?? 0);
      return rows;
    }),

  exportCsv: requireRole('owner', 'admin')
    .input(searchInput.optional())
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ log: auditLog, actorEmail: user.email, actorName: user.name })
        .from(auditLog)
        .leftJoin(user, eq(auditLog.actorId, user.id))
        .where(and(...buildConds(ctx, input)))
        .orderBy(desc(auditLog.createdAt))
        .limit(5000);
      const header = 'timestamp,actor_email,actor_name,action,resource,resource_id,ip,user_agent\n';
      const csv = rows.map(r => {
        const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;
        return [
          new Date(r.log.createdAt).toISOString(),
          esc(r.actorEmail), esc(r.actorName),
          esc(r.log.action), esc(r.log.resource), esc(r.log.resourceId),
          esc(r.log.ipAddress), esc(r.log.userAgent),
        ].join(',');
      }).join('\n');
      return {
        filename: `audit-${new Date().toISOString().slice(0,10)}.csv`,
        contentType: 'text/csv',
        base64: Buffer.from(header + csv).toString('base64'),
        rowCount: rows.length,
      };
    }),
});
