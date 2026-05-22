'use client';
import { trpc } from '@sitelog/api-client/react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function OrgDetail() {
  const { slug } = useParams() as { slug: string };
  const data = trpc.admin.orgDetail.useQuery({ slug });
  const setPlan = trpc.admin.setPlan.useMutation({ onSuccess: () => data.refetch() });
  const [plan, setPlan_] = useState<'trial' | 'starter' | 'pro' | 'enterprise'>('pro');

  if (data.error) return <div className="bg-red-900 border-2 border-red-600 p-6 font-mono text-red-200">{data.error.message}</div>;
  if (!data.data) return <div className="font-mono text-xs text-white/60">Loading…</div>;

  const { org, subscription, members, projects } = data.data;
  return (
    <div className="space-y-6">
      <div>
        <Link href="/superadmin/orgs" className="font-mono text-xs text-[var(--color-brand)]">← ALL ORGS</Link>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)] mt-3">CUSTOMER</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">{org.name}</h1>
        <p className="font-mono text-xs text-white/60 mt-2">{org.slug} · plan: {org.plan} · created {new Date(org.createdAt).toLocaleDateString()}</p>
      </div>

      <section className="border-2 border-white/30 bg-black/50 p-4">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">BILLING</h2>
        <div className="grid grid-cols-3 gap-3 font-mono text-xs">
          <div><span className="text-white/50">Plan:</span> {org.plan}</div>
          <div><span className="text-white/50">Status:</span> {subscription?.status ?? '—'}</div>
          <div><span className="text-white/50">Seats:</span> {subscription?.seats ?? '—'}</div>
          <div><span className="text-white/50">Stripe sub:</span> {subscription?.stripeSubscriptionId ?? '—'}</div>
          <div><span className="text-white/50">Period end:</span> {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : '—'}</div>
          <div><span className="text-white/50">Trial ends:</span> {org.trialEndsAt ? new Date(org.trialEndsAt).toLocaleDateString() : '—'}</div>
        </div>
        <div className="mt-4 flex gap-2">
          <select value={plan} onChange={e => setPlan_(e.target.value as any)} className="bg-black border-2 border-white/30 px-3 py-1 font-mono text-xs">
            <option value="trial">trial</option>
            <option value="starter">starter</option>
            <option value="pro">pro</option>
            <option value="enterprise">enterprise</option>
          </select>
          <button onClick={() => setPlan.mutate({ slug, plan })} className="bg-[var(--color-brand)] text-white px-4 py-1 font-mono text-xs font-bold tracking-wider">FORCE PLAN</button>
        </div>
      </section>

      <section className="border-2 border-white/30 bg-black/50 p-4">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">MEMBERS ({members.length})</h2>
        <table className="w-full font-mono text-xs">
          <thead className="text-white/50"><tr><th className="text-left py-1">EMAIL</th><th className="text-left">NAME</th><th className="text-left">ROLE</th><th className="text-left">JOINED</th></tr></thead>
          <tbody>{members.map((m: any) => <tr key={m.userId} className="border-t border-white/10"><td className="py-1">{m.email}</td><td>{m.name}</td><td className="uppercase">{m.role}</td><td className="text-white/60">{m.acceptedAt ? new Date(m.acceptedAt).toLocaleDateString() : 'pending'}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="border-2 border-white/30 bg-black/50 p-4">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">PROJECTS ({projects.length})</h2>
        <table className="w-full font-mono text-xs">
          <thead className="text-white/50"><tr><th className="text-left py-1">CODE</th><th className="text-left">NAME</th><th className="text-left">STATUS</th><th className="text-left">CREATED</th></tr></thead>
          <tbody>{projects.map((p: any) => <tr key={p.id} className="border-t border-white/10"><td className="py-1 text-[var(--color-brand)]">{p.code}</td><td>{p.name}</td><td className="uppercase">{p.status}</td><td className="text-white/60">{new Date(p.createdAt).toLocaleDateString()}</td></tr>)}</tbody>
        </table>
      </section>

      <FlagOverridePanel orgId={org.id} />
    </div>
  );
}

function FlagOverridePanel({ orgId }: { orgId: string }) {
  const flags = trpc.featureFlag.list.useQuery(undefined, { retry: false });
  const setOverride = trpc.featureFlag.setOverride.useMutation();

  return (
    <section className="border-2 border-white/30 bg-black/50 p-4">
      <h2 className="font-mono text-xs tracking-wider text-[var(--color-brand)] mb-3">FEATURE FLAG OVERRIDES</h2>
      <p className="font-mono text-[10px] text-white/50 mb-3">Force ON/OFF per flag for this org. Clear to fall back to global + rollout %.</p>
      <table className="w-full font-mono text-xs">
        <thead className="text-white/50"><tr>
          <th className="text-left py-1">KEY</th>
          <th className="text-left">GLOBAL</th>
          <th className="text-right">OVERRIDE</th>
        </tr></thead>
        <tbody>
          {flags.data?.map(f => (
            <tr key={f.key} className="border-t border-white/10">
              <td className="py-1 text-[var(--color-brand)]">{f.key}</td>
              <td className="text-white/60">{f.enabledGlobally ? 'ON' : 'OFF'} · {f.rolloutPct}%</td>
              <td className="text-right space-x-1">
                <button onClick={() => setOverride.mutate({ organizationId: orgId, flagKey: f.key, enabled: true })}
                  className="text-[10px] bg-green-700 hover:bg-green-600 text-white px-2 py-0.5">FORCE ON</button>
                <button onClick={() => setOverride.mutate({ organizationId: orgId, flagKey: f.key, enabled: false })}
                  className="text-[10px] bg-neutral-700 hover:bg-neutral-600 text-white px-2 py-0.5">FORCE OFF</button>
                <button onClick={() => setOverride.mutate({ organizationId: orgId, flagKey: f.key, enabled: null })}
                  className="text-[10px] text-white/60 hover:text-white px-2 py-0.5 underline">clear</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
