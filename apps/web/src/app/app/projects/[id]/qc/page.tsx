'use client';
/**
 * Quality Control test results — per-project QA register.
 *
 * KPI cards: total tests · pass rate (color-coded ≥90 green / 70-89 amber / <70 red)
 *            · pending count · retest-required count.
 * Filter bar: test_type (distinct values from data) · result · date range.
 * Table with click-row drawer for view/edit + "Trigger Retest" workflow that
 * flips original to retest_required and opens NEW TEST modal pre-filled.
 */
import { use, useMemo, useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import Link from 'next/link';
import { FlaskConical, Plus, X, ArrowLeft, RefreshCw } from 'lucide-react';

const RESULTS = [
  { key: 'pass', label: 'PASS', tone: 'bg-green-600 text-white' },
  { key: 'fail', label: 'FAIL', tone: 'bg-red-600 text-white' },
  { key: 'pending', label: 'PENDING', tone: 'bg-neutral-400 text-white' },
  { key: 'retest_required', label: 'RETEST', tone: 'bg-amber-500 text-white' },
] as const;

type ResultKey = typeof RESULTS[number]['key'];

const COMMON_TEST_TYPES = [
  'Sand Cone Density',
  'Slump',
  'Concrete Cube 7d',
  'Concrete Cube 28d',
  'CBR',
  'Asphalt Extraction',
  'Gradation',
  'Proctor',
  'Marshall',
];

function resultBadge(r: string) {
  const m = RESULTS.find(x => x.key === r);
  return m ? <span className={`inline-block px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider ${m.tone}`}>{m.label}</span> : r;
}

function passRateColor(rate: number | null | undefined) {
  if (rate == null) return 'text-neutral-400';
  if (rate >= 90) return 'text-green-700';
  if (rate >= 70) return 'text-amber-600';
  return 'text-red-600';
}

export default function QcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = trpc.project.get.useQuery({ id });
  const summary = trpc.qc.summary.useQuery({ projectId: id });

  const [filterType, setFilterType] = useState<string>('');
  const [filterResult, setFilterResult] = useState<ResultKey | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const list = trpc.qc.list.useQuery({
    projectId: id,
    testType: filterType || undefined,
    result: filterResult || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const utils = trpc.useUtils();
  const [showNew, setShowNew] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  // When triggering a retest: original row pre-fills the create form
  const [retestSeed, setRetestSeed] = useState<any | null>(null);

  const create = trpc.qc.create.useMutation({
    onSuccess: () => {
      utils.qc.list.invalidate({ projectId: id });
      utils.qc.summary.invalidate({ projectId: id });
      setShowNew(false);
      setRetestSeed(null);
    },
  });

  // Distinct test_type values from current data + common defaults
  const typeOptions = useMemo(() => {
    const fromData = list.data?.map((r: any) => r.testType ?? r.test_type).filter(Boolean) ?? [];
    return Array.from(new Set([...COMMON_TEST_TYPES, ...fromData])).sort();
  }, [list.data]);

  const total = summary.data?.total ?? 0;
  const passRate = summary.data?.passRate ?? null;
  const pendingCount = summary.data?.pendingCount ?? 0;
  const retestCount = summary.data?.retestCount ?? 0;

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
              <FlaskConical size={12} />
              {project.data?.code} · QUALITY CONTROL · {total} TESTS
            </div>
            <h1 className="font-display text-xl font-bold">{project.data?.name}</h1>
          </div>
        </div>
        <button
          onClick={() => { setRetestSeed(null); setShowNew(true); }}
          className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono text-xs font-bold tracking-wider hover:opacity-90 inline-flex items-center gap-2"
        >
          <Plus size={14} /> NEW TEST
        </button>
      </header>

      {/* KPI cards */}
      <section className="px-4 md:px-6 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-[var(--color-ink)] p-5">
          <div className="font-mono text-[10px] tracking-wider text-neutral-500 font-bold">TOTAL TESTS</div>
          <div className="font-display text-4xl md:text-6xl font-bold mt-2">{total}</div>
          <div className="font-mono text-[10px] text-neutral-500 mt-1">all-time recorded</div>
        </div>
        <div className="bg-white border-2 border-[var(--color-ink)] p-5">
          <div className="font-mono text-[10px] tracking-wider text-neutral-500 font-bold">PASS RATE</div>
          <div className={`font-display text-4xl md:text-6xl font-bold mt-2 ${passRateColor(passRate)}`}>
            {passRate == null ? '—' : `${passRate}%`}
          </div>
          <div className="font-mono text-[10px] text-neutral-500 mt-1">
            pass ÷ (pass + fail) {passRate != null && passRate >= 90 ? '· on target' : passRate != null ? '· below 90%' : ''}
          </div>
        </div>
        <div className="bg-white border-2 border-[var(--color-ink)] p-5">
          <div className="font-mono text-[10px] tracking-wider text-neutral-500 font-bold">PENDING</div>
          <div className={`font-display text-4xl md:text-6xl font-bold mt-2 ${pendingCount > 0 ? 'text-neutral-700' : 'text-neutral-400'}`}>{pendingCount}</div>
          <div className="font-mono text-[10px] text-neutral-500 mt-1">awaiting result</div>
        </div>
        <div className="bg-white border-2 border-[var(--color-ink)] p-5">
          <div className="font-mono text-[10px] tracking-wider text-neutral-500 font-bold">RETEST REQUIRED</div>
          <div className={`font-display text-4xl md:text-6xl font-bold mt-2 ${retestCount > 0 ? 'text-amber-600' : 'text-neutral-400'}`}>{retestCount}</div>
          <div className="font-mono text-[10px] text-neutral-500 mt-1">re-sample needed</div>
        </div>
      </section>

      {/* Filter bar */}
      <section className="px-4 md:px-6 pb-4">
        <div className="bg-white border-2 border-[var(--color-ink)] p-3 flex flex-wrap gap-3 items-end font-mono text-xs">
          <label className="flex flex-col">
            <span className="text-[10px] font-bold tracking-wider text-neutral-600 mb-1">TEST TYPE</span>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-[var(--color-ink)] px-2 py-1 min-w-[180px]">
              <option value="">— all —</option>
              {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col">
            <span className="text-[10px] font-bold tracking-wider text-neutral-600 mb-1">RESULT</span>
            <select value={filterResult} onChange={e => setFilterResult(e.target.value as ResultKey | '')} className="border border-[var(--color-ink)] px-2 py-1 min-w-[140px]">
              <option value="">— all —</option>
              {RESULTS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col">
            <span className="text-[10px] font-bold tracking-wider text-neutral-600 mb-1">FROM</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-[var(--color-ink)] px-2 py-1" />
          </label>
          <label className="flex flex-col">
            <span className="text-[10px] font-bold tracking-wider text-neutral-600 mb-1">TO</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-[var(--color-ink)] px-2 py-1" />
          </label>
          {(filterType || filterResult || from || to) && (
            <button
              onClick={() => { setFilterType(''); setFilterResult(''); setFrom(''); setTo(''); }}
              className="border border-[var(--color-ink)] px-3 py-1 hover:bg-neutral-100"
            >CLEAR</button>
          )}
        </div>
      </section>

      {/* Table */}
      <section className="px-4 md:px-6 pb-10">
        <div className="bg-white border-2 border-[var(--color-ink)] overflow-x-auto">
          {!list.data?.length ? (
            <div className="p-16 text-center">
              <FlaskConical size={48} className="mx-auto text-[var(--color-brand)]" />
              <h3 className="font-display text-xl font-bold mt-4">No QC tests recorded</h3>
              <p className="font-mono text-xs text-neutral-500 mt-2">Hit + NEW TEST to log a sand cone, slump, concrete cube or other lab/field test.</p>
            </div>
          ) : (
            <table className="w-full min-w-[1000px] font-mono text-xs">
              <thead className="bg-[var(--color-ink)] text-white">
                <tr>
                  <th className="text-left px-3 py-2 tracking-wider w-[100px]">DATE</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[160px]">TEST TYPE</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[120px]">STATION</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[120px]">SAMPLE</th>
                  <th className="text-left px-3 py-2 tracking-wider">SPEC</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[110px]">ACTUAL</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[100px]">RESULT</th>
                  <th className="text-left px-3 py-2 tracking-wider w-[120px]">INSPECTOR</th>
                  <th className="w-[120px]"></th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((it: any) => {
                  const actual = it.actualValue != null
                    ? `${it.actualValue}${it.unit ? ' ' + it.unit : ''}`
                    : (it.actualText ?? '—');
                  return (
                    <tr key={it.id} className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer" onClick={() => setDrawerId(it.id)}>
                      <td className="px-3 py-2">{it.testDate}</td>
                      <td className="px-3 py-2 font-bold">{it.testType}</td>
                      <td className="px-3 py-2">{it.station ?? '—'}</td>
                      <td className="px-3 py-2">{it.sampleCode ?? '—'}</td>
                      <td className="px-3 py-2 text-[11px] text-neutral-700">{it.specTarget ?? '—'}</td>
                      <td className="px-3 py-2 font-bold">{actual}</td>
                      <td className="px-3 py-2">{resultBadge(it.result)}</td>
                      <td className="px-3 py-2 text-[11px]">{it.testedBy ?? '—'}</td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button onClick={e => { e.stopPropagation(); setDrawerId(it.id); }} className="text-[var(--color-brand)] underline">view</button>
                        {it.result === 'fail' && (
                          <button onClick={e => { e.stopPropagation(); setDrawerId(it.id); }} className="text-amber-600 underline">retest</button>
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
        <NewTestModal
          projectId={id}
          seed={retestSeed}
          onClose={() => { setShowNew(false); setRetestSeed(null); }}
          onSubmit={(v) => create.mutate(v)}
          pending={create.isPending}
        />
      )}
      {drawerId && (
        <TestDrawer
          id={drawerId}
          onClose={() => setDrawerId(null)}
          onRetest={(original) => {
            setRetestSeed(original);
            setDrawerId(null);
            setShowNew(true);
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────────── NEW / RETEST MODAL ──────────────────────────── */

function NewTestModal({ projectId, seed, onClose, onSubmit, pending }: {
  projectId: string;
  seed: any | null;
  onClose: () => void;
  onSubmit: (v: any) => void;
  pending: boolean;
}) {
  // When seeded from a failed test → pre-fill key fields, mark retest_of_id
  const [form, setForm] = useState({
    testDate: new Date().toISOString().slice(0, 10),
    testType: seed?.testType ?? '',
    station: seed?.station ?? '',
    sampleCode: '',  // new sample for the retest
    specTarget: seed?.specTarget ?? '',
    specMin: seed?.specMin != null ? String(seed.specMin) : '',
    specMax: seed?.specMax != null ? String(seed.specMax) : '',
    actualValue: '',
    unit: seed?.unit ?? '',
    result: 'pending' as ResultKey,
    testedBy: '',
    notes: seed ? `Retest of sample ${seed.sampleCode ?? seed.id.slice(0, 8)} (${seed.testDate})` : '',
  });

  const submit = () => {
    onSubmit({
      projectId,
      testDate: form.testDate,
      testType: form.testType,
      station: form.station || null,
      sampleCode: form.sampleCode || null,
      specTarget: form.specTarget || null,
      specMin: form.specMin ? Number(form.specMin) : null,
      specMax: form.specMax ? Number(form.specMax) : null,
      actualValue: form.actualValue ? Number(form.actualValue) : null,
      unit: form.unit || null,
      result: form.result,
      testedBy: form.testedBy || null,
      notes: form.notes || null,
      retestOfId: seed?.id ?? null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border-2 border-[var(--color-ink)] max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-[var(--color-ink)] text-white px-4 py-3 flex items-center justify-between">
          <h2 className="font-mono text-xs tracking-wider font-bold">
            {seed ? 'NEW RETEST' : 'NEW QC TEST'}
          </h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {seed && (
          <div className="bg-amber-50 border-b-2 border-amber-500 px-4 py-2 font-mono text-[11px] flex items-center gap-2">
            <RefreshCw size={12} className="text-amber-700" />
            <span>RETEST of <b>{seed.sampleCode ?? seed.id?.slice(0, 8)}</b> ({seed.testDate}) — original marked retest_required.</span>
          </div>
        )}
        <div className="p-5 space-y-3 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="DATE">
              <input type="date" value={form.testDate} onChange={e => setForm({ ...form, testDate: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
            <Field label="TEST TYPE">
              <input list="qc-types" value={form.testType} onChange={e => setForm({ ...form, testType: e.target.value })} placeholder="e.g. Sand Cone Density" className="w-full border border-[var(--color-ink)] px-2 py-1" />
              <datalist id="qc-types">
                {COMMON_TEST_TYPES.map(t => <option key={t} value={t} />)}
              </datalist>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="STATION">
              <input value={form.station} onChange={e => setForm({ ...form, station: e.target.value })} placeholder="e.g. STA 0+200 RT" className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
            <Field label="SAMPLE CODE">
              <input value={form.sampleCode} onChange={e => setForm({ ...form, sampleCode: e.target.value })} placeholder="e.g. SC-2026-014" className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
          </div>
          <Field label="SPEC TARGET">
            <input value={form.specTarget} onChange={e => setForm({ ...form, specTarget: e.target.value })} placeholder="e.g. MDD 95% or Slump 12±2 cm" className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="SPEC MIN">
              <input type="number" step="any" value={form.specMin} onChange={e => setForm({ ...form, specMin: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
            <Field label="SPEC MAX">
              <input type="number" step="any" value={form.specMax} onChange={e => setForm({ ...form, specMax: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
            <Field label="UNIT">
              <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="%, cm, mpa" className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ACTUAL VALUE">
              <input type="number" step="any" value={form.actualValue} onChange={e => setForm({ ...form, actualValue: e.target.value })} className="w-full border border-[var(--color-ink)] px-2 py-1" />
            </Field>
            <Field label="RESULT">
              <select value={form.result} onChange={e => setForm({ ...form, result: e.target.value as ResultKey })} className="w-full border border-[var(--color-ink)] px-2 py-1">
                {RESULTS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="TESTED BY">
            <input value={form.testedBy} onChange={e => setForm({ ...form, testedBy: e.target.value })} placeholder="lab technician / inspector name" className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
          <Field label="NOTES">
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-[var(--color-ink)] px-2 py-1" />
          </Field>
        </div>
        <div className="border-t-2 border-[var(--color-ink)] p-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-[var(--color-ink)] font-mono text-xs">CANCEL</button>
          <button
            onClick={submit}
            disabled={pending || !form.testType || !form.testDate}
            className="bg-[var(--color-brand)] text-white px-4 py-2 font-mono text-xs font-bold disabled:opacity-50"
          >
            {pending ? 'SAVING…' : 'CREATE'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── DETAIL DRAWER ───────────────────────────── */

function TestDrawer({ id, onClose, onRetest }: {
  id: string;
  onClose: () => void;
  onRetest: (original: any) => void;
}) {
  const detail = trpc.qc.get.useQuery({ id });
  const utils = trpc.useUtils();
  const update = trpc.qc.update.useMutation({
    onSuccess: () => {
      utils.qc.get.invalidate({ id });
      utils.qc.list.invalidate();
      utils.qc.summary.invalidate();
    },
  });
  const requestRetest = trpc.qc.requestRetest.useMutation({
    onSuccess: (orig) => {
      utils.qc.get.invalidate({ id });
      utils.qc.list.invalidate();
      utils.qc.summary.invalidate();
      if (!orig) return;
      // Normalize snake_case ↔ camelCase from DB to seed the new test modal
      onRetest({
        id: orig.id,
        testDate: (orig as any).test_date ?? (orig as any).testDate,
        testType: (orig as any).test_type ?? (orig as any).testType,
        station: orig.station,
        sampleCode: (orig as any).sample_code ?? (orig as any).sampleCode,
        specTarget: (orig as any).spec_target ?? (orig as any).specTarget,
        specMin: (orig as any).spec_min ?? (orig as any).specMin,
        specMax: (orig as any).spec_max ?? (orig as any).specMax,
        unit: orig.unit,
      });
    },
  });

  const [editResult, setEditResult] = useState<ResultKey | ''>('');
  const [editActual, setEditActual] = useState('');
  const [retestNotes, setRetestNotes] = useState('');

  const it: any = detail.data;

  // Normalize raw SQL snake_case → camelCase
  const v = it ? {
    testDate: it.test_date ?? it.testDate,
    testType: it.test_type ?? it.testType,
    station: it.station,
    sampleCode: it.sample_code ?? it.sampleCode,
    specTarget: it.spec_target ?? it.specTarget,
    specMin: it.spec_min ?? it.specMin,
    specMax: it.spec_max ?? it.specMax,
    actualValue: it.actual_value ?? it.actualValue,
    actualText: it.actual_text ?? it.actualText,
    unit: it.unit,
    result: it.result,
    notes: it.notes,
    testedBy: it.tested_by ?? it.testedBy,
    retestOfId: it.retest_of_id ?? it.retestOfId,
  } : null;

  const isRetest = !!v?.retestOfId;
  const canRetest = v && (v.result === 'fail' || v.result === 'pending');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white border-l-2 border-[var(--color-ink)] w-full max-w-xl h-full overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-[var(--color-ink)] text-white px-4 py-3 flex items-center justify-between sticky top-0">
          <h2 className="font-mono text-xs tracking-wider font-bold">QC TEST DETAIL</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        {!v ? (
          <div className="p-6 font-mono text-xs text-neutral-500">Loading…</div>
        ) : (
          <div className="p-5 space-y-4 font-mono text-xs">
            <div className="flex gap-2 items-center flex-wrap">
              {resultBadge(v.result)}
              {isRetest && <span className="inline-block px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider bg-amber-500 text-white">RETEST</span>}
            </div>
            <Detail label="DATE">{v.testDate}</Detail>
            <Detail label="TEST TYPE">{v.testType}</Detail>
            {v.station && <Detail label="STATION">{v.station}</Detail>}
            {v.sampleCode && <Detail label="SAMPLE">{v.sampleCode}</Detail>}
            {v.specTarget && <Detail label="SPEC TARGET">{v.specTarget}</Detail>}
            {(v.specMin != null || v.specMax != null) && (
              <Detail label="SPEC RANGE">
                {v.specMin ?? '—'} … {v.specMax ?? '—'} {v.unit ?? ''}
              </Detail>
            )}
            <Detail label="ACTUAL">
              {v.actualValue != null
                ? <span className="font-bold text-base">{v.actualValue} {v.unit ?? ''}</span>
                : (v.actualText ?? '—')}
            </Detail>
            {v.testedBy && <Detail label="TESTED BY">{v.testedBy}</Detail>}
            {v.notes && <Detail label="NOTES"><span className="whitespace-pre-wrap">{v.notes}</span></Detail>}

            {/* Update result inline */}
            <div className="border-t-2 border-[var(--color-ink)] pt-4">
              <div className="font-bold tracking-wider mb-2">UPDATE RESULT</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={editResult} onChange={e => setEditResult(e.target.value as ResultKey | '')} className="border border-[var(--color-ink)] px-2 py-1">
                  <option value="">— change to —</option>
                  {RESULTS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
                <input
                  type="number"
                  step="any"
                  placeholder="actual value (optional)"
                  value={editActual}
                  onChange={e => setEditActual(e.target.value)}
                  className="border border-[var(--color-ink)] px-2 py-1"
                />
              </div>
              <button
                disabled={!editResult || update.isPending}
                onClick={() => editResult && update.mutate({
                  id,
                  result: editResult as ResultKey,
                  ...(editActual ? { actualValue: Number(editActual) } : {}),
                })}
                className="mt-2 bg-[var(--color-ink)] text-white px-3 py-1 font-bold disabled:opacity-50"
              >SAVE</button>
            </div>

            {/* Trigger retest */}
            {canRetest && (
              <div className="border-t-2 border-[var(--color-ink)] pt-4">
                <div className="font-bold tracking-wider mb-2 flex items-center gap-2">
                  <RefreshCw size={12} /> TRIGGER RETEST
                </div>
                <p className="text-[11px] text-neutral-600 mb-2">
                  Marks this test as <b>retest_required</b> and opens a new test form
                  pre-filled with the same spec — link is preserved via retest_of_id.
                </p>
                <Field label="RETEST NOTES (optional)">
                  <textarea value={retestNotes} onChange={e => setRetestNotes(e.target.value)} rows={2} className="w-full border border-[var(--color-ink)] px-2 py-1" />
                </Field>
                {requestRetest.error && <div className="text-red-600 text-[10px] mt-1">{requestRetest.error.message}</div>}
                <button
                  disabled={requestRetest.isPending}
                  onClick={() => requestRetest.mutate({ id, notes: retestNotes || undefined })}
                  className="mt-2 w-full bg-amber-600 text-white px-3 py-2 font-bold tracking-wider disabled:opacity-50"
                >
                  {requestRetest.isPending ? 'PROCESSING…' : 'REQUEST RETEST'}
                </button>
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
