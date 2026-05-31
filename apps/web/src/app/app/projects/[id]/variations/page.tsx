'use client';
/**
 * Variation Order Log — per-project change-request register.
 *
 * KPI cards: total approved cost · time-extension days · pending count · implemented count.
 * Status breakdown + table with row drawer for view/edit/submit/approve/reject.
 */
import { use, useMemo, useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';
import Link from 'next/link';
import { FileEdit, Plus, X, ArrowLeft, Check, Ban, Send, PackageCheck } from 'lucide-react';

const VO_TYPES = [
  { key: 'addition', label: 'ADDITION', tone: 'bg-green-200 text-green-900' },
  { key: 'deletion', label: 'DELETION', tone: 'bg-red-200 text-red-900' },
  { key: 'substitution', label: 'SUBSTITUTION', tone: 'bg-blue-200 text-blue-900' },
  { key: 'time_extension', label: 'TIME EXT.', tone: 'bg-amber-200 text-amber-900' },
  { key: 'design_change', label: 'DESIGN CHG', tone: 'bg-purple-200 text-purple-900' },
] as const;

const STATUSES = [
  { key: 'draft', label: 'DRAFT', tone: 'bg-neutral-300 text-neutral-900' },
  { key: 'submitted', label: 'SUBMITTED', tone: 'bg-blue-500 text-white' },
  { key: 'under_review', label: 'REVIEW', tone: 'bg-amber-500 text-white' },
  { key: 'approved', label: 'APPROVED', tone: 'bg-green-600 text-white' },
  { key: 'rejected', label: 'REJECTED', tone: 'bg-red-700 text-white' },
  { key: 'implemented', label: 'IMPLEMENTED', tone: 'bg-emerald-700 text-white' },
  { key: 'invoiced', label: 'INVOICED', tone: 'bg-indigo-700 text-white' },
] as const;

type VoType = typeof VO_TYPES[number]['key'];

function typeBadge(t: string) {
  const m = VO_TYPES.find(x => x.key === t);
  return m
    ? <span className={`inline-block px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider ${m.tone}`}>{m.label}</span>
    : <span className="font-mono text-[10px]">{t}</span>;
}
function statusBadge(s: string) {
  const m = STATUSES.find(x => x.key === s);
  return m
    ? <span className={`inline-block px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider ${m.tone}`}>{m.label}</span>
    : <span className="font-mono text-[10px]">{s}</span>;
}

// Camel/snake compat read — backend may return either casing depending on route path.
function val<T = any>(it: any, camel: string, snake: string): T {
  return (it?.[camel] ?? it?.[snake]) as T;
}

export default function VariationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = trpc.project.get.useQuery({ id });
  const summary = (trpc as any).variationOrder?.summary.useQuery({ projectId: id });
  const list = (trpc as any).variationOrder?.list.useQuery({ projectId: id });
  const utils = trpc.useUtils();

  const [showNew, setShowNew] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const invalidateAll = () => {
    (utils as any).variationOrder?.list.invalidate({ projectId: id });
    (utils as any).variationOrder?.summary.invalidate({ projectId: id });
  };

  const create = (trpc as any).variationOrder?.create.useMutation({
    onSuccess: () => {
      invalidateAll();
      setShowNew(false);
    },
  });

  const rows: any[] = list?.data ?? [];
  const implementedCount = (summary?.data?.countByStatus?.implemented ?? 0) + (summary?.data?.countByStatus?.invoiced ?? 0);

  // Auto-suggest VO# (next index based on existing VO-### pattern).
  const nextVoNumber = useMemo(() => {
    const nums = rows
      .map(r => /VO-(\d+)/i.exec(r.voNumber ?? r.vo_number ?? '')?.[1])
      .filter(Boolean)
      .map(Number);
    const n = nums.length ? Math.max(...nums) + 1 : 1;
    return `VO-${String(n).padStart(3, '0')}`;
  }, [rows]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b-2 border-[var(--color-ink)] px-4 md:px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href={`/app/projects/${id}`} className="p-2 border border-[var(--color-ink)] hover:bg-neutral-100">
            <ArrowLeft size={14} />
          </Link>
          <div>
            <div className="font-mono text-[10px] tracking-wider text-[var(--color-brand)] font-bold flex items-center gap-2">
              <FileEdit size={12} />
              {project.data?.code} · VARIATION ORDERS
              <span className="text-neutral-500">· {rows.length} total</span>
            </div>
            <h1 className="font-display text-xl font-bold">{project.data?.name}</h1>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono text-xs font-bold tracking-wider hover:opacity-90 inline-flex items-center gap-2"
        >
          <Plus size={14} /> NEW VO
        </button>
      </header>

      {/* KPI cards */}
      <section className="px-4 md:px-6 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="TOTAL APPROVED COST" big={fmtIDR(summary?.data?.totalApprovedCost ?? 0)}
             tone={(summary?.data?.totalApprovedCost ?? 0) < 0 ? 'text-red-600' : 'text-[var(--color-ink)]'} sub="approved + implemented + invoiced" />
        <Kpi label="TIME EXTENSION DAYS" big={`${summary?.data?.totalApprovedDays ?? 0}d`}
             tone={(summary?.data?.totalApprovedDays ?? 0) > 0 ? 'text-amber-700' : 'text-[var(--color-ink)]'} sub="approved schedule impact" />
        <Kpi label="PENDING" big={String(summary?.data?.totalPending ?? 0)}
             tone={(summary?.data?.totalPending ?? 0) > 0 ? 'text-blue-700' : 'text-neutral-400'} sub="draft / submitted / review" />
        <Kpi label="IMPLEMENTED" big={String(implementedCount)}
             tone={implementedCount > 0 ? 'text-emerald-700' : 'text-neutral-400'} sub="completed on site" />
      </section>

      {/* Status breakdown */}
      <section className="px-4 md:px-6 pb-4">
        <div className="font-mono text-[10px] tracking-wider text-neutral-500 font-bold mb-2">STATUS BREAKDOWN</div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => {
            const n = summary?.data?.countByStatus?.[s.key] ?? 0;
            return (
              <div key={s.key} className="bg-white border-2 border-[var(--color-ink)] px-3 py-2 flex items-center gap-2">
                <span className={`inline-block px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider ${s.tone}`}>{s.label}</span>
                <span className="font-display font-bold text-base">{n}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Table */}
      <section className="px-4 md:px-6 pb-10">
        <div className="bg-white border-2 border-[var(--color-ink)] overflow-x-auto">
          {!rows.length ? (
            <div className="p-16 text-center">
              <FileEdit size={48} className="mx-auto text-[var(--color-brand)]" />
              <h3 className="font-display text-xl font-bold mt-4">No variation orders yet</h3>
              <p className="font-mono text-xs text-neutral-500 mt-2">
                Hit + NEW VO when the client requests scope changes (added culvert, pavement spec change, etc).
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[900px] font-mono text-xs">
              <thead className="bg-[var(--color-ink)] text-white">
                <tr>
                  <th className="text-left px-3 py-2 tracking-wider w-[100px]">VO #</th>
                  <th className="text-left px-3 py-2 tracking-wider">TITLE</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[130px]">TYPE</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[140px]">COST IMPACT</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[70px]">DAYS</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[130px]">STATUS</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[110px]">REQUESTED</th>
                  <th className="w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((it: any) => {
                  const cost = Number(it.costImpact ?? it.cost_impact ?? 0);
                  const days = Number(it.timeImpactDays ?? it.time_impact_days ?? 0);
                  return (
                    <tr key={it.id} className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                        onClick={() => setDrawerId(it.id)}>
                      <td className="px-3 py-2 font-bold">{it.voNumber ?? it.vo_number}</td>
                      <td className="px-3 py-2">{it.title}</td>
                      <td className="px-3 py-2">{typeBadge(it.voType ?? it.vo_type)}</td>
                      <td className={`px-3 py-2 text-right font-bold ${cost < 0 ? 'text-red-600' : ''}`}>{fmtIDR(cost)}</td>
                      <td className={`px-3 py-2 text-right ${days > 0 ? 'text-amber-700 font-bold' : ''}`}>{days || '—'}</td>
                      <td className="px-3 py-2">{statusBadge(it.status)}</td>
                      <td className="px-3 py-2 text-[11px] text-neutral-600">
                        {(it.requestedDate ?? it.requested_date) ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={e => { e.stopPropagation(); setDrawerId(it.id); }} className="text-[var(--color-brand)] underline">view</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {showNew && (
        <NewVoModal
          projectId={id}
          suggestedNumber={nextVoNumber}
          onClose={() => setShowNew(false)}
          onSubmit={(v) => create?.mutate(v)}
          pending={!!create?.isPending}
          errorMsg={create?.error?.message ?? null}
        />
      )}
      {drawerId && (
        <VoDrawer id={drawerId} onClose={() => setDrawerId(null)} onMutated={invalidateAll} />
      )}
    </div>
  );
}

function Kpi({ label, big, tone, sub }: { label: string; big: string; tone?: string; sub?: string }) {
  return (
    <div className="bg-white border-2 border-[var(--color-ink)] p-5">
      <div className="font-mono text-[10px] tracking-wider text-neutral-500 font-bold">{label}</div>
      <div className={`font-display text-3xl font-bold mt-2 ${tone ?? ''}`}>{big}</div>
      {sub && <div className="font-mono text-[10px] text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}

function NewVoModal({ projectId, suggestedNumber, onClose, onSubmit, pending, errorMsg }: {
  projectId: string;
  suggestedNumber: string;
  onClose: () => void;
  onSubmit: (v: any) => void;
  pending: boolean;
  errorMsg: string | null;
}) {
  const [form, setForm] = useState({
    voNumber: suggestedNumber,
    title: '',
    voType: 'addition' as VoType,
    description: '',
    justification: '',
    costImpact: '',
    timeImpactDays: '',
    requestedBy: '',
    requestedDate: new Date().toISOString().slice(0, 10),
  });

  const submit = () => {
    onSubmit({
      projectId,
      voNumber: form.voNumber.trim(),
      title: form.title.trim(),
      voType: form.voType,
      description: form.description,
      justification: form.justification || null,
      costImpact: form.costImpact === '' ? 0 : Number(form.costImpact),
      timeImpactDays: form.timeImpactDays === '' ? 0 : Number(form.timeImpactDays),
      requestedBy: form.requestedBy || null,
      requestedDate: form.requestedDate || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border-2 border-[var(--color-ink)] max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-[var(--color-ink)] text-white px-4 py-3 flex items-center justify-between">
          <h2 className="font-mono text-xs tracking-wider font-bold">NEW VARIATION ORDER</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="VO #">
              <input value={form.voNumber} onChange={e => setForm({ ...form, voNumber: e.target.value })}
                     className="w-full border border-[var(--color-ink)] px-2 py-1 font-bold" />
            </Field>
            <Field label="TYPE">
              <select value={form.voType} onChange={e => setForm({ ...form, voType: e.target.value as VoType })}
                      className="w-full border border-[var(--color-ink)] px-2 py-1">
                {VO_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="TITLE">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                   placeholder="e.g. Add box culvert at STA 1+200"
                   className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
          <Field label="DESCRIPTION">
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      rows={3} className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
          <Field label="JUSTIFICATION">
            <textarea value={form.justification} onChange={e => setForm({ ...form, justification: e.target.value })}
                      rows={2} placeholder="why is this change needed?"
                      className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="COST IMPACT (IDR, negative = credit)">
              <input type="number" value={form.costImpact} onChange={e => setForm({ ...form, costImpact: e.target.value })}
                     placeholder="0" className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
            <Field label="TIME IMPACT (DAYS)">
              <input type="number" value={form.timeImpactDays} onChange={e => setForm({ ...form, timeImpactDays: e.target.value })}
                     placeholder="0" className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="REQUESTED BY (client rep)">
              <input value={form.requestedBy} onChange={e => setForm({ ...form, requestedBy: e.target.value })}
                     placeholder="e.g. Ir. Hadi (PPK)"
                     className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
            <Field label="REQUESTED DATE">
              <input type="date" value={form.requestedDate} onChange={e => setForm({ ...form, requestedDate: e.target.value })}
                     className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
          </div>
          {errorMsg && <div className="text-red-600 text-[10px]">{errorMsg}</div>}
        </div>
        <div className="border-t-2 border-[var(--color-ink)] p-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-[var(--color-ink)] font-mono text-xs">CANCEL</button>
          <button
            onClick={submit}
            disabled={pending || !form.voNumber || !form.title || !form.description}
            className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono text-xs font-bold disabled:opacity-50"
          >
            {pending ? 'SAVING…' : 'CREATE DRAFT'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VoDrawer({ id, onClose, onMutated }: { id: string; onClose: () => void; onMutated: () => void }) {
  const detail = (trpc as any).variationOrder?.get.useQuery({ id });
  const utils = trpc.useUtils();
  const refresh = () => {
    (utils as any).variationOrder?.get.invalidate({ id });
    onMutated();
  };

  const submit = (trpc as any).variationOrder?.submit.useMutation({ onSuccess: refresh });
  const approve = (trpc as any).variationOrder?.approve.useMutation({ onSuccess: refresh });
  const reject = (trpc as any).variationOrder?.reject.useMutation({ onSuccess: refresh });
  const markImplemented = (trpc as any).variationOrder?.markImplemented.useMutation({ onSuccess: refresh });
  const update = (trpc as any).variationOrder?.update.useMutation({ onSuccess: refresh });

  const it: any = detail?.data;
  const [rejectReason, setRejectReason] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [implDate, setImplDate] = useState(new Date().toISOString().slice(0, 10));
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editDays, setEditDays] = useState('');

  const startEdit = () => {
    setEditTitle(it?.title ?? '');
    setEditDesc(it?.description ?? '');
    setEditCost(String(val(it, 'costImpact', 'cost_impact') ?? 0));
    setEditDays(String(val(it, 'timeImpactDays', 'time_impact_days') ?? 0));
    setEditMode(true);
  };

  const saveEdit = () => {
    update?.mutate({
      id,
      title: editTitle,
      description: editDesc,
      costImpact: Number(editCost || 0),
      timeImpactDays: Number(editDays || 0),
    });
    setEditMode(false);
  };

  const status: string = it?.status ?? '';
  const canSubmit = status === 'draft';
  const canApproveReject = status === 'submitted' || status === 'under_review';
  const canImplement = status === 'approved';
  const cost = Number(val(it, 'costImpact', 'cost_impact') ?? 0);
  const days = Number(val(it, 'timeImpactDays', 'time_impact_days') ?? 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white border-l-2 border-[var(--color-ink)] w-full max-w-xl h-full overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-[var(--color-ink)] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <h2 className="font-mono text-xs tracking-wider font-bold">
            {it?.voNumber ?? it?.vo_number ?? 'VARIATION ORDER'}
          </h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {!it ? (
          <div className="p-6 font-mono text-xs text-neutral-500">Loading…</div>
        ) : (
          <div className="p-5 space-y-4 font-mono text-xs">
            <div className="flex gap-2 items-center flex-wrap">
              {typeBadge(val(it, 'voType', 'vo_type'))}
              {statusBadge(status)}
            </div>

            {!editMode ? (
              <>
                <Detail label="TITLE">{it.title}</Detail>
                <Detail label="DESCRIPTION"><span className="whitespace-pre-wrap">{it.description}</span></Detail>
                {it.justification && <Detail label="JUSTIFICATION"><span className="whitespace-pre-wrap">{it.justification}</span></Detail>}
                <div className="grid grid-cols-2 gap-3">
                  <Detail label="COST IMPACT">
                    <span className={`font-bold text-base ${cost < 0 ? 'text-red-600' : ''}`}>{fmtIDR(cost)}</span>
                  </Detail>
                  <Detail label="TIME IMPACT">
                    <span className={`font-bold text-base ${days > 0 ? 'text-amber-700' : ''}`}>{days} days</span>
                  </Detail>
                </div>
                {(val(it, 'requestedBy', 'requested_by') || val(it, 'requestedDate', 'requested_date')) && (
                  <Detail label="REQUESTED">
                    {val(it, 'requestedBy', 'requested_by') ?? '—'}
                    {val(it, 'requestedDate', 'requested_date') ? ` · ${val(it, 'requestedDate', 'requested_date')}` : ''}
                  </Detail>
                )}
                {val(it, 'submittedAt', 'submitted_at') && <Detail label="SUBMITTED">{String(val(it, 'submittedAt', 'submitted_at'))}</Detail>}
                {val(it, 'approvedAt', 'approved_at') && <Detail label="APPROVED">{String(val(it, 'approvedAt', 'approved_at'))}</Detail>}
                {val(it, 'implementedAt', 'implemented_at') && <Detail label="IMPLEMENTED">{String(val(it, 'implementedAt', 'implemented_at'))}</Detail>}
                {val(it, 'rejectionReason', 'rejection_reason') && (
                  <Detail label="REJECTION REASON">
                    <span className="whitespace-pre-wrap text-red-700">{val(it, 'rejectionReason', 'rejection_reason')}</span>
                  </Detail>
                )}
                {it.notes && <Detail label="NOTES"><span className="whitespace-pre-wrap">{it.notes}</span></Detail>}

                <div className="border-t-2 border-[var(--color-ink)] pt-4 flex flex-wrap gap-2">
                  <button onClick={startEdit} className="px-3 py-1 border border-[var(--color-ink)] font-bold">EDIT</button>
                  {canSubmit && (
                    <button
                      onClick={() => submit?.mutate({ id })}
                      disabled={submit?.isPending}
                      className="bg-blue-600 text-white px-3 py-1 font-bold disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <Send size={12} /> SUBMIT FOR REVIEW
                    </button>
                  )}
                  {canImplement && (
                    <div className="flex gap-1 items-center">
                      <input type="date" value={implDate} onChange={e => setImplDate(e.target.value)}
                             className="border border-[var(--color-ink)] px-2 py-1" />
                      <button
                        onClick={() => markImplemented?.mutate({ id, implementedAt: implDate })}
                        disabled={markImplemented?.isPending}
                        className="bg-emerald-700 text-white px-3 py-1 font-bold disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        <PackageCheck size={12} /> MARK IMPLEMENTED
                      </button>
                    </div>
                  )}
                </div>

                {canApproveReject && (
                  <>
                    <div className="border-t-2 border-[var(--color-ink)] pt-4">
                      <div className="font-bold tracking-wider mb-2">APPROVE (owner/admin)</div>
                      <Field label="NOTES (optional)">
                        <textarea value={approveNotes} onChange={e => setApproveNotes(e.target.value)} rows={2}
                                  className="w-full border border-[var(--color-ink)] px-2 py-1" />
                      </Field>
                      {approve?.error && <div className="text-red-600 text-[10px] mt-1">{approve.error.message}</div>}
                      <button
                        onClick={() => approve?.mutate({ id, notes: approveNotes || undefined })}
                        disabled={approve?.isPending}
                        className="mt-2 w-full bg-green-700 text-white px-3 py-2 font-bold tracking-wider disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        <Check size={14} /> {approve?.isPending ? 'APPROVING…' : 'APPROVE VO'}
                      </button>
                    </div>
                    <div className="border-t-2 border-[var(--color-ink)] pt-4">
                      <div className="font-bold tracking-wider mb-2">REJECT (owner/admin)</div>
                      <Field label="REJECTION REASON (required)">
                        <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                                  className="w-full border border-[var(--color-ink)] px-2 py-1" />
                      </Field>
                      {reject?.error && <div className="text-red-600 text-[10px] mt-1">{reject.error.message}</div>}
                      <button
                        onClick={() => reject?.mutate({ id, rejectionReason: rejectReason })}
                        disabled={!rejectReason || reject?.isPending}
                        className="mt-2 w-full bg-red-700 text-white px-3 py-2 font-bold tracking-wider disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        <Ban size={14} /> {reject?.isPending ? 'REJECTING…' : 'REJECT VO'}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <Field label="TITLE">
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                         className="w-full border border-[var(--color-ink)] px-2 py-1" />
                </Field>
                <Field label="DESCRIPTION">
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                            className="w-full border border-[var(--color-ink)] px-2 py-1" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="COST IMPACT">
                    <input type="number" value={editCost} onChange={e => setEditCost(e.target.value)}
                           className="w-full border border-[var(--color-ink)] px-2 py-1" />
                  </Field>
                  <Field label="DAYS">
                    <input type="number" value={editDays} onChange={e => setEditDays(e.target.value)}
                           className="w-full border border-[var(--color-ink)] px-2 py-1" />
                  </Field>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditMode(false)} className="px-3 py-1 border border-[var(--color-ink)] font-bold">CANCEL</button>
                  <button onClick={saveEdit} disabled={update?.isPending}
                          className="bg-[var(--color-brand)] text-white px-3 py-1 font-bold disabled:opacity-50">
                    {update?.isPending ? 'SAVING…' : 'SAVE'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-bold tracking-wider text-[10px] text-neutral-600 mb-1">{label}</div>
      {children}
    </label>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-bold tracking-wider text-[10px] text-neutral-500">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
