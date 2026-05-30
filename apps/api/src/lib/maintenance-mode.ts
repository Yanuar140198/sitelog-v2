/**
 * Maintenance mode — 503-everything-except-status flag.
 *
 * Enabled via MAINTENANCE_MODE=1 env var.
 * Exception list: /healthz, /status, /metrics (so monitoring still sees us).
 * Super-admins can still call any endpoint (override via X-Maintenance-Bypass header + ADMIN secret).
 */
import type { MiddlewareHandler } from 'hono';
import { safeEqual } from './safe-compare.js';

const EXEMPT_PATHS = new Set(['/healthz', '/status', '/metrics']);

export function maintenanceModeMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    if (process.env.MAINTENANCE_MODE !== '1') return next();
    const path = c.req.path;
    if (EXEMPT_PATHS.has(path)) return next();

    // Admin bypass — must know shared secret
    const bypass = c.req.header('x-maintenance-bypass');
    if (bypass && process.env.MAINTENANCE_BYPASS_SECRET && safeEqual(bypass, process.env.MAINTENANCE_BYPASS_SECRET)) {
      return next();
    }

    return c.json({
      error: {
        code: 'MAINTENANCE_MODE',
        message: process.env.MAINTENANCE_MESSAGE ?? 'Service temporarily unavailable for maintenance. Try again shortly.',
        retryAfter: 300,
      },
    }, 503, {
      'retry-after': '300',
      'x-maintenance-mode': '1',
    });
  };
}
