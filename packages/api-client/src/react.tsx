'use client';
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import superjson from 'superjson';
import { useState, type ReactNode } from 'react';
import type { AppRouter } from '@sitelog/api';

export const trpc = createTRPCReact<AppRouter>();

interface ProviderProps {
  children: ReactNode;
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  getOrgId?: () => string | null | Promise<string | null>;
}

export function TrpcProvider({ children, baseUrl, getToken, getOrgId }: ProviderProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
  }));
  const [client] = useState(() => trpc.createClient({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        transformer: superjson,
        fetch: (url, opts) => fetch(url, { ...opts, credentials: 'include' }),
        headers: async () => {
          const h: Record<string, string> = {};
          if (getToken) { const t = await getToken(); if (t) h['Authorization'] = `Bearer ${t}`; }
          if (getOrgId) { const o = await getOrgId(); if (o) h['X-Org-Id'] = o; }
          return h;
        },
      }),
    ],
  }));
  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
