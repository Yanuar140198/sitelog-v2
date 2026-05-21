/**
 * Audit logging helper — write to auditLog table after mutations.
 *
 * Pattern: in mutation resolver, after success, call:
 *   await audit(ctx, { action: 'project.create', resource: 'project', resourceId: row.id, after: row });
 *
 * For automatic interception, wrap procedures with `withAudit(action, resource)` middleware below.
 */
import { db, auditLog } from '@sitelog/db';
import type { Context } from '../context.js';

export interface AuditOpts {
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
}

export async function audit(ctx: Context, opts: AuditOpts) {
  if (!ctx.session) return;
  const ip = ctx.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? ctx.headers.get('x-real-ip') ?? null;
  try {
    await db.insert(auditLog).values({
      organizationId: ctx.session.organizationId,
      actorId: ctx.session.user.id,
      action: opts.action,
      resource: opts.resource,
      resourceId: opts.resourceId ?? null,
      diff: opts.before || opts.after ? JSON.stringify({ before: opts.before ?? null, after: opts.after ?? null }) : null,
      ipAddress: ip,
      userAgent: ctx.headers.get('user-agent'),
    });
  } catch (e) {
    console.error('[audit] failed', opts.action, e);
  }
}
