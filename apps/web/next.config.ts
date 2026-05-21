import type { NextConfig } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  transpilePackages: ['@sitelog/api', '@sitelog/api-client', '@sitelog/auth', '@sitelog/db'],
  experimental: {
    typedRoutes: true,
    serverActions: { bodySizeLimit: '10mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.cloudflarestorage.com' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/trpc/:path*', destination: `${API_URL}/api/trpc/:path*` },
      { source: '/api/auth/:path*', destination: `${API_URL}/api/auth/:path*` },
      { source: '/api/webhooks/:path*', destination: `${API_URL}/api/webhooks/:path*` },
    ];
  },
  async headers() {
    // OWASP-recommended baseline. CSP intentionally permissive on 'unsafe-inline' for
    // Next.js inline scripts; tighten later via nonce strategy.
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options',         value: 'DENY' },
      { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy',      value: 'camera=(self), microphone=(), geolocation=(self)' },
      { key: 'X-DNS-Prefetch-Control',  value: 'on' },
      // Strict CSP — adjust connect-src for prod API origin
      { key: 'Content-Security-Policy', value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
          "style-src 'self' 'unsafe-inline' https://unpkg.com",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          `connect-src 'self' ${API_URL} https://*.sentry.io https://*.posthog.com https://api.anthropic.com`,
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ')
      },
    ];
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default config;
