import Link from 'next/link';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <header className="bg-[var(--color-brand)] px-4 md:px-6 py-3 flex flex-col md:flex-row gap-2 md:gap-0 md:justify-between md:items-center">
        <div className="font-mono text-sm tracking-[0.2em] font-bold">◣ SITELOG SUPER-ADMIN</div>
        <div className="flex gap-6 font-mono text-xs tracking-wider overflow-x-auto whitespace-nowrap">
          <Link href="/superadmin" className="hover:underline shrink-0">DASHBOARD</Link>
          <Link href="/superadmin/orgs" className="hover:underline shrink-0">ORGANIZATIONS</Link>
          <Link href="/superadmin/users" className="hover:underline shrink-0">USERS</Link>
          <Link href="/superadmin/announcements" className="hover:underline shrink-0">ANNOUNCEMENTS</Link>
          <Link href="/superadmin/webhooks" className="hover:underline shrink-0">WEBHOOKS</Link>
          <Link href="/superadmin/audit" className="hover:underline shrink-0">AUDIT</Link>
          <Link href="/superadmin/errors" className="hover:underline shrink-0">ERRORS</Link>
          <Link href="/superadmin/security" className="hover:underline shrink-0">SECURITY</Link>
          <Link href="/superadmin/api-keys" className="hover:underline shrink-0">API KEYS</Link>
          <Link href="/superadmin/flags" className="hover:underline shrink-0">FLAGS</Link>
          <Link href="/superadmin/database" className="hover:underline shrink-0">DB</Link>
          <Link href="/app" className="hover:underline shrink-0">↩ APP</Link>
        </div>
      </header>
      <main className="p-4 md:p-8 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
