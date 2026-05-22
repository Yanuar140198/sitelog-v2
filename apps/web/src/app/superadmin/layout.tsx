import Link from 'next/link';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <header className="bg-[var(--color-brand)] px-6 py-3 flex justify-between items-center">
        <div className="font-mono text-sm tracking-[0.2em] font-bold">◣ SITELOG SUPER-ADMIN</div>
        <div className="flex gap-6 font-mono text-xs tracking-wider">
          <Link href="/superadmin" className="hover:underline">DASHBOARD</Link>
          <Link href="/superadmin/orgs" className="hover:underline">ORGANIZATIONS</Link>
          <Link href="/superadmin/users" className="hover:underline">USERS</Link>
          <Link href="/superadmin/announcements" className="hover:underline">ANNOUNCEMENTS</Link>
          <Link href="/superadmin/webhooks" className="hover:underline">WEBHOOKS</Link>
          <Link href="/superadmin/audit" className="hover:underline">AUDIT</Link>
          <Link href="/superadmin/security" className="hover:underline">SECURITY</Link>
          <Link href="/superadmin/api-keys" className="hover:underline">API KEYS</Link>
          <Link href="/superadmin/flags" className="hover:underline">FLAGS</Link>
          <Link href="/app" className="hover:underline">↩ APP</Link>
        </div>
      </header>
      <main className="p-8 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
