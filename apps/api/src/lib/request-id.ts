/**
 * Request ID middleware — generates UUID per request, propagates via header.
 *
 * Honors X-Request-ID from upstream (Cloudflare, load balancer) if present.
 * Always emits X-Request-ID on response. Stored in c.var.requestId for handlers.
 */
import type { MiddlewareHandler } from 'hono';
import { randomUUID } from 'node:crypto';

export interface RequestIdVars { requestId: string }

export function requestIdMiddleware(): MiddlewareHandler<{ Variables: RequestIdVars }> {
  return async (c, next) => {
    const incoming = c.req.header('x-request-id');
    const requestId = incoming || randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-ID', requestId);
    await next();
  };
}
