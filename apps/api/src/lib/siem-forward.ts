/**
 * Audit SIEM forwarding — push recent audit entries to external HTTP endpoint.
 *
 * Format: NDJSON (one event per line). Compatible with Splunk HEC, Datadog Logs HTTP.
 * Track last-forwarded timestamp via simple in-memory cursor (reset on restart).
 * Production: persist cursor in DB.
 */
import { db, auditLog, user } from '@sitelog/db';
import { and, asc, eq, gt } from 'drizzle-orm';

let lastForwardedAt: Date = new Date(0);

export async function forwardAuditToSiem(): Promise<{ forwarded: number; cursor: string }> {
  const endpoint = process.env.SIEM_HTTP_URL;
  const token = process.env.SIEM_HTTP_TOKEN;
  if (!endpoint) return { forwarded: 0, cursor: lastForwardedAt.toISOString() };

  const rows = await db.select({
    log: auditLog, actorEmail: user.email,
  })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorId, user.id))
    .where(gt(auditLog.createdAt, lastForwardedAt))
    .orderBy(asc(auditLog.createdAt))
    .limit(1000);

  if (rows.length === 0) return { forwarded: 0, cursor: lastForwardedAt.toISOString() };

  const ndjson = rows.map(r => JSON.stringify({
    ts: new Date(r.log.createdAt).toISOString(),
    source: 'sitelog',
    org_id: r.log.organizationId,
    actor: r.actorEmail,
    action: r.log.action,
    resource: r.log.resource,
    resource_id: r.log.resourceId,
    ip: r.log.ipAddress,
    user_agent: r.log.userAgent,
  })).join('\n');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-ndjson',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: ndjson,
  });
  if (!res.ok) throw new Error(`SIEM forward failed: ${res.status}`);
  const last = rows[rows.length - 1]!.log.createdAt;
  lastForwardedAt = new Date(last);
  return { forwarded: rows.length, cursor: lastForwardedAt.toISOString() };
}
