'use client';
import { useEffect } from 'react';

/** Fire-and-forget error report to the same-origin REST ingest. Never throws. */
function report(body: { message: string; stack?: string; url?: string; level?: string }) {
  try {
    void fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    /* never throw */
  }
}

/**
 * Global client-side error capture. Mounted once in the root layout.
 * Registers window error + unhandledrejection listeners and forwards them to
 * the REST ingest, deduping identical messages within a short window.
 */
export function ErrorReporter() {
  useEffect(() => {
    const recent = new Map<string, number>();
    const DEDUPE_MS = 5000;

    const shouldSend = (key: string) => {
      const now = Date.now();
      const last = recent.get(key);
      // prune occasionally to avoid unbounded growth
      if (recent.size > 100) {
        for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
      }
      if (last && now - last < DEDUPE_MS) return false;
      recent.set(key, now);
      return true;
    };

    const onError = (e: ErrorEvent) => {
      const message = e.message || (e.error && String(e.error)) || 'Unknown error';
      const stack = e.error instanceof Error ? e.error.stack : undefined;
      if (!shouldSend(message)) return;
      report({ message, stack, url: location.href, level: 'error' });
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const message =
        reason instanceof Error ? reason.message : reason != null ? String(reason) : 'Unhandled rejection';
      const stack = reason instanceof Error ? reason.stack : undefined;
      if (!shouldSend(message)) return;
      report({ message, stack, url: location.href, level: 'error' });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
