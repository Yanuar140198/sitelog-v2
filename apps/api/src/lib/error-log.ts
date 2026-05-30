/**
 * Best-effort error recorder — persists runtime errors (server + client) to the
 * error_log table. Swallows its own failures so logging never breaks a request.
 */
import { db, errorLog } from '@sitelog/db';

export interface ErrorRecord {
  source: 'client' | 'trpc' | 'rest' | 'server';
  level?: string;
  message: string;
  stack?: string | null;
  path?: string | null;
  method?: string | null;
  status?: number | null;
  url?: string | null;
  userAgent?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  requestId?: string | null;
  context?: unknown;
}

const cap = (s: unknown, n: number): string | null =>
  s == null ? null : String(s).slice(0, n);
const isUuid = (s: unknown): boolean =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function recordError(r: ErrorRecord): Promise<void> {
  try {
    await db.insert(errorLog).values({
      source: r.source,
      level: cap(r.level, 16) ?? 'error',
      message: cap(r.message, 4000) ?? '(no message)',
      stack: cap(r.stack, 12000),
      path: cap(r.path, 512),
      method: cap(r.method, 8),
      status: typeof r.status === 'number' ? r.status : null,
      url: cap(r.url, 1024),
      userAgent: cap(r.userAgent, 512),
      organizationId: isUuid(r.organizationId) ? (r.organizationId as string) : null,
      userId: isUuid(r.userId) ? (r.userId as string) : null,
      requestId: cap(r.requestId, 64),
      context: r.context == null ? null : cap(JSON.stringify(r.context), 8000),
    });
  } catch {
    // never let logging break the caller
  }
}
