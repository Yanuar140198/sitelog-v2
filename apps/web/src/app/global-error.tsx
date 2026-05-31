'use client';
import { useEffect } from 'react';

/**
 * Next.js global error boundary — catches errors thrown in the root layout.
 * Must render its own <html>/<body>. Reports to the error-log ingest.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      void fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message || 'Global render error',
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
    <html lang="id">
      <body style={{ fontFamily: 'monospace', padding: '2rem', background: '#111', color: '#fff' }}>
        <p style={{ color: '#f87171', fontSize: '0.75rem', letterSpacing: '0.2em' }}>ERROR 500</p>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>Something broke.</h1>
        <p style={{ fontSize: '0.875rem', color: '#a3a3a3', marginTop: '1rem' }}>
          The application failed to load. Try reloading the page.
        </p>
        {error.digest && (
          <p style={{ fontSize: '0.75rem', color: '#737373', marginTop: '0.75rem' }}>
            Reference: <code>{error.digest}</code>
          </p>
        )}
        <button
          onClick={() => (typeof location !== 'undefined' ? location.reload() : undefined)}
          style={{
            marginTop: '2rem',
            background: '#fff',
            color: '#111',
            border: 'none',
            padding: '0.75rem 1.5rem',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            cursor: 'pointer',
          }}
        >
          RELOAD
        </button>
      </body>
    </html>
  );
}
