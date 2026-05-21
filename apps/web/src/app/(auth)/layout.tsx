import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="bg-[var(--color-ink)] text-white p-12 flex flex-col justify-between hidden lg:flex">
        <Link href="/" className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">
          ◣ SITELOG
        </Link>
        <div className="space-y-6">
          <h2 className="font-display text-4xl font-bold leading-tight">
            BOQ. Schedule.<br />Track. Done.
          </h2>
          <div className="space-y-3 text-sm text-neutral-300">
            <div className="flex gap-3"><span className="text-[var(--color-brand)]">▸</span> AHSP-based unit rate engine</div>
            <div className="flex gap-3"><span className="text-[var(--color-brand)]">▸</span> Multi-project portfolio view</div>
            <div className="flex gap-3"><span className="text-[var(--color-brand)]">▸</span> Field mobile app integration</div>
            <div className="flex gap-3"><span className="text-[var(--color-brand)]">▸</span> Live SPI/CPI dashboards</div>
          </div>
        </div>
        <div className="font-mono text-[10px] text-neutral-500 tracking-wider">
          v2 · 2026
        </div>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
