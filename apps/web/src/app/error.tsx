'use client';
import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Forward to Sentry if loaded
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error);
    }
    console.error('[error.tsx]', error);
    // Report render errors to the error-log ingest (fire-and-forget, never throws)
    try {
      void fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message || 'Render error',
          stack: error.stack,
          url: typeof location !== 'undefined' ? location.href : undefined,
          level: 'error',
          context: error.digest ? { digest: error.digest } : undefined,
        }),
      }).catch(() => {});
    } catch {
      /* never throw */
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <p className="font-mono text-xs tracking-[0.2em] text-red-600">ERROR 500</p>
        <h1 className="font-display text-5xl font-bold tracking-tight mt-3">Something broke.</h1>
        <p className="font-mono text-sm text-neutral-700 mt-4 leading-relaxed">
          Permintaan gagal diproses. Tim sudah dapat notifikasi otomatis.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-neutral-500">Reference: <code>{error.digest}</code></p>
        )}
        <div className="mt-8 flex gap-3">
          <button
            onClick={reset}
            className="bg-[var(--color-brand)] text-white px-6 py-3 font-mono text-xs tracking-wider hover:bg-[var(--color-ink)]"
          >
            TRY AGAIN
          </button>
          <Link
            href="/"
            className="border-2 border-[var(--color-ink)] px-6 py-3 font-mono text-xs tracking-wider hover:bg-[var(--color-ink)] hover:text-white"
          >
            ← HOME
          </Link>
        </div>
      </div>
    </div>
  );
}
