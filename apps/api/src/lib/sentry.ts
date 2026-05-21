/**
 * Optional Sentry server-side init. Loaded only if SENTRY_DSN env is set.
 * Defeats webpack/bun static analysis via Function constructor so missing dep doesn't break build.
 */
let initialized = false;

export async function initSentry(): Promise<void> {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const dynImport = (m: string) => (new Function('m', 'return import(m)'))(m);
    const Sentry: any = await dynImport('@sentry/node').catch(() => null);
    if (!Sentry?.init) {
      console.warn('[sentry] @sentry/node not installed; skipping');
      return;
    }
    Sentry.init({
      dsn,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      environment: process.env.NODE_ENV ?? 'development',
      release: process.env.npm_package_version ?? '0.2.1',
    });
    initialized = true;
    console.log('[sentry] initialized for', process.env.NODE_ENV ?? 'development');
  } catch (e: any) {
    console.warn('[sentry] init failed:', e?.message);
  }
}

export async function captureException(err: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!initialized) return;
  try {
    const dynImport = (m: string) => (new Function('m', 'return import(m)'))(m);
    const Sentry: any = await dynImport('@sentry/node');
    if (context) Sentry.setContext('sitelog', context);
    Sentry.captureException(err);
  } catch {}
}
