/**
 * Idempotency-Key middleware (Stripe-style).
 *
 * Customer sends `Idempotency-Key: <opaque-string>` on POST/PUT/PATCH.
 * Same key + same body within 24h → cached response returned (no re-execute).
 * Different body with same key → 409 conflict (key reuse with different request).
 *
 * Storage: idempotency_key table, org-scoped.
 */
import { db } from '@sitelog/db';
import { sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';

export interface CachedResponse {
  status: number;
  body: string;
}

function hashBody(method: string, path: string, body: string): string {
  return createHash('sha256').update(`${method}:${path}:${body}`).digest('hex');
}

export async function lookupIdempotency(
  orgId: string,
  key: string,
  method: string,
  path: string,
  body: string,
): Promise<{ cached?: CachedResponse; conflict?: boolean }> {
  const requestHash = hashBody(method, path, body);
  const rows: any = await db.execute(sql`
    SELECT response_status, response_body, request_hash
    FROM idempotency_key
    WHERE organization_id = ${orgId} AND key = ${key} AND created_at > NOW() - INTERVAL '24 hours'
    LIMIT 1
  `);
  const r = (rows.rows ?? rows)[0];
  if (!r) return {};
  if (r.request_hash !== requestHash) return { conflict: true };
  return { cached: { status: r.response_status, body: r.response_body } };
}

export async function storeIdempotency(
  orgId: string,
  key: string,
  method: string,
  path: string,
  body: string,
  responseStatus: number,
  responseBody: string,
): Promise<void> {
  const requestHash = hashBody(method, path, body);
  await db.execute(sql`
    INSERT INTO idempotency_key (organization_id, key, method, path, request_hash, response_status, response_body)
    VALUES (${orgId}, ${key}, ${method}, ${path}, ${requestHash}, ${responseStatus}, ${responseBody})
    ON CONFLICT (organization_id, key) DO NOTHING
  `);
}
