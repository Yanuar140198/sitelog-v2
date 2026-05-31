import type { NextConfig } from 'next';

// Public API origin — baked into the client bundle (browser auth client, CSP).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
// Server-side rewrite target — reach the API directly (internal hostname) instead of
// hair-pinning back out through the public URL. Falls back to the public URL.
const API_INTERNAL = process.env.API_INTERNAL_URL ?? API_URL;

const config: NextConfig = {
  transpilePackages: ['@sitelog/api', '@sitelog/api-client', '@sitelog/auth', '@sitelog/db', '@sitelog/shared'],
  // Workspace packages use `.js`-extension imports in TS source (ESM bundler style);
  // let webpack resolve those to the .ts/.tsx files.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
  typedRoutes: true,
  experimental: {
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
      { source: '/api/trpc/:path*', destination: `${API_INTERNAL}/api/trpc/:path*` },
      { source: '/api/auth/:path*', destination: `${API_INTERNAL}/api/auth/:path*` },
      { source: '/api/webhooks/:path*', destination: `${API_INTERNAL}/api/webhooks/:path*` },
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
          `connect-src 'self' ${API_URL} https://*.sentry.io https://*.posthog.com`,
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
