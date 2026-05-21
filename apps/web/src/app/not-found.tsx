import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">ERROR 404</p>
        <h1 className="font-display text-5xl font-bold tracking-tight mt-3">Page not found.</h1>
        <p className="font-mono text-sm text-neutral-700 mt-4 leading-relaxed">
          Path tidak terdaftar di Sitelog. Mungkin URL salah, project sudah dihapus,
          atau link sudah expired.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/"
            className="bg-[var(--color-brand)] text-white px-6 py-3 font-mono text-xs tracking-wider hover:bg-[var(--color-ink)]"
          >
            ← HOME
          </Link>
          <Link
            href="/app"
            className="border-2 border-[var(--color-ink)] px-6 py-3 font-mono text-xs tracking-wider hover:bg-[var(--color-ink)] hover:text-white"
          >
            DASHBOARD
          </Link>
        </div>
      </div>
    </div>
  );
}
