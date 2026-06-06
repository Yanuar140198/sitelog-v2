'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@sitelog/api-client/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EntriesPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const projects = trpc.project.list.useQuery();
  const list = trpc.entry.list.useQuery({ projectId: projectId || undefined, from: from || undefined, to: to || undefined, limit: 100 });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">FIELD</p>
        <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Daily Entries</h1>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label>Project</Label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
            <option value="">{projects.isLoading ? 'Loading…' : 'All projects'}</option>
            {(projects.data ?? []).map(p => (
              <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}</option>
            ))}
          </select>
        </div>
        <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs bg-white border-2 border-[var(--color-ink)] min-w-[720px]">
        <thead className="bg-[var(--color-ink)] text-white">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">DATE</th>
            <th className="text-left px-3 py-2 tracking-wider">PROJECT</th>
            <th className="text-left px-3 py-2 tracking-wider">SHIFT</th>
            <th className="text-left px-3 py-2 tracking-wider">WEATHER</th>
            <th className="text-right px-3 py-2 tracking-wider">HOURS</th>
            <th className="text-right px-3 py-2 tracking-wider">WORKFORCE</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(r => (
            <tr key={r.entry.id} className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
              onClick={() => router.push(`/app/entries/${r.entry.id}` as any)}>
              <td className="px-3 py-2 font-bold">{new Date(r.entry.entryDate).toLocaleDateString('id-ID')}</td>
              <td className="px-3 py-2"><span className="text-[var(--color-brand)] font-bold">{r.projectCode}</span> · {r.projectName}</td>
              <td className="px-3 py-2 uppercase">{r.entry.shift}</td>
              <td className="px-3 py-2 uppercase text-[10px]">{r.entry.weather ?? '—'}</td>
              <td className="px-3 py-2 text-right">{r.entry.effectiveHours ?? '—'}</td>
              <td className="px-3 py-2 text-right">{r.entry.workforce ?? '—'}</td>
            </tr>
          ))}
          {list.data?.length === 0 && (
            <tr><td colSpan={6} className="text-center py-12 text-neutral-500">No entries in range.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
