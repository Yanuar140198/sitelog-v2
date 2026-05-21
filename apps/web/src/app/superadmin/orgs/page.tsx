'use client';
import { trpc } from '@sitelog/api-client/react';

export default function SuperAdminOrgs() {
  const orgs = trpc.admin.orgs.useQuery();
  if (orgs.error) return <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">{orgs.error.message}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">CUSTOMERS</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">All Organizations</h1>
      </div>

      <table className="w-full font-mono text-xs border-2 border-white/30 bg-black/50">
        <thead className="bg-[var(--color-brand)]">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">SLUG</th>
            <th className="text-left px-3 py-2 tracking-wider">NAME</th>
            <th className="text-left px-3 py-2 tracking-wider">PLAN</th>
            <th className="text-left px-3 py-2 tracking-wider">STATUS</th>
            <th className="text-right px-3 py-2 tracking-wider">MEMBERS</th>
            <th className="text-right px-3 py-2 tracking-wider">PROJECTS</th>
            <th className="text-left px-3 py-2 tracking-wider">CREATED</th>
          </tr>
        </thead>
        <tbody>
          {orgs.data?.map(o => (
            <tr key={o.id} className="border-b border-white/10 hover:bg-white/5">
              <td className="px-3 py-2 text-[var(--color-brand)] font-bold"><a href={`/superadmin/orgs/${o.slug}`} className="hover:underline">{o.slug}</a></td>
              <td className="px-3 py-2">{o.name}</td>
              <td className="px-3 py-2 uppercase">{o.plan}</td>
              <td className="px-3 py-2 uppercase text-[10px]">{o.subscriptionStatus ?? '—'}</td>
              <td className="px-3 py-2 text-right">{o.memberCount}</td>
              <td className="px-3 py-2 text-right">{o.projectCount}</td>
              <td className="px-3 py-2 text-neutral-400">{new Date(o.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
