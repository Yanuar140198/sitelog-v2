/**
 * Security headers — applied to every response.
 *
 * Defaults are conservative; CSP intentionally NOT set on API (browser doesn't fetch from us).
 * Web app should add its own CSP via Next config — these are API-side defaults.
 */
import type { MiddlewareHandler } from 'hono';

export function securityHeadersMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    // Always-on safe defaults
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // HSTS — only set when serving HTTPS (Vercel/CF terminate TLS, forward x-forwarded-proto)
    const proto = c.req.header('x-forwarded-proto');
    if (proto === 'https') {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  };
}
