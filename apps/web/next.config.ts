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
};

export default config;
