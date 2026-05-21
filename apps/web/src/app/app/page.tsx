'use client';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';
import Link from 'next/link';
import { OnboardingTour } from '@/components/onboarding/tour-card';

export default function DashboardPage() {
  const portfolio = trpc.dashboard.portfolio.useQuery();
  const projects = trpc.project.list.useQuery();

  const total = (portfolio.data ?? []).reduce((a, p) => a + p.grandTotal, 0);
  const earned = (portfolio.data ?? []).reduce((a, p) => a + p.earnedValue, 0);
  const overallProgress = total > 0 ? (earned / total) * 100 : 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">PORTFOLIO</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Dashboard</h1>
      </div>

      <OnboardingTour />

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Projects" value={String(projects.data?.length ?? 0)} />
        <KpiCard label="Portfolio Value" value={fmtIDR(total)} />
        <KpiCard label="Earned Value" value={fmtIDR(earned)} />
        <KpiCard label="Overall Progress" value={`${overallProgress.toFixed(1)}%`} highlight />
      </div>

      {/* Project table */}
      <section className="border-2 border-[var(--color-ink)] bg-white">
        <div className="flex items-center justify-between p-4 border-b-2 border-[var(--color-ink)] bg-neutral-50">
          <h2 className="font-display text-lg font-bold">Active Projects</h2>
          <Link href="/app/projects/new" className="font-mono text-xs tracking-wider text-[var(--color-brand)] hover:underline">
            + NEW PROJECT
          </Link>
        </div>
        <table className="w-full font-mono text-xs">
          <thead className="bg-[var(--color-ink)] text-white">
            <tr>
              <th className="text-left px-4 py-2 tracking-wider">CODE</th>
              <th className="text-left px-4 py-2 tracking-wider">NAME</th>
              <th className="text-left px-4 py-2 tracking-wider">STATUS</th>
              <th className="text-right px-4 py-2 tracking-wider">VALUE</th>
              <th className="text-right px-4 py-2 tracking-wider">SPI</th>
              <th className="text-right px-4 py-2 tracking-wider">PROGRESS</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.data?.map(p => (
              <tr key={p.id} className="border-b border-neutral-200 hover:bg-neutral-50">
                <td className="px-4 py-3 font-bold text-[var(--color-brand)]">
                  <Link href={`/app/projects/${p.id}` as any}>{p.code}</Link>
                </td>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3 uppercase text-[10px]">{p.status}</td>
                <td className="px-4 py-3 text-right">{fmtIDR(p.grandTotal)}</td>
                <td className="px-4 py-3 text-right">{p.spi ? p.spi.toFixed(2) : '—'}</td>
                <td className="px-4 py-3 text-right">{p.progressPct.toFixed(1)}%</td>
              </tr>
            ))}
            {portfolio.data?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-neutral-500">
                No projects yet. <Link href="/app/projects/new" className="text-[var(--color-brand)] underline">Create your first.</Link>
              </td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border-2 border-[var(--color-ink)] p-5 ${highlight ? 'bg-[var(--color-brand)] text-white' : 'bg-white'}`}>
      <div className="font-mono text-[10px] tracking-[0.2em] opacity-70 uppercase">{label}</div>
      <div className="font-display text-3xl font-bold mt-2 tracking-tight">{value}</div>
    </div>
  );
}
