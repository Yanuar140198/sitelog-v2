/**
 * Observability — Sentry + PostHog optional wiring.
 * Uses Function-constructor dynamic import to defeat bundler static analysis,
 * so optional deps remain truly optional (no install required).
 */
'use client';

export function initObservability() {
  if (typeof window === 'undefined') return;

  const dynImport = (m: string) => (new Function('m', 'return import(m)'))(m);

  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (sentryDsn) {
    dynImport('@sentry/nextjs').then((Sentry: any) => {
      Sentry.init({ dsn: sentryDsn, tracesSampleRate: 0.1, replaysSessionSampleRate: 0.1 });
    }).catch(() => console.warn('[sentry] not installed'));
  }

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (posthogKey) {
    dynImport('posthog-js').then(({ default: posthog }: any) => {
      posthog.init(posthogKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        capture_pageview: true,
      });
    }).catch(() => console.warn('[posthog] not installed'));
  }
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  // @ts-ignore
  window.posthog?.capture(name, props);
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  // @ts-ignore
  window.posthog?.identify(userId, traits);
}
