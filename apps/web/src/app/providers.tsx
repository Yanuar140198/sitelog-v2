'use client';
import { TrpcProvider, trpc } from '@sitelog/api-client/react';
import { useEffect, type ReactNode } from 'react';
import { initObservability } from '@/lib/observability';
import { I18nProvider } from '@/lib/i18n';

function BrandTokens() {
  const current = trpc.org.current.useQuery(undefined, { retry: false });
  useEffect(() => {
    if (!current.data) return;
    const root = document.documentElement;
    if (current.data.brandColor) root.style.setProperty('--color-brand', current.data.brandColor);
    if (current.data.brandSecondary) root.style.setProperty('--color-ink', current.data.brandSecondary);
  }, [current.data]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => { initObservability(); }, []);
  return (
    <I18nProvider>
      <TrpcProvider
        baseUrl={typeof window === 'undefined' ? '' : window.location.origin}
        getToken={() => (typeof window === 'undefined' ? null : localStorage.getItem('sl_token'))}
        getOrgId={() => (typeof window === 'undefined' ? null : localStorage.getItem('sl_org'))}
      >
        <BrandTokens />
        {children}
      </TrpcProvider>
    </I18nProvider>
  );
}
