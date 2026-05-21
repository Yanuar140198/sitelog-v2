import Link from 'next/link';
import { Check } from 'lucide-react';

const PLANS = [
  {
    key: 'starter', name: 'Starter', price: 29, popular: false,
    desc: 'For small contractors getting started.',
    features: ['Up to 5 team seats', '10 active projects', '10 GB photo storage', '500 AI calls/mo', 'Email support', 'XLSX + PDF export'],
  },
  {
    key: 'pro', name: 'Pro', price: 99, popular: true,
    desc: 'For growing construction companies.',
    features: ['Up to 25 team seats', '100 active projects', '100 GB photo storage', '5000 AI calls/mo', 'Priority support', 'Excel + PDF export', 'Custom AHSP catalog', 'Audit trail'],
  },
  {
    key: 'enterprise', name: 'Enterprise', price: null, popular: false,
    desc: 'Custom solutions for large operations.',
    features: ['Unlimited seats', 'Unlimited projects', 'Unlimited storage', 'Dedicated support', 'SLA + uptime guarantee', 'SSO + advanced RBAC', 'IntelliTrac GPS sync', 'On-premise option'],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <nav className="border-b-2 border-[var(--color-ink)] bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-mono text-sm tracking-[0.2em] font-bold text-[var(--color-brand)]">◣ SITELOG</Link>
          <div className="flex gap-6 font-mono text-xs tracking-wider">
            <Link href="/login" className="hover:text-[var(--color-brand)]">SIGN IN</Link>
            <Link href="/signup" className="bg-[var(--color-ink)] text-white px-4 py-2 hover:bg-[var(--color-brand)]">START FREE</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center">
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">PRICING</p>
          <h1 className="font-display text-5xl font-bold tracking-tight mt-4">Simple. Transparent. Pay as you grow.</h1>
          <p className="text-lg text-neutral-600 mt-4">14 days free trial. No credit card required.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {PLANS.map(p => (
            <div key={p.key} className={`border-2 border-[var(--color-ink)] bg-white p-8 ${p.popular ? 'shadow-[8px_8px_0_var(--color-brand)] md:-translate-y-4' : ''}`}>
              {p.popular && (
                <div className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)] mb-2">★ MOST POPULAR</div>
              )}
              <div className="font-mono text-xs tracking-wider text-neutral-500">{p.key.toUpperCase()}</div>
              <div className="font-display text-3xl font-bold mt-2">{p.name}</div>
              <p className="text-neutral-600 text-sm mt-2">{p.desc}</p>
              <div className="mt-6 font-display text-5xl font-bold">
                {p.price === null ? 'Custom' : `$${p.price}`}
                {p.price !== null && <span className="text-base font-mono text-neutral-500">/mo</span>}
              </div>
              <ul className="mt-6 space-y-2.5 font-mono text-xs text-neutral-700">
                {p.features.map(f => (
                  <li key={f} className="flex gap-2"><Check size={14} className="text-[var(--color-brand)] flex-shrink-0 mt-0.5" /> {f}</li>
                ))}
              </ul>
              <Link href={p.price === null ? 'mailto:sales@sitelog.app' : '/signup'}
                className={`block text-center mt-8 px-6 py-3 font-mono text-sm tracking-wider ${p.popular ? 'bg-[var(--color-brand)] text-white hover:bg-[var(--color-ink)]' : 'border-2 border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white'}`}>
                {p.price === null ? 'CONTACT SALES' : 'START FREE TRIAL'} →
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-24 border-2 border-[var(--color-ink)] bg-white p-8">
          <h2 className="font-display text-2xl font-bold">FAQ</h2>
          <div className="mt-6 space-y-6">
            {[
              { q: 'How does the free trial work?', a: '14 days full access to Pro features. No credit card required to start. Upgrade or downgrade anytime.' },
              { q: 'Can I migrate from existing systems?', a: 'Yes. Migration tooling available for Excel BOQ files and Google Sheets. Contact sales for assisted migration.' },
              { q: 'Is my data secure?', a: 'Yes. PostgreSQL with row-level security per org. Cloudflare R2 storage. 2FA TOTP. Audit logs. SSL everywhere.' },
              { q: 'Can I cancel anytime?', a: 'Yes. Stripe customer portal lets you cancel, change plan, or update payment anytime. Pro-rated refunds.' },
            ].map(f => (
              <div key={f.q}>
                <div className="font-bold">{f.q}</div>
                <div className="text-neutral-600 mt-1 text-sm">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
