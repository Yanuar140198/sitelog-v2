'use client';
/**
 * Weather Log — per-project daily weather + rain-delay register.
 *
 * Critical evidence for time-extension claims under FIDIC/AV1941/RKS:
 * one row per (project, date) covering morning / afternoon / evening
 * conditions, rainfall, disrupted hours, and whether a rain-delay was
 * claimed (and later approved by owner/admin).
 *
 * Layout mirrors HSE page: KPI cards (last 30 days) → table → modal/drawer.
 */
import { use, useEffect, useMemo, useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import Link from 'next/link';
import { CloudRain, Plus, X, ArrowLeft, Check } from 'lucide-react';

const CONDITIONS = [
  { key: 'cerah',         label: 'CERAH',         emoji: '☀️'   },
  { key: 'berawan',       label: 'BERAWAN',       emoji: '⛅'   },
  { key: 'gerimis',       label: 'GERIMIS',       emoji: '🌦️' },
  { key: 'hujan_ringan',  label: 'HUJAN RINGAN',  emoji: '🌧️' },
  { key: 'hujan_sedang',  label: 'HUJAN SEDANG',  emoji: '🌧️🌧️' },
  { key: 'hujan_lebat',   label: 'HUJAN LEBAT',   emoji: '⛈️'  },
  { key: 'badai',         label: 'BADAI',         emoji: '🌪️' },
  { key: 'kabut',         label: 'KABUT',         emoji: '🌫️' },
] as const;

type Condition = typeof CONDITIONS[number]['key'];

function condEmoji(c: string | null | undefined) {
  if (!c) return <span className="text-neutral-300">—</span>;
  const m = CONDITIONS.find(x => x.key === c);
  return m ? <span title={m.label} className="text-lg">{m.emoji}</span> : <span>{c}</span>;
}

/** Returns YYYY-MM-DD for "today" in local time. */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
/** Returns YYYY-MM-DD for "today minus N days". */
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function WeatherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = trpc.project.get.useQuery({ id });
  const org = trpc.org.current.useQuery();
  const isAdmin = org.data?.role === 'owner' || org.data?.role === 'admin';

  const from30 = useMemo(() => daysAgoISO(30), []);
  const summary = trpc.weather.summary.useQuery({ projectId: id, from: from30, to: todayISO() });
  const list = trpc.weather.list.useQuery({ projectId: id });
  const utils = trpc.useUtils();

  const [showNew, setShowNew] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const invalidate = () => {
    utils.weather.list.invalidate({ projectId: id });
    utils.weather.summary.invalidate({ projectId: id, from: from30, to: todayISO() });
  };

  const upsert = trpc.weather.upsert.useMutation({
    onSuccess: () => {
      invalidate();
      setShowNew(false);
    },
  });
  const approve = trpc.weather.approveRainDelay.useMutation({ onSuccess: invalidate });
  const del = trpc.weather.delete.useMutation({ onSuccess: invalidate });

  const rainyDays = summary.data?.rainyDays ?? 0;
  const totalRain = summary.data?.totalRainfallMm ?? 0;
  const totalDisrupted = summary.data?.totalDisruptedHours ?? 0;
  const approvedDays = summary.data?.totalDelayApprovedDays ?? 0;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b-2 border-[var(--color-ink)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/app/projects/${id}`} className="p-2 border border-[var(--color-ink)] hover:bg-neutral-100">
            <ArrowLeft size={14} />
          </Link>
          <div>
            <div className="font-mono text-[10px] tracking-wider text-[var(--color-brand)] font-bold flex items-center gap-2">
              <CloudRain size={12} />
              {project.data?.code} · WEATHER LOG · {list.data?.length ?? 0} days
            </div>
            <h1 className="font-display text-xl font-bold">{project.data?.name}</h1>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono text-xs font-bold tracking-wider hover:opacity-90 inline-flex items-center gap-2"
        >
          <Plus size={14} /> LOG TODAY
        </button>
      </header>

      {/* KPI cards — last 30 days window */}
      <section className="px-6 py-6 grid grid-cols-4 gap-4">
        <Kpi label="RAINY DAYS (30d)" value={rainyDays} sub={`of ${summary.data?.totalDays ?? 0} logged`} tone={rainyDays > 10 ? 'text-blue-700' : ''} />
        <Kpi label="TOTAL RAINFALL (30d)" value={`${totalRain.toFixed(1)}`} sub="mm" />
        <Kpi label="DISRUPTED HOURS (30d)" value={`${totalDisrupted.toFixed(1)}`} sub="hours of work lost" tone={totalDisrupted > 40 ? 'text-red-600' : ''} />
        <Kpi label="RAIN DELAY APPROVED" value={approvedDays} sub={`of ${summary.data?.totalDelayClaimedDays ?? 0} claimed`} tone={approvedDays > 0 ? 'text-green-700' : ''} />
      </section>

      {/* Table */}
      <section className="px-6 pb-10">
        <div className="bg-white border-2 border-[var(--color-ink)]">
          {!list.data?.length ? (
            <div className="p-16 text-center">
              <CloudRain size={48} className="mx-auto text-[var(--color-brand)]" />
              <h3 className="font-display text-xl font-bold mt-4">No weather logged yet</h3>
              <p className="font-mono text-xs text-neutral-500 mt-2">Hit + LOG TODAY each morning to keep audit-grade evidence for rain-delay claims.</p>
            </div>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead className="bg-[var(--color-ink)] text-white">
                <tr>
                  <th className="text-left px-3 py-2 tracking-wider w-[110px]">DATE</th>
                  <th className="text-center px-3 py-2 tracking-wider w-[70px]">MORNING</th>
                  <th className="text-center px-3 py-2 tracking-wider w-[80px]">AFTERNOON</th>
                  <th className="text-center px-3 py-2 tracking-wider w-[70px]">EVENING</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[90px]">RAIN (mm)</th>
                  <th className="text-right px-3 py-2 tracking-wider w-[110px]">DISRUPTED HRS</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[140px]">CLAIM</th>
                  <th className="w-[120px]"></th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((row: any) => {
                  const claimed = row.rainDelayClaimed;
                  const approved = row.rainDelayApproved;
                  return (
                    <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer" onClick={() => setDrawerId(row.id)}>
                      <td className="px-3 py-2 font-bold">{row.logDate}</td>
                      <td className="px-3 py-2 text-center">{condEmoji(row.morning)}</td>
                      <td className="px-3 py-2 text-center">{condEmoji(row.afternoon)}</td>
                      <td className="px-3 py-2 text-center">{condEmoji(row.evening)}</td>
                      <td className="px-3 py-2 text-right">{row.rainfallMm == null ? '—' : Number(row.rainfallMm).toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">{Number(row.workDisruptedHours).toFixed(1)}</td>
                      <td className="px-3 py-2">
                        {!claimed ? <span className="text-neutral-400">—</span>
                          : approved
                            ? <span className="inline-block px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider bg-green-600 text-white">APPROVED</span>
                            : <span className="inline-block px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider bg-amber-500 text-white">PENDING</span>}
                      </td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button onClick={e => { e.stopPropagation(); setDrawerId(row.id); }} className="text-[var(--color-brand)] underline">edit</button>
                        {isAdmin && claimed && !approved && (
                          <button
                            onClick={e => { e.stopPropagation(); approve.mutate({ id: row.id }); }}
                            disabled={approve.isPending}
                            className="text-green-700 underline disabled:opacity-50"
                          >approve</button>
                        )}
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
        <WeatherModal
          title="LOG WEATHER"
          projectId={id}
          initial={null}
          onClose={() => setShowNew(false)}
          onSubmit={(v) => upsert.mutate(v as any)}
          pending={upsert.isPending}
        />
      )}
      {drawerId && (
        <EditDrawer
          id={drawerId}
          projectId={id}
          isAdmin={isAdmin}
          onClose={() => setDrawerId(null)}
          onSaved={invalidate}
          onDelete={() => { del.mutate({ id: drawerId }); setDrawerId(null); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="bg-white border-2 border-[var(--color-ink)] p-5">
      <div className="font-mono text-[10px] tracking-wider text-neutral-500 font-bold">{label}</div>
      <div className={`font-display text-5xl font-bold mt-2 ${tone ?? ''}`}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}

function WeatherModal({ title, projectId, initial, onClose, onSubmit, pending }: {
  title: string;
  projectId: string;
  initial: any | null;
  onClose: () => void;
  onSubmit: (v: any) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState({
    logDate:             initial?.logDate ?? todayISO(),
    morning:             (initial?.morning ?? '') as Condition | '',
    afternoon:           (initial?.afternoon ?? '') as Condition | '',
    evening:             (initial?.evening ?? '') as Condition | '',
    rainfallMm:          initial?.rainfallMm != null ? String(initial.rainfallMm) : '',
    tempMinC:            initial?.tempMinC != null ? String(initial.tempMinC) : '',
    tempMaxC:            initial?.tempMaxC != null ? String(initial.tempMaxC) : '',
    windKmh:             initial?.windKmh != null ? String(initial.windKmh) : '',
    workDisruptedHours:  initial?.workDisruptedHours != null ? String(initial.workDisruptedHours) : '0',
    rainDelayClaimed:    !!initial?.rainDelayClaimed,
    notes:               initial?.notes ?? '',
  });

  const parseOpt = (s: string) => s.trim() === '' ? null : Number(s);

  const submit = () => {
    onSubmit({
      projectId,
      logDate: form.logDate,
      morning: form.morning || null,
      afternoon: form.afternoon || null,
      evening: form.evening || null,
      rainfallMm: parseOpt(form.rainfallMm),
      tempMinC: parseOpt(form.tempMinC),
      tempMaxC: parseOpt(form.tempMaxC),
      windKmh: parseOpt(form.windKmh),
      workDisruptedHours: Number(form.workDisruptedHours || 0),
      rainDelayClaimed: form.rainDelayClaimed,
      notes: form.notes || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border-2 border-[var(--color-ink)] max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-[var(--color-ink)] text-white px-4 py-3 flex items-center justify-between">
          <h2 className="font-mono text-xs tracking-wider font-bold">{title}</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 font-mono text-xs">
          <Field label="DATE">
            <input type="date" value={form.logDate} onChange={e => setForm({ ...form, logDate: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="MORNING">
              <CondSelect value={form.morning} onChange={v => setForm({ ...form, morning: v })} />
            </Field>
            <Field label="AFTERNOON">
              <CondSelect value={form.afternoon} onChange={v => setForm({ ...form, afternoon: v })} />
            </Field>
            <Field label="EVENING">
              <CondSelect value={form.evening} onChange={v => setForm({ ...form, evening: v })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="RAINFALL (mm)">
              <input type="number" step="0.1" min="0" value={form.rainfallMm} onChange={e => setForm({ ...form, rainfallMm: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
            <Field label="WIND (km/h)">
              <input type="number" step="0.1" min="0" value={form.windKmh} onChange={e => setForm({ ...form, windKmh: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="TEMP MIN (°C)">
              <input type="number" step="0.1" value={form.tempMinC} onChange={e => setForm({ ...form, tempMinC: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
            <Field label="TEMP MAX (°C)">
              <input type="number" step="0.1" value={form.tempMaxC} onChange={e => setForm({ ...form, tempMaxC: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
          </div>

          <Field label="WORK DISRUPTED HOURS">
            <input type="number" step="0.1" min="0" value={form.workDisruptedHours} onChange={e => setForm({ ...form, workDisruptedHours: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.rainDelayClaimed} onChange={e => setForm({ ...form, rainDelayClaimed: e.target.checked })} />
            <span className="font-bold tracking-wider text-[10px]">CLAIM RAIN DELAY (for time extension)</span>
          </label>

          <Field label="NOTES">
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="e.g. Pengecoran kolom dihentikan jam 10:00 — banjir lokal pit 2." className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
        </div>
        <div className="border-t-2 border-[var(--color-ink)] p-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-[var(--color-ink)] font-mono text-xs">CANCEL</button>
          <button
            onClick={submit}
            disabled={pending || !form.logDate}
            className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono text-xs font-bold disabled:opacity-50"
          >
            {pending ? 'SAVING…' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] tracking-wider text-neutral-500 mb-1">{label}</div>
      {children}
    </label>
  );
}

function CondSelect({ value, onChange }: { value: Condition | ''; onChange: (v: Condition | '') => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as Condition | '')} className="w-full border border-[var(--color-ink)] px-2 py-1">
      <option value="">— pilih —</option>
      {CONDITIONS.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
    </select>
  );
}

function EditDrawer({ id, projectId, isAdmin, onClose, onSaved, onDelete }: {
  id: string;
  projectId: string;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete: () => void;
}) {
  // Pull the row from the cached list (avoids a second fetch).
  const list = trpc.weather.list.useQuery({ projectId });
  const row = list.data?.find((r: any) => r.id === id) ?? null;

  const upsert = trpc.weather.upsert.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
  });
  const approve = trpc.weather.approveRainDelay.useMutation({ onSuccess: onSaved });

  // Form state — initialized from row once, then user-controlled.
  const [form, setForm] = useState(() => fromRow(row));

  // If the row hot-loads after first render, hydrate once.
  useEffect(() => { if (row) setForm(fromRow(row)); }, [row?.id]);

  if (!row) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
        <div className="bg-white w-full max-w-xl h-full p-6 font-mono text-xs text-neutral-500" onClick={e => e.stopPropagation()}>Loading…</div>
      </div>
    );
  }

  const parseOpt = (s: string) => s.trim() === '' ? null : Number(s);
  const submit = () => {
    upsert.mutate({
      projectId,
      logDate: form.logDate,
      morning: (form.morning || null) as any,
      afternoon: (form.afternoon || null) as any,
      evening: (form.evening || null) as any,
      rainfallMm: parseOpt(form.rainfallMm),
      tempMinC: parseOpt(form.tempMinC),
      tempMaxC: parseOpt(form.tempMaxC),
      windKmh: parseOpt(form.windKmh),
      workDisruptedHours: Number(form.workDisruptedHours || 0),
      rainDelayClaimed: form.rainDelayClaimed,
      notes: form.notes || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white border-l-2 border-[var(--color-ink)] w-full max-w-2xl h-full overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-[var(--color-ink)] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <h2 className="font-mono text-xs tracking-wider font-bold">EDIT WEATHER · {row.logDate}</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
            <div className="flex gap-2 items-center text-xl">
              {condEmoji(row.morning)}{condEmoji(row.afternoon)}{condEmoji(row.evening)}
            </div>
            {row.rainDelayClaimed && (
              row.rainDelayApproved
                ? <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold tracking-wider bg-green-600 text-white"><Check size={10} /> APPROVED</span>
                : isAdmin
                  ? <button disabled={approve.isPending} onClick={() => approve.mutate({ id })} className="bg-green-700 text-white px-3 py-1 font-mono text-[10px] font-bold tracking-wider disabled:opacity-50">APPROVE RAIN DELAY</button>
                  : <span className="inline-block px-2 py-1 text-[10px] font-mono font-bold tracking-wider bg-amber-500 text-white">PENDING APPROVAL</span>
            )}
          </div>

          <Field label="DATE">
            <input type="date" value={form.logDate} onChange={e => setForm({ ...form, logDate: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="MORNING"><CondSelect value={form.morning} onChange={v => setForm({ ...form, morning: v })} /></Field>
            <Field label="AFTERNOON"><CondSelect value={form.afternoon} onChange={v => setForm({ ...form, afternoon: v })} /></Field>
            <Field label="EVENING"><CondSelect value={form.evening} onChange={v => setForm({ ...form, evening: v })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="RAINFALL (mm)"><input type="number" step="0.1" min="0" value={form.rainfallMm} onChange={e => setForm({ ...form, rainfallMm: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" /></Field>
            <Field label="WIND (km/h)"><input type="number" step="0.1" min="0" value={form.windKmh} onChange={e => setForm({ ...form, windKmh: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="TEMP MIN (°C)"><input type="number" step="0.1" value={form.tempMinC} onChange={e => setForm({ ...form, tempMinC: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" /></Field>
            <Field label="TEMP MAX (°C)"><input type="number" step="0.1" value={form.tempMaxC} onChange={e => setForm({ ...form, tempMaxC: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" /></Field>
          </div>
          <Field label="WORK DISRUPTED HOURS">
            <input type="number" step="0.1" min="0" value={form.workDisruptedHours} onChange={e => setForm({ ...form, workDisruptedHours: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.rainDelayClaimed} onChange={e => setForm({ ...form, rainDelayClaimed: e.target.checked })} />
            <span className="font-bold tracking-wider text-[10px]">CLAIM RAIN DELAY</span>
          </label>
          <Field label="NOTES">
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
        </div>
        <div className="border-t-2 border-[var(--color-ink)] p-3 flex justify-between gap-2 sticky bottom-0 bg-white">
          <button onClick={() => { if (confirm('Delete this weather log?')) onDelete(); }} className="px-4 py-2 border border-red-600 text-red-600 font-mono text-xs">DELETE</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-[var(--color-ink)] font-mono text-xs">CLOSE</button>
            <button onClick={submit} disabled={upsert.isPending} className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono text-xs font-bold disabled:opacity-50">
              {upsert.isPending ? 'SAVING…' : 'SAVE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Build form-state shape from a DB row (numeric → string). */
function fromRow(row: any) {
  return {
    logDate:             row?.logDate ?? todayISO(),
    morning:             (row?.morning ?? '') as Condition | '',
    afternoon:           (row?.afternoon ?? '') as Condition | '',
    evening:             (row?.evening ?? '') as Condition | '',
    rainfallMm:          row?.rainfallMm != null ? String(row.rainfallMm) : '',
    tempMinC:            row?.tempMinC != null ? String(row.tempMinC) : '',
    tempMaxC:            row?.tempMaxC != null ? String(row.tempMaxC) : '',
    windKmh:             row?.windKmh != null ? String(row.windKmh) : '',
    workDisruptedHours:  row?.workDisruptedHours != null ? String(row.workDisruptedHours) : '0',
    rainDelayClaimed:    !!row?.rainDelayClaimed,
    notes:               row?.notes ?? '',
  };
}

