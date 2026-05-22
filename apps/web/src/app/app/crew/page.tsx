'use client';
import { useMemo, useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Search, X, Pencil, Trash2 } from 'lucide-react';

const ROLES = ['mandor', 'tukang', 'pekerja', 'operator', 'helper', 'driver', 'surveyor', 'security', 'admin', 'other'] as const;
const STATUSES = ['active', 'on_leave', 'terminated'] as const;
type Role = typeof ROLES[number];
type Status = typeof STATUSES[number];

const STATUS_COLOR: Record<Status, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-700',
  on_leave: 'bg-amber-100 text-amber-700 border-amber-700',
  terminated: 'bg-neutral-200 text-neutral-600 border-neutral-600',
};

export default function CrewPage() {
  const [statusFilter, setStatusFilter] = useState<Status>('active');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [q, setQ] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const list = trpc.crew.list.useQuery({
    status: statusFilter,
    role: roleFilter || undefined,
    q: q || undefined,
  });
  const utils = trpc.useUtils();
  const del = trpc.crew.delete.useMutation({ onSuccess: () => utils.crew.list.invalidate() });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">WORKFORCE</p>
          <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Crew</h1>
          <p className="font-mono text-xs text-neutral-500 mt-2">
            {list.data?.length ?? 0} {statusFilter.replace('_', ' ')} member{(list.data?.length ?? 0) === 1 ? '' : 's'}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}><Plus size={14} /> NEW CREW</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-white border-2 border-[var(--color-ink)] p-3">
        <div className="flex gap-1">
          {STATUSES.map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 font-mono text-[10px] tracking-wider border-2 ${
                statusFilter === s ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]' : 'bg-white border-[var(--color-ink)]'
              }`}>
              {s.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as Role | '')}
          className="px-3 py-1.5 bg-white border-2 border-[var(--color-ink)] font-mono text-xs">
          <option value="">ALL ROLES</option>
          {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
        </select>
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2 top-2.5 text-neutral-400" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / nickname / phone / KTP" className="pl-7 text-xs" />
        </div>
      </div>

      <table className="w-full font-mono text-xs bg-white border-2 border-[var(--color-ink)]">
        <thead className="bg-[var(--color-ink)] text-white">
          <tr>
            <th className="text-left px-3 py-2 tracking-wider">FULL NAME</th>
            <th className="text-left px-3 py-2 tracking-wider">NICKNAME</th>
            <th className="text-left px-3 py-2 tracking-wider">ROLE</th>
            <th className="text-right px-3 py-2 tracking-wider">DAILY RATE</th>
            <th className="text-left px-3 py-2 tracking-wider">STATUS</th>
            <th className="text-right px-3 py-2 tracking-wider">ASSIGNMENTS</th>
            <th className="w-24"></th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map(c => (
            <tr key={c.id} className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
              onClick={() => setEditId(c.id)}>
              <td className="px-3 py-2 font-bold">{c.fullName}</td>
              <td className="px-3 py-2 text-neutral-500">{c.nickname ?? '—'}</td>
              <td className="px-3 py-2">
                <span className="bg-[var(--color-ink)] text-white px-2 py-0.5 text-[10px] tracking-wider">{c.role.toUpperCase()}</span>
              </td>
              <td className="px-3 py-2 text-right">{fmtIDR(Number(c.dailyRate))}</td>
              <td className="px-3 py-2">
                <span className={`inline-block px-2 py-0.5 text-[10px] tracking-wider border ${STATUS_COLOR[c.status as Status]}`}>
                  {c.status.replace('_', ' ').toUpperCase()}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-bold text-[var(--color-brand)]">{c.activeAssignments}</td>
              <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                <button onClick={() => setEditId(c.id)} className="p-1 hover:bg-neutral-100" title="Edit"><Pencil size={13} /></button>
                <button onClick={() => confirm(`Terminate ${c.fullName}?`) && del.mutate({ id: c.id })}
                  className="p-1 hover:bg-red-50 text-red-600" title="Terminate"><Trash2 size={13} /></button>
              </td>
            </tr>
          ))}
          {!list.isLoading && list.data?.length === 0 && (
            <tr><td colSpan={7} className="text-center py-12 text-neutral-500">No crew members. Add one to get started.</td></tr>
          )}
        </tbody>
      </table>

      {showCreate && <CrewModal onClose={() => setShowCreate(false)} />}
      {editId && <CrewDrawer id={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}

function CrewModal({ onClose, initial, id }: { onClose: () => void; initial?: Partial<FormState>; id?: string }) {
  const utils = trpc.useUtils();
  const create = trpc.crew.create.useMutation({
    onSuccess: () => { utils.crew.list.invalidate(); onClose(); },
  });
  const update = trpc.crew.update.useMutation({
    onSuccess: () => { utils.crew.list.invalidate(); utils.crew.get.invalidate(); onClose(); },
  });
  const isEdit = !!id;
  const [form, setForm] = useState<FormState>({
    fullName: initial?.fullName ?? '',
    nickname: initial?.nickname ?? '',
    phone: initial?.phone ?? '',
    nationalId: initial?.nationalId ?? '',
    role: (initial?.role as Role) ?? 'pekerja',
    dailyRate: initial?.dailyRate ?? 0,
    hourlyRate: initial?.hourlyRate ?? 0,
    status: (initial?.status as Status) ?? 'active',
    hireDate: initial?.hireDate ?? '',
    notes: initial?.notes ?? '',
  });
  function set<K extends keyof FormState>(k: K, v: FormState[K]) { setForm(p => ({ ...p, [k]: v })); }
  const pending = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-2 border-[var(--color-ink)] p-6 max-w-xl w-full shadow-[8px_8px_0_var(--color-brand)]">
        <h2 className="font-display text-2xl font-bold mb-4">{isEdit ? 'Edit Crew' : 'New Crew Member'}</h2>
        <form
          onSubmit={e => {
            e.preventDefault();
            const payload = {
              fullName: form.fullName,
              nickname: form.nickname || undefined,
              phone: form.phone || undefined,
              nationalId: form.nationalId || undefined,
              role: form.role,
              dailyRate: Number(form.dailyRate) || 0,
              hourlyRate: Number(form.hourlyRate) || 0,
              hireDate: form.hireDate || undefined,
              notes: form.notes || undefined,
            };
            if (isEdit && id) update.mutate({ id, ...payload, status: form.status });
            else create.mutate(payload);
          }}
          className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Full Name *</Label><Input required value={form.fullName} onChange={e => set('fullName', e.target.value)} /></div>
          <div><Label>Nickname</Label><Input value={form.nickname} onChange={e => set('nickname', e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0812..." /></div>
          <div><Label>KTP / National ID</Label><Input value={form.nationalId} onChange={e => set('nationalId', e.target.value)} /></div>
          <div>
            <Label>Role</Label>
            <select value={form.role} onChange={e => set('role', e.target.value as Role)}
              className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
              {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </select>
          </div>
          <div><Label>Daily Rate (Rp)</Label><Input type="number" value={form.dailyRate} onChange={e => set('dailyRate', e.target.value as any)} /></div>
          <div><Label>Hourly Rate (Rp)</Label><Input type="number" value={form.hourlyRate} onChange={e => set('hourlyRate', e.target.value as any)} /></div>
          <div><Label>Hire Date</Label><Input type="date" value={form.hireDate} onChange={e => set('hireDate', e.target.value)} /></div>
          {isEdit && (
            <div>
              <Label>Status</Label>
              <select value={form.status} onChange={e => set('status', e.target.value as Status)}
                className="w-full px-3 py-2 bg-white border-2 border-[var(--color-ink)] font-mono text-sm">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>)}
              </select>
            </div>
          )}
          <div className="col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div className="col-span-2 flex gap-2 mt-3">
            <Button type="submit" variant="primary" disabled={pending}>{isEdit ? 'SAVE' : 'CREATE'}</Button>
            <Button type="button" onClick={onClose}>CANCEL</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FormState {
  fullName: string;
  nickname: string;
  phone: string;
  nationalId: string;
  role: Role;
  dailyRate: number | string;
  hourlyRate: number | string;
  status: Status;
  hireDate: string;
  notes: string;
}

function CrewDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = trpc.crew.get.useQuery({ id });
  const [editing, setEditing] = useState(false);

  const initial = useMemo<Partial<FormState> | undefined>(() => {
    if (!detail.data) return undefined;
    return {
      fullName: detail.data.fullName,
      nickname: detail.data.nickname ?? '',
      phone: detail.data.phone ?? '',
      nationalId: detail.data.nationalId ?? '',
      role: detail.data.role as Role,
      dailyRate: Number(detail.data.dailyRate),
      hourlyRate: Number(detail.data.hourlyRate),
      status: detail.data.status as Status,
      hireDate: detail.data.hireDate ?? '',
      notes: detail.data.notes ?? '',
    };
  }, [detail.data]);

  if (editing && initial) return <CrewModal id={id} initial={initial} onClose={() => { setEditing(false); onClose(); }} />;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white border-l-2 border-[var(--color-ink)] w-full max-w-lg h-full overflow-auto">
        <div className="p-5 border-b-2 border-[var(--color-ink)] bg-neutral-50 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-brand)]">CREW MEMBER</p>
            <h2 className="font-display text-2xl font-bold mt-1">{detail.data?.fullName ?? '…'}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white border border-[var(--color-ink)]"><X size={14} /></button>
        </div>

        {!detail.data && <div className="p-6 font-mono text-xs text-neutral-500">Loading…</div>}

        {detail.data && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <KV k="ROLE" v={detail.data.role.toUpperCase()} />
              <KV k="STATUS" v={detail.data.status.replace('_', ' ').toUpperCase()} />
              <KV k="NICKNAME" v={detail.data.nickname ?? '—'} />
              <KV k="PHONE" v={detail.data.phone ?? '—'} />
              <KV k="KTP" v={detail.data.nationalId ?? '—'} />
              <KV k="HIRE DATE" v={detail.data.hireDate ?? '—'} />
              <KV k="DAILY RATE" v={fmtIDR(Number(detail.data.dailyRate))} />
              <KV k="HOURLY RATE" v={fmtIDR(Number(detail.data.hourlyRate))} />
            </div>
            {detail.data.notes && (
              <div className="bg-neutral-50 border-l-2 border-[var(--color-brand)] p-3 font-mono text-xs">{detail.data.notes}</div>
            )}

            <Button variant="primary" onClick={() => setEditing(true)}><Pencil size={13} /> EDIT</Button>

            <div>
              <h3 className="font-display text-sm font-bold tracking-wider mb-2">ASSIGNMENT HISTORY</h3>
              {detail.data.assignments.length === 0 ? (
                <p className="font-mono text-xs text-neutral-500">No assignments yet.</p>
              ) : (
                <table className="w-full font-mono text-[11px] bg-white border-2 border-[var(--color-ink)]">
                  <thead className="bg-[var(--color-ink)] text-white">
                    <tr>
                      <th className="text-left px-2 py-1.5 tracking-wider">PROJECT</th>
                      <th className="text-left px-2 py-1.5 tracking-wider">FROM</th>
                      <th className="text-left px-2 py-1.5 tracking-wider">TO</th>
                      <th className="text-right px-2 py-1.5 tracking-wider">RATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data.assignments.map(a => (
                      <tr key={a.id} className="border-b border-neutral-100">
                        <td className="px-2 py-1.5"><strong>{a.projectCode}</strong> {a.projectName}</td>
                        <td className="px-2 py-1.5">{a.fromDate}</td>
                        <td className="px-2 py-1.5">{a.toDate ?? <span className="text-emerald-600">ACTIVE</span>}</td>
                        <td className="px-2 py-1.5 text-right">
                          {a.dailyRateOverride ? fmtIDR(Number(a.dailyRateOverride)) : <span className="text-neutral-400">base</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.15em] text-neutral-500">{k}</div>
      <div className="font-bold mt-0.5">{v}</div>
    </div>
  );
}
