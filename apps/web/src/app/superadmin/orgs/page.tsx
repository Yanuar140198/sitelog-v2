'use client';
import { trpc } from '@sitelog/api-client/react';

const PLANS = ['trial', 'starter', 'pro', 'enterprise'] as const;
type Plan = (typeof PLANS)[number];

function PlanSelect({ slug, plan }: { slug: string; plan: Plan }) {
  const utils = trpc.useUtils();
  const setPlan = trpc.admin.setPlan.useMutation({
    onSuccess: () => utils.admin.orgs.invalidate(),
  });
  return (
    <div className="flex items-center gap-2">
      <select
        value={plan}
        disabled={setPlan.isPending}
        onChange={e => setPlan.mutate({ slug, plan: e.target.value as Plan })}
        className="bg-black/60 border border-white/30 text-white font-mono text-xs uppercase px-2 py-1 disabled:opacity-50 focus:outline-none focus:border-[var(--color-brand)]"
      >
        {PLANS.map(p => (
          <option key={p} value={p} className="bg-black">{p}</option>
        ))}
      </select>
      {setPlan.error && (
        <span className="text-red-400 text-[10px]" title={setPlan.error.message}>FAILED</span>
      )}
    </div>
  );
}

export default function SuperAdminOrgs() {
  const orgs = trpc.admin.orgs.useQuery();
  if (orgs.error) return <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">{orgs.error.message}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">CUSTOMERS</p>
        <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">All Organizations</h1>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs border-2 border-white/30 bg-black/50 min-w-[720px]">
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
              <td className="px-3 py-2"><PlanSelect slug={o.slug} plan={o.plan as Plan} /></td>
              <td className="px-3 py-2 uppercase text-[10px]">{o.subscriptionStatus ?? '—'}</td>
              <td className="px-3 py-2 text-right">{o.memberCount}</td>
              <td className="px-3 py-2 text-right">{o.projectCount}</td>
              <td className="px-3 py-2 text-neutral-400">{new Date(o.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
