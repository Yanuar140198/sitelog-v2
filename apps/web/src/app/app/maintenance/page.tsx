'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wrench, Plus, CheckCircle2, AlertTriangle, X } from 'lucide-react';

const KIND = ['scheduled', 'breakdown', 'inspection', 'oil_change', 'tire', 'overhaul'] as const;

export default function MaintenancePage() {
  const upcoming = trpc.maintenance.upcoming.useQuery({ horizonDays: 60 });
  const units = trpc.fleet.unitList.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.maintenance.create.useMutation({ onSuccess: () => { utils.maintenance.upcoming.invalidate(); reset(); setShow(false); } });
  const complete = trpc.maintenance.markCompleted.useMutation({ onSuccess: () => utils.maintenance.upcoming.invalidate() });
  const cancel = trpc.maintenance.cancel.useMutation({ onSuccess: () => utils.maintenance.upcoming.invalidate() });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ unitId: '', kind: 'scheduled' as typeof KIND[number], title: '', description: '', dueAtDate: '', dueAtHm: '', intervalDays: '', intervalHm: '' });
  function reset() { setForm({ unitId: '', kind: 'scheduled', title: '', description: '', dueAtDate: '', dueAtHm: '', intervalDays: '', intervalHm: '' }); }
  function set<K extends keyof typeof form>(k: K, v: any) { setForm(p => ({ ...p, [k]: v })); }

  const overdue = (upcoming.data ?? []).filter(r => r.m.status === 'overdue' || (r.m.dueAtDate && new Date(r.m.dueAtDate) < new Date()));
  const planned = (upcoming.data ?? []).filter(r => !overdue.includes(r));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">FLEET</p>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Maintenance Schedule</h1>
          <p className="font-mono text-xs text-neutral-500 mt-2">
            {overdue.length} overdue · {planned.length} upcoming (60 days)
          </p>
        </div>
        <Button variant="primary" onClick={() => setShow(true)}><Plus size={14} /> SCHEDULE</Button>
      </div>

      {overdue.length > 0 && (
        <Section title={`⚠ OVERDUE (${overdue.length})`} severity="red">
          <Table rows={overdue} onComplete={(id, hm, cost) => complete.mutate({ id, performedAtHm: hm, cost })} onCancel={id => cancel.mutate({ id })} />
        </Section>
      )}

      <Section title={`UPCOMING (${planned.length})`} severity="default">
        {planned.length === 0
          ? <div className="text-center py-12 text-neutral-500 font-mono text-xs">No upcoming maintenance.</div>
          : <Table rows={planned} onComplete={(id, hm, cost) => complete.mutate({ id, performedAtHm: hm, cost })} onCancel={id => cancel.mutate({ id })} />}
      </Section>

      {show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={e => { if (e.target === e.currentTarget) setShow(false); }}>
          <div className="bg-white border-2 border-[var(--color-ink)] p-6 max-w-lg w-full shadow-[8px_8px_0_var(--color-brand)]">
            <h2 className="font-display text-2xl font-bold mb-4">Schedule Maintenance</h2>
            <form onSubmit={e => {
              e.preventDefault();
              create.mutate({
                unitId: form.unitId, kind: form.kind, title: form.title,
                description: form.description || undefined,
                dueAtDate: form.dueAtDate ? new Date(form.dueAtDate) : undefined,
                dueAtHm: form.dueAtHm ? Number(form.dueAtHm) : undefined,
                intervalDays: form.intervalDays ? Number(form.intervalDays) : undefined,
                intervalHm: form.intervalHm ? Number(form.intervalHm) : undefined,
              });
            }} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Unit *</Label>
                <select required value={form.unitId} onChange={e => set('unitId', e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
                  <option value="">— pilih —</option>
                  {units.data?.map(u => <option key={u.id} value={u.id}>{u.nomor} · {u.jenisAlat}</option>)}
                </select>
              </div>
              <div>
                <Label>Kind</Label>
                <select value={form.kind} onChange={e => set('kind', e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
                  {KIND.map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
                </select>
              </div>
              <div><Label>Title *</Label><Input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="Oil change 500h" /></div>
              <div><Label>Due date</Label><Input type="date" value={form.dueAtDate} onChange={e => set('dueAtDate', e.target.value)} /></div>
              <div><Label>Due HM</Label><Input type="number" value={form.dueAtHm} onChange={e => set('dueAtHm', e.target.value)} placeholder="5000" /></div>
              <div><Label>Repeat (days)</Label><Input type="number" value={form.intervalDays} onChange={e => set('intervalDays', e.target.value)} /></div>
              <div><Label>Repeat (HM)</Label><Input type="number" value={form.intervalHm} onChange={e => set('intervalHm', e.target.value)} /></div>
              <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={e => set('description', e.target.value)} /></div>
              <div className="col-span-2 flex gap-2 mt-2">
                <Button type="submit" variant="primary" disabled={create.isPending}>CREATE</Button>
                <Button type="button" onClick={() => setShow(false)}>CANCEL</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, severity, children }: { title: string; severity: 'red' | 'default'; children: React.ReactNode }) {
  return (
    <div className={`border-2 ${severity === 'red' ? 'border-red-600' : 'border-[var(--color-ink)]'} bg-white`}>
      <div className={`px-4 py-2 ${severity === 'red' ? 'bg-red-600' : 'bg-[var(--color-ink)]'} text-white font-mono text-xs tracking-[0.2em]`}>{title}</div>
      {children}
    </div>
  );
}

function Table({ rows, onComplete, onCancel }: { rows: any[]; onComplete: (id: string, hm?: number, cost?: number) => void; onCancel: (id: string) => void }) {
  return (
    <table className="w-full font-mono text-xs">
      <thead className="bg-neutral-100">
        <tr>
          <th className="text-left px-3 py-2">UNIT</th>
          <th className="text-left px-3 py-2">KIND</th>
          <th className="text-left px-3 py-2">TITLE</th>
          <th className="text-left px-3 py-2">DUE</th>
          <th className="w-32"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.m.id} className="border-b border-neutral-100">
            <td className="px-3 py-2 font-bold text-[var(--color-brand)]">{r.unitNomor} <span className="text-neutral-500">{r.unitJenis}</span></td>
            <td className="px-3 py-2 uppercase text-[10px]">{r.m.kind}</td>
            <td className="px-3 py-2">{r.m.title}</td>
            <td className="px-3 py-2 text-neutral-500">
              {r.m.dueAtDate && new Date(r.m.dueAtDate).toLocaleDateString('id-ID')}
              {r.m.dueAtHm && ` · ${r.m.dueAtHm} HM`}
            </td>
            <td className="px-3 py-2 text-right">
              <button onClick={() => { const hm = prompt('Performed at HM?'); onComplete(r.m.id, hm ? Number(hm) : undefined); }}
                className="p-1 text-green-600 hover:bg-green-50" title="Mark completed"><CheckCircle2 size={14} /></button>
              <button onClick={() => confirm('Cancel?') && onCancel(r.m.id)}
                className="p-1 text-red-600 hover:bg-red-50" title="Cancel"><X size={14} /></button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
