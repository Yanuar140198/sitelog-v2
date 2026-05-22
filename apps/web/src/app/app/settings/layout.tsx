import Link from 'next/link';

const TABS = [
  { href: '/app/settings', label: 'GENERAL' },
  { href: '/app/settings/members', label: 'MEMBERS' },
  { href: '/app/settings/billing', label: 'BILLING' },
  { href: '/app/settings/notifications', label: 'NOTIFICATIONS' },
  { href: '/app/settings/api-keys', label: 'API KEYS' },
  { href: '/app/settings/resources', label: 'RESOURCES' },
  { href: '/app/settings/webhooks', label: 'WEBHOOKS' },
  { href: '/app/settings/domain', label: 'DOMAIN' },
  { href: '/app/settings/privacy', label: 'PRIVACY' },
  { href: '/app/settings/security', label: 'SECURITY' },
  { href: '/app/settings/usage', label: 'USAGE' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">CONFIG</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Settings</h1>
      </div>
      <div className="flex border-b-2 border-[var(--color-ink)]">
        {TABS.map(t => (
          <Link key={t.href} href={t.href as any}
            className="px-4 py-2 font-mono text-xs tracking-wider border-b-4 border-transparent hover:border-[var(--color-brand)]">
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
