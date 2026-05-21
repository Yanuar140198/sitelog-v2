import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      <nav className="border-b-2 border-[var(--color-ink)] bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-mono text-sm tracking-[0.2em] font-bold text-[var(--color-brand)]">◣ SITELOG</Link>
          <div className="flex items-center gap-6 font-mono text-xs tracking-wider">
            <Link href="/pricing" className="hover:text-[var(--color-brand)]">PRICING</Link>
            <Link href="/login" className="hover:text-[var(--color-brand)]">SIGN IN</Link>
            <Link href="/signup" className="bg-[var(--color-ink)] text-white px-4 py-2 hover:bg-[var(--color-brand)]">START FREE</Link>
          </div>
        </div>
      </nav>

      <main className="px-6 py-24 max-w-5xl mx-auto">
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">CONSTRUCTION SAAS · v2 · 2026</p>
        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mt-4 max-w-3xl">
          Build BOQ. Track production. <span className="text-[var(--color-brand)]">Hit your numbers.</span>
        </h1>
        <p className="text-lg text-neutral-600 mt-6 max-w-2xl leading-relaxed">
          End-to-end SaaS for civil construction: AHSP-based detailed BOQ engine, field daily reporting via mobile,
          live SPI/CPI dashboards across portfolio. Built for estimators, schedulers, and supervisors.
        </p>
        <div className="flex gap-3 mt-10">
          <Link href="/signup" className="bg-[var(--color-brand)] text-white px-8 py-4 font-mono text-sm tracking-wider hover:bg-[var(--color-ink)]">
            START 14-DAY FREE TRIAL →
          </Link>
          <Link href="/pricing" className="border-2 border-[var(--color-ink)] px-8 py-4 font-mono text-sm tracking-wider hover:bg-[var(--color-ink)] hover:text-white">
            VIEW PRICING
          </Link>
        </div>

        <section className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { k: '01 · BOQ Engine', v: 'Detailed AHSP analysis with per-resource overrides (koefisien × HSD). Every number traceable. Markup + contingency + PPN built-in. Version history + XLSX/PDF export.' },
            { k: '02 · Mobile Field Reports', v: 'Supervisors submit daily production from site. Photos + GPS evidence. Equipment HM + fuel logging. Works offline, syncs when reconnected.' },
            { k: '03 · Live SPI / CPI', v: 'Earned value computed from actual quantities × BOQ rates. Schedule + cost performance index per project + portfolio rollup.' },
            { k: '04 · Fleet Planning', v: 'Master equipment registry. Assign units to projects with role (Primary/Backup). IntelliTrac GPS integration for HM/odometer auto-sync.' },
            { k: '05 · Multi-tenant', v: 'Per-org workspace. RBAC (Owner/Admin/Estimator/Scheduler/Supervisor/Viewer). Email invitations. SSO ready.' },
            { k: '06 · AI Assistant', v: 'Claude-powered estimator helper. Suggest BOQ scopes, explain AHSP rates, draft daily report summaries.' },
          ].map(f => (
            <div key={f.k} className="border-2 border-[var(--color-ink)] p-6 bg-white hover:shadow-[6px_6px_0_var(--color-brand)] transition">
              <div className="font-mono text-xs text-[var(--color-brand)] tracking-[0.15em] font-bold">{f.k}</div>
              <div className="text-neutral-700 mt-3 leading-relaxed text-sm">{f.v}</div>
            </div>
          ))}
        </section>

        <section className="mt-32 border-2 border-[var(--color-ink)] bg-[var(--color-ink)] text-white p-12 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight">Ready to ship better BOQs?</h2>
          <p className="text-neutral-300 mt-3">14 days free. No credit card. Cancel anytime.</p>
          <Link href="/signup" className="inline-block mt-8 bg-[var(--color-brand)] text-white px-8 py-4 font-mono text-sm tracking-wider hover:bg-white hover:text-[var(--color-ink)]">
            CREATE YOUR ACCOUNT →
          </Link>
        </section>
      </main>

      <footer className="border-t-2 border-[var(--color-ink)] mt-16 py-8 text-center font-mono text-xs text-neutral-500">
        SITELOG · v2.0 · 2026 · construction SaaS
      </footer>
    </div>
  );
}
