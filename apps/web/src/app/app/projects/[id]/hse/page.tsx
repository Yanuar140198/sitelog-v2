'use client';
/**
 * HSE Incident Log — per-project safety register.
 *
 * KPI cards: days since last incident · open incidents · this-year total.
 * Severity breakdown badges + table with row drawer for view/edit/close.
 */
import { use, useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import Link from 'next/link';
import { ShieldAlert, Plus, X, ArrowLeft, Filter } from 'lucide-react';

const SEVERITIES = [
  { key: 'near_miss', label: 'NEAR MISS', tone: 'bg-yellow-200 text-yellow-900' },
  { key: 'first_aid', label: 'FIRST AID', tone: 'bg-yellow-300 text-yellow-900' },
  { key: 'medical', label: 'MEDICAL', tone: 'bg-amber-400 text-amber-950' },
  { key: 'lost_time', label: 'LOST TIME', tone: 'bg-orange-500 text-white' },
  { key: 'fatality', label: 'FATALITY', tone: 'bg-red-700 text-white' },
  { key: 'property_damage', label: 'PROPERTY', tone: 'bg-neutral-400 text-white' },
  { key: 'environmental', label: 'ENVIRO', tone: 'bg-green-600 text-white' },
] as const;

const STATUSES = [
  { key: 'open', label: 'OPEN', tone: 'bg-red-600 text-white' },
  { key: 'investigating', label: 'INVESTIGATING', tone: 'bg-amber-500 text-white' },
  { key: 'corrective_action', label: 'CORRECTIVE', tone: 'bg-blue-600 text-white' },
  { key: 'closed', label: 'CLOSED', tone: 'bg-neutral-700 text-white' },
] as const;

type Severity = typeof SEVERITIES[number]['key'];
type Status = typeof STATUSES[number]['key'];

function sevBadge(s: string) {
  const m = SEVERITIES.find(x => x.key === s);
  return m ? <span className={`inline-block px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider ${m.tone}`}>{m.label}</span> : s;
}
function statusBadge(s: string) {
  const m = STATUSES.find(x => x.key === s);
  return m ? <span className={`inline-block px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider ${m.tone}`}>{m.label}</span> : s;
}

export default function HsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [statusFilter, setStatusFilter] = useState<Status | ''>('');
  const [severityFilter, setSeverityFilter] = useState<Severity | ''>('');

  const project = trpc.project.get.useQuery({ id });
  const summary = trpc.hse.summary.useQuery({ projectId: id });
  const list = trpc.hse.list.useQuery({
    projectId: id,
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
  });
  const utils = trpc.useUtils();

  const [showNew, setShowNew] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const hasFilter = statusFilter !== '' || severityFilter !== '';
  const clearFilters = () => { setStatusFilter(''); setSeverityFilter(''); };

  const create = trpc.hse.create.useMutation({
    onSuccess: () => {
      utils.hse.list.invalidate({ projectId: id });
      utils.hse.summary.invalidate({ projectId: id });
      setShowNew(false);
    },
  });

  const daysSince = summary.data?.daysSinceLastIncident;
  const openCount = summary.data?.openCount ?? 0;
  const yearCount = summary.data?.thisYearCount ?? 0;

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
              <ShieldAlert size={12} />
              {project.data?.code} · HSE INCIDENT LOG
            </div>
            <h1 className="font-display text-xl font-bold">{project.data?.name}</h1>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono text-xs font-bold tracking-wider hover:opacity-90 inline-flex items-center gap-2"
        >
          <Plus size={14} /> NEW INCIDENT
        </button>
      </header>

      {/* KPI cards */}
      <section className="px-4 md:px-6 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-[var(--color-ink)] p-5">
          <div className="font-mono text-[10px] tracking-wider text-neutral-500 font-bold">DAYS SINCE LAST INCIDENT</div>
          <div className={`font-display text-5xl md:text-6xl font-bold mt-2 ${daysSince == null ? 'text-neutral-400' : daysSince > 30 ? 'text-green-700' : 'text-red-600'}`}>
            {daysSince == null ? '∞' : daysSince}
          </div>
          <div className="font-mono text-[10px] text-neutral-500 mt-1">
            {summary.data?.lastIncidentDate ? `last: ${summary.data.lastIncidentDate}` : 'no incidents reported'}
          </div>
        </div>
        <div className="bg-white border-2 border-[var(--color-ink)] p-5">
          <div className="font-mono text-[10px] tracking-wider text-neutral-500 font-bold">OPEN INCIDENTS</div>
          <div className={`font-display text-5xl md:text-6xl font-bold mt-2 ${openCount > 0 ? 'text-red-600' : 'text-neutral-400'}`}>{openCount}</div>
          <div className="font-mono text-[10px] text-neutral-500 mt-1">requires action</div>
        </div>
        <div className="bg-white border-2 border-[var(--color-ink)] p-5">
          <div className="font-mono text-[10px] tracking-wider text-neutral-500 font-bold">TOTAL THIS YEAR</div>
          <div className="font-display text-5xl md:text-6xl font-bold mt-2">{yearCount}</div>
          <div className="font-mono text-[10px] text-neutral-500 mt-1">{new Date().getFullYear()}</div>
        </div>
      </section>

      {/* Severity breakdown */}
      <section className="px-4 md:px-6 pb-4">
        <div className="font-mono text-[10px] tracking-wider text-neutral-500 font-bold mb-2">SEVERITY BREAKDOWN</div>
        <div className="flex flex-wrap gap-2">
          {SEVERITIES.map(s => {
            const n = summary.data?.bySeverity[s.key] ?? 0;
            return (
              <div key={s.key} className="bg-white border-2 border-[var(--color-ink)] px-3 py-2 flex items-center gap-2">
                <span className={`inline-block px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider ${s.tone}`}>{s.label}</span>
                <span className="font-display font-bold text-base">{n}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Filters */}
      <section className="px-4 md:px-6 pb-4">
        <div className="bg-white border-2 border-[var(--color-ink)] px-3 py-2.5 flex items-center gap-3 flex-wrap font-mono text-[10px]">
          <span className="flex items-center gap-1.5 tracking-wider text-neutral-500 font-bold">
            <Filter size={12} /> FILTER
          </span>
          <label className="flex items-center gap-1.5">
            <span className="tracking-wider text-neutral-600 font-bold">STATUS</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as Status | '')}
              className="border border-[var(--color-ink)] px-2 py-1 bg-white"
            >
              <option value="">ALL</option>
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="tracking-wider text-neutral-600 font-bold">SEVERITY</span>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value as Severity | '')}
              className="border border-[var(--color-ink)] px-2 py-1 bg-white"
            >
              <option value="">ALL</option>
              {SEVERITIES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 border border-[var(--color-ink)] px-2 py-1 tracking-wider font-bold hover:bg-neutral-100"
            >
              <X size={11} /> CLEAR
            </button>
          )}
          <span className="ml-auto tracking-wider text-neutral-500">
            {list.data ? `${list.data.length} SHOWN${hasFilter ? ' (FILTERED)' : ''}` : ''}
          </span>
        </div>
      </section>

      {/* Table */}
      <section className="px-4 md:px-6 pb-10">
        <div className="bg-white border-2 border-[var(--color-ink)] overflow-x-auto">
          {!list.data?.length ? (
            <div className="p-16 text-center">
              <ShieldAlert size={48} className="mx-auto text-[var(--color-brand)]" />
              {hasFilter ? (
                <>
                  <h3 className="font-display text-xl font-bold mt-4">No matching incidents</h3>
                  <p className="font-mono text-xs text-neutral-500 mt-2">No incidents match the selected filters.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 inline-flex items-center gap-1 border border-[var(--color-ink)] px-3 py-1.5 font-mono text-xs tracking-wider font-bold hover:bg-neutral-100"
                  >
                    <X size={12} /> CLEAR FILTERS
                  </button>
                </>
              ) : (
                <>
                  <h3 className="font-display text-xl font-bold mt-4">No incidents recorded</h3>
                  <p className="font-mono text-xs text-neutral-500 mt-2">Hit + NEW INCIDENT to log a near-miss, injury, or environmental event.</p>
                </>
              )}
            </div>
          ) : (
            <table className="w-full min-w-[680px] font-mono text-xs">
              <thead className="bg-[var(--color-ink)] text-white">
                <tr>
                  <th className="text-left px-3 py-2 tracking-wider w-[110px]">DATE</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[120px]">SEVERITY</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[160px]">TYPE</th>
                  <th className="text-left px-3 py-2 tracking-wider">LOCATION</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[140px]">STATUS</th>
                  <th className="w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((it: any) => (
                  <tr key={it.id} className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer" onClick={() => setDrawerId(it.id)}>
                    <td className="px-3 py-2">{it.incidentDate}{it.incidentTime ? ` ${String(it.incidentTime).slice(0, 5)}` : ''}</td>
                    <td className="px-3 py-2">{sevBadge(it.severity)}</td>
                    <td className="px-3 py-2">{it.incidentType}</td>
                    <td className="px-3 py-2 text-[11px]">{it.location}</td>
                    <td className="px-3 py-2">{statusBadge(it.status)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={e => { e.stopPropagation(); setDrawerId(it.id); }} className="text-[var(--color-brand)] underline">view</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {showNew && (
        <NewIncidentModal projectId={id} onClose={() => setShowNew(false)} onSubmit={(v) => create.mutate(v as any)} pending={create.isPending} />
      )}
      {drawerId && (
        <IncidentDrawer id={drawerId} onClose={() => setDrawerId(null)} />
      )}
    </div>
  );
}

function NewIncidentModal({ projectId, onClose, onSubmit, pending }: {
  projectId: string;
  onClose: () => void;
  onSubmit: (v: any) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    incidentDate: new Date().toISOString().slice(0, 10),
    incidentTime: '',
    severity: 'near_miss' as Severity,
    incidentType: '',
    location: '',
    description: '',
    involvedPersons: '',
    immediateAction: '',
  });

  const submit = () => {
    onSubmit({
      projectId,
      incidentDate: form.incidentDate,
      incidentTime: form.incidentTime || null,
      severity: form.severity,
      incidentType: form.incidentType,
      location: form.location,
      description: form.description,
      involvedPersons: form.involvedPersons || null,
      immediateAction: form.immediateAction || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border-2 border-[var(--color-ink)] max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-[var(--color-ink)] text-white px-4 py-3 flex items-center justify-between">
          <h2 className="font-mono text-xs tracking-wider font-bold">NEW HSE INCIDENT</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="DATE">
              <input type="date" value={form.incidentDate} onChange={e => setForm({ ...form, incidentDate: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
            <Field label="TIME">
              <input type="time" value={form.incidentTime} onChange={e => setForm({ ...form, incidentTime: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
          </div>
          <Field label="SEVERITY">
            <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value as Severity })} className="w-full border border-[var(--color-ink)] px-2 py-1">
              {SEVERITIES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="INCIDENT TYPE">
            <input value={form.incidentType} onChange={e => setForm({ ...form, incidentType: e.target.value })} placeholder="e.g. Falling object, Vehicle collision, Slip" className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
          <Field label="LOCATION">
            <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Pit 3, ramp B" className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
          <Field label="DESCRIPTION">
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
          <Field label="INVOLVED PERSONS">
            <input value={form.involvedPersons} onChange={e => setForm({ ...form, involvedPersons: e.target.value })} placeholder="e.g. Operator + 2 helpers" className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
          <Field label="IMMEDIATE ACTION TAKEN">
            <textarea value={form.immediateAction} onChange={e => setForm({ ...form, immediateAction: e.target.value })} rows={2} className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
        </div>
        <div className="border-t-2 border-[var(--color-ink)] p-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-[var(--color-ink)] font-mono text-xs">CANCEL</button>
          <button
            onClick={submit}
            disabled={pending || !form.incidentType || !form.location || !form.description}
            className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono text-xs font-bold disabled:opacity-50"
          >
            {pending ? 'SAVING…' : 'CREATE'}
          </button>
        </div>
      </div>
    </div>
  );
}

function IncidentDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = trpc.hse.get.useQuery({ id });
  const utils = trpc.useUtils();
  const update = trpc.hse.update.useMutation({
    onSuccess: () => {
      utils.hse.get.invalidate({ id });
      utils.hse.list.invalidate();
      utils.hse.summary.invalidate();
    },
  });
  const close = trpc.hse.close.useMutation({
    onSuccess: () => {
      utils.hse.get.invalidate({ id });
      utils.hse.list.invalidate();
      utils.hse.summary.invalidate();
    },
  });

  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [editStatus, setEditStatus] = useState<Status | ''>('');

  const it: any = detail.data;
  const isClosed = it?.status === 'closed';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white border-l-2 border-[var(--color-ink)] w-full max-w-xl h-full overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-[var(--color-ink)] text-white px-4 py-3 flex items-center justify-between sticky top-0">
          <h2 className="font-mono text-xs tracking-wider font-bold">INCIDENT DETAIL</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {!it ? (
          <div className="p-6 font-mono text-xs text-neutral-500">Loading…</div>
        ) : (
          <div className="p-5 space-y-4 font-mono text-xs">
            <div className="flex gap-2 items-center">
              {sevBadge(it.severity)} {statusBadge(it.status)}
            </div>
            <Detail label="DATE / TIME">{it.incident_date ?? it.incidentDate}{(it.incident_time ?? it.incidentTime) ? ` ${String(it.incident_time ?? it.incidentTime).slice(0, 5)}` : ''}</Detail>
            <Detail label="TYPE">{it.incident_type ?? it.incidentType}</Detail>
            <Detail label="LOCATION">{it.location}</Detail>
            <Detail label="DESCRIPTION"><span className="whitespace-pre-wrap">{it.description}</span></Detail>
            {(it.involved_persons ?? it.involvedPersons) && <Detail label="INVOLVED">{it.involved_persons ?? it.involvedPersons}</Detail>}
            {(it.immediate_action ?? it.immediateAction) && <Detail label="IMMEDIATE ACTION"><span className="whitespace-pre-wrap">{it.immediate_action ?? it.immediateAction}</span></Detail>}
            {(it.root_cause ?? it.rootCause) && <Detail label="ROOT CAUSE"><span className="whitespace-pre-wrap">{it.root_cause ?? it.rootCause}</span></Detail>}
            {(it.corrective_action ?? it.correctiveAction) && <Detail label="CORRECTIVE ACTION"><span className="whitespace-pre-wrap">{it.corrective_action ?? it.correctiveAction}</span></Detail>}

            {!isClosed && (
              <>
                <div className="border-t-2 border-[var(--color-ink)] pt-4">
                  <div className="font-bold tracking-wider mb-2">UPDATE STATUS</div>
                  <div className="flex gap-2">
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value as Status)} className="border border-[var(--color-ink)] px-2 py-1 flex-1">
                      <option value="">— select —</option>
                      {STATUSES.filter(s => s.key !== 'closed').map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    <button
                      disabled={!editStatus || update.isPending}
                      onClick={() => editStatus && update.mutate({ id, status: editStatus as Status })}
                      className="bg-[var(--color-ink)] text-white px-3 py-1 font-bold disabled:opacity-50"
                    >SAVE</button>
                  </div>
                </div>

                <div className="border-t-2 border-[var(--color-ink)] pt-4">
                  <div className="font-bold tracking-wider mb-2">CLOSE INCIDENT (owner/admin)</div>
                  <div className="space-y-2">
                    <Field label="ROOT CAUSE">
                      <textarea value={rootCause} onChange={e => setRootCause(e.target.value)} rows={2} className="w-full border border-[var(--color-ink)] px-2 py-1" />
                    </Field>
                    <Field label="CORRECTIVE ACTION">
                      <textarea value={correctiveAction} onChange={e => setCorrectiveAction(e.target.value)} rows={2} className="w-full border border-[var(--color-ink)] px-2 py-1" />
                    </Field>
                    {close.error && <div className="text-red-600 text-[10px]">{close.error.message}</div>}
                    <button
                      disabled={!rootCause || !correctiveAction || close.isPending}
                      onClick={() => close.mutate({ id, rootCause, correctiveAction })}
                      className="w-full bg-red-700 text-white px-3 py-2 font-bold tracking-wider disabled:opacity-50"
                    >
                      {close.isPending ? 'CLOSING…' : 'CLOSE INCIDENT'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {isClosed && (
              <div className="border-t-2 border-[var(--color-ink)] pt-4 text-neutral-500">
                Closed at: {it.closed_at ?? it.closedAt}
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
