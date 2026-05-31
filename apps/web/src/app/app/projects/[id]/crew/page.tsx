'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, ArrowLeft, X } from 'lucide-react';

const ROLES = ['mandor', 'tukang', 'pekerja', 'operator', 'helper', 'driver', 'surveyor', 'security', 'admin', 'other'] as const;
type Role = typeof ROLES[number];

export default function ProjectCrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = trpc.project.get.useQuery({ id });
  const list = trpc.crew.byProject.useQuery({ projectId: id });
  const utils = trpc.useUtils();
  const unassign = trpc.crew.unassignFromProject.useMutation({
    onSuccess: () => utils.crew.byProject.invalidate({ projectId: id }),
  });
  const [showAssign, setShowAssign] = useState(false);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <Link href={`/app/projects/${id}`} className="font-mono text-[10px] tracking-wider text-[var(--color-brand)] inline-flex items-center gap-1 hover:underline">
            <ArrowLeft size={11} /> BACK TO PROJECT
          </Link>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)] mt-1">{project.data?.code}</p>
          <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight mt-1">Crew Assignments</h1>
          <p className="font-mono text-xs text-neutral-500 mt-1">{project.data?.name}</p>
        </div>
        <Button variant="primary" onClick={() => setShowAssign(true)}><Plus size={14} /> ASSIGN CREW</Button>
      </div>

      <div className="overflow-x-auto border-2 border-[var(--color-ink)] bg-white">
      <table className="w-full min-w-[640px] font-mono text-xs bg-white">
        <thead className="bg-[var(--color-ink)] text-white">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">NAME</th>
            <th className="text-left px-3 py-2 tracking-wider">ROLE</th>
            <th className="text-right px-3 py-2 tracking-wider">DAILY RATE</th>
            <th className="text-left px-3 py-2 tracking-wider">FROM</th>
            <th className="text-left px-3 py-2 tracking-wider">TO</th>
            <th className="w-24"></th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(a => {
            const role = (a.roleOverride ?? a.baseRole) as Role;
            const rate = a.dailyRateOverride !== null && a.dailyRateOverride !== undefined ? Number(a.dailyRateOverride) : Number(a.baseDailyRate);
            const isOverride = a.dailyRateOverride !== null && a.dailyRateOverride !== undefined;
            return (
              <tr key={a.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-2 font-bold">
                  {a.fullName}
                  {a.nickname && <span className="text-neutral-500 font-normal"> ({a.nickname})</span>}
                </td>
                <td className="px-3 py-2">
                  <span className="bg-[var(--color-ink)] text-white px-2 py-0.5 text-[10px] tracking-wider">{role.toUpperCase()}</span>
                  {a.roleOverride && <span className="ml-1 bg-[var(--color-brand)] text-white px-1 text-[8px] font-bold">OVR</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  {fmtIDR(rate)}
                  {isOverride && <span className="ml-1 bg-[var(--color-brand)] text-white px-1 text-[8px] font-bold">OVR</span>}
                </td>
                <td className="px-3 py-2">{a.fromDate}</td>
                <td className="px-3 py-2">{a.toDate ?? <span className="text-emerald-600 font-bold">ACTIVE</span>}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => confirm(`Unassign ${a.fullName}?`) && unassign.mutate({ assignmentId: a.id })}
                    className="p-1 hover:bg-red-50 text-red-600" title="Unassign"><X size={14} /></button>
                </td>
              </tr>
            );
          })}
          {!list.isLoading && list.data?.length === 0 && (
            <tr><td colSpan={6} className="text-center py-12 text-neutral-500">No crew assigned. Click ASSIGN CREW to add.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {showAssign && <AssignModal projectId={id} onClose={() => setShowAssign(false)} />}
    </div>
  );
}

function AssignModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const crew = trpc.crew.list.useQuery({ status: 'active' });
  const utils = trpc.useUtils();
  const assign = trpc.crew.assignToProject.useMutation({
    onSuccess: () => { utils.crew.byProject.invalidate({ projectId }); onClose(); },
  });
  const [form, setForm] = useState({
    crewMemberId: '',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: '',
    roleOverride: '' as Role | '',
    dailyRateOverride: '',
    notes: '',
  });
  function set<K extends keyof typeof form>(k: K, v: any) { setForm(p => ({ ...p, [k]: v })); }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] p-6 max-w-lg w-full shadow-[8px_8px_0_var(--color-brand)]">
        <h2 className="font-display text-2xl font-bold mb-4">Assign Crew</h2>
        <form onSubmit={e => {
          e.preventDefault();
          if (!form.crewMemberId) return;
          assign.mutate({
            projectId,
            crewMemberId: form.crewMemberId,
            fromDate: form.fromDate,
            toDate: form.toDate || undefined,
            roleOverride: form.roleOverride || undefined,
            dailyRateOverride: form.dailyRateOverride ? Number(form.dailyRateOverride) : undefined,
            notes: form.notes || undefined,
          });
        }} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Crew Member *</Label>
            <select required value={form.crewMemberId} onChange={e => set('crewMemberId', e.target.value)}
              className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
              <option value="">— pilih —</option>
              {crew.data?.map(c => (
                <option key={c.id} value={c.id}>
                  {c.fullName}{c.nickname ? ` (${c.nickname})` : ''} · {c.role.toUpperCase()} · {fmtIDR(Number(c.dailyRate))}/d
                </option>
              ))}
            </select>
          </div>
          <div><Label>From Date *</Label><Input required type="date" value={form.fromDate} onChange={e => set('fromDate', e.target.value)} /></div>
          <div><Label>To Date</Label><Input type="date" value={form.toDate} onChange={e => set('toDate', e.target.value)} /></div>
          <div>
            <Label>Role Override</Label>
            <select value={form.roleOverride} onChange={e => set('roleOverride', e.target.value as Role | '')}
              className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
              <option value="">— use base role —</option>
              {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </select>
          </div>
          <div><Label>Daily Rate Override (Rp)</Label><Input type="number" value={form.dailyRateOverride} onChange={e => set('dailyRateOverride', e.target.value)} placeholder="leave blank" /></div>
          <div className="sm:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div className="sm:col-span-2 flex gap-2 mt-3">
            <Button type="submit" variant="primary" disabled={assign.isPending || !form.crewMemberId}>ASSIGN</Button>
            <Button type="button" onClick={onClose}>CANCEL</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
