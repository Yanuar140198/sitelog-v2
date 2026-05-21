import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@sitelog/api';

export function createSitelogClient(opts: {
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  getOrgId?: () => string | null | Promise<string | null>;
}) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${opts.baseUrl}/api/trpc`,
        transformer: superjson,
        headers: async () => {
          const h: Record<string, string> = {};
          if (opts.getToken) {
            const t = await opts.getToken();
            if (t) h['Authorization'] = `Bearer ${t}`;
          }
          if (opts.getOrgId) {
            const o = await opts.getOrgId();
            if (o) h['X-Org-Id'] = o;
          }
          return h;
        },
      }),
    ],
  });
}

export type { AppRouter } from '@sitelog/api';
