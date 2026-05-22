'use client';
import { use, useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { fmtIDR } from '@/lib/utils';

export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const gantt = trpc.schedule.gantt.useQuery({ projectId: id }, { retry: false });
  const curve = trpc.schedule.sCurve.useQuery({ projectId: id }, { retry: false });
  const baselines = trpc.schedule.baselines.useQuery({ projectId: id }, { retry: false });
  const utils = trpc.useUtils();
  const rebase = trpc.schedule.rebaseline.useMutation({
    onSuccess: () => {
      utils.schedule.invalidate();
    },
  });
  const updateDates = trpc.schedule.updateDates.useMutation({
    onSuccess: () => {
      utils.schedule.gantt.invalidate({ projectId: id });
      utils.schedule.sCurve.invalidate({ projectId: id });
    },
  });
  const restoreBaseline = trpc.schedule.restoreBaseline.useMutation({
    onSuccess: () => utils.schedule.invalidate(),
  });
  const [baselineName, setBaselineName] = useState('');
  const [baselineNotes, setBaselineNotes] = useState('');

  if (gantt.error) return <div className="bg-red-100 border-2 border-red-600 p-6 font-mono text-red-700">{gantt.error.message}</div>;
  if (!gantt.data || !curve.data) return <div className="font-mono text-xs text-neutral-500 p-6">Loading…</div>;

  const proj = gantt.data.project;
  const scopes = gantt.data.scopes;

  return (
    <div className="space-y-8 p-6 bg-[var(--color-canvas)] min-h-screen">
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">SCHEDULE · {proj.code}</p>
        <h1 className="font-display text-4xl font-bold mt-1">{proj.name}</h1>
        <p className="font-mono text-xs text-neutral-600 mt-2">
          {proj.startDate ?? '—'} → {proj.finishDate ?? '—'}
          {proj.baselineSetAt && <> · baseline locked {new Date(proj.baselineSetAt).toLocaleDateString()}</>}
        </p>
      </div>

      {/* S-CURVE */}
      <section className="border-2 border-[var(--color-ink)] bg-white p-6">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-ink)] mb-4">S-CURVE — % cumulative progress</h2>
        <SCurve points={curve.data.points} totalValue={curve.data.totalValue} dataDate={curve.data.dataDate} />
        <div className="flex gap-6 mt-3 font-mono text-[10px]">
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-1 bg-blue-600"></span>PLANNED</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-1 bg-[var(--color-brand)]"></span>ACTUAL</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 h-1 bg-neutral-400 border border-dashed"></span>BASELINE</span>
          <span className="ml-auto">Total: {fmtIDR(curve.data.totalValue)}</span>
        </div>
      </section>

      {/* GANTT */}
      <section className="border-2 border-[var(--color-ink)] bg-white p-6">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-ink)] mb-4">GANTT — {scopes.length} scopes</h2>
        <Gantt
          scopes={scopes}
          projectStart={proj.startDate}
          projectFinish={proj.finishDate}
          dataDate={curve.data.dataDate}
          onUpdateDates={(boqItemId, plannedStart, plannedFinish) =>
            updateDates.mutate({ boqItemId, plannedStart, plannedFinish })
          }
          updating={updateDates.isPending}
        />
      </section>

      {/* REBASELINE */}
      <section className="border-2 border-[var(--color-ink)] bg-white p-6">
        <h2 className="font-mono text-xs tracking-wider text-[var(--color-ink)] mb-4">BASELINE</h2>
        <div className="space-y-3">
          <p className="font-mono text-xs text-neutral-700">
            Snapshot current <strong>planned dates</strong> as new baseline. Compare future drift against this lock.
          </p>
          <div className="flex gap-2">
            <input
              value={baselineName} onChange={e => setBaselineName(e.target.value)}
              placeholder="Baseline name (e.g. 'BL01 — Owner Approved 2026-05')"
              className="flex-1 border-2 border-[var(--color-ink)] px-3 py-2 font-mono text-xs"
            />
            <input
              value={baselineNotes} onChange={e => setBaselineNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="flex-1 border-2 border-[var(--color-ink)] px-3 py-2 font-mono text-xs"
            />
            <button
              disabled={!baselineName || rebase.isPending}
              onClick={() => {
                if (!confirm(`Lock new baseline "${baselineName}"? This overwrites existing baseline_start/finish for ${scopes.length} scopes.`)) return;
                rebase.mutate({ projectId: id, name: baselineName, notes: baselineNotes || undefined });
                setBaselineName(''); setBaselineNotes('');
              }}
              className="bg-[var(--color-brand)] hover:bg-[var(--color-ink)] text-white px-6 py-2 font-mono text-xs font-bold tracking-wider disabled:opacity-50"
            >
              REBASE
            </button>
          </div>
          {baselines.data && baselines.data.length > 0 && (
            <table className="w-full font-mono text-xs mt-4">
              <thead className="text-neutral-500"><tr>
                <th className="text-left py-1">NAME</th>
                <th className="text-left">NOTES</th>
                <th className="text-right">SET AT</th>
                <th className="text-right pl-3">ACTION</th>
              </tr></thead>
              <tbody>
                {baselines.data.map(b => (
                  <tr key={b.id} className="border-t border-neutral-200">
                    <td className="py-1 font-bold">{b.name}</td>
                    <td className="text-neutral-600">{b.notes ?? '—'}</td>
                    <td className="text-right text-neutral-500">{new Date(b.setAt).toLocaleString()}</td>
                    <td className="text-right pl-3">
                      <button
                        disabled={restoreBaseline.isPending}
                        onClick={() => {
                          if (!confirm(`Rollback planned dates to baseline "${b.name}"? Overwrites every scope's planned_start/finish from the snapshot.`)) return;
                          restoreBaseline.mutate({ baselineId: b.id });
                        }}
                        className="border-2 border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider disabled:opacity-50"
                      >
                        ROLLBACK
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function SCurve({ points, totalValue: _tv, dataDate }: { points: any[]; totalValue: number; dataDate: string }) {
  const W = 1100, H = 280, padL = 50, padR = 20, padT = 20, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  if (points.length < 2) return <p className="font-mono text-xs text-neutral-500">Not enough data.</p>;
  const x = (i: number) => padL + (i / (points.length - 1)) * innerW;
  const y = (pct: number) => padT + innerH - (pct / 100) * innerH;
  const lineFor = (key: 'plannedPct' | 'actualPct' | 'baselinePct') => points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p[key])}`).join(' ');
  const actualEndIdx = points.findIndex(p => p.date > dataDate);
  const actualPoints = actualEndIdx > 0 ? points.slice(0, actualEndIdx) : points;
  const actualLine = actualPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.actualPct)}`).join(' ');
  const dataDateIdx = points.findIndex(p => p.date >= dataDate);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-72 border border-neutral-200">
      {/* Grid */}
      {[0, 25, 50, 75, 100].map(g => (
        <g key={g}>
          <line x1={padL} y1={y(g)} x2={W - padR} y2={y(g)} stroke="#eee" />
          <text x={padL - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="#999" fontFamily="monospace">{g}%</text>
        </g>
      ))}
      {/* Data date line */}
      {dataDateIdx > 0 && (
        <line x1={x(dataDateIdx)} y1={padT} x2={x(dataDateIdx)} y2={padT + innerH} stroke="#ff4d00" strokeDasharray="3,3" opacity="0.6" />
      )}
      {/* Baseline (grey dashed) */}
      <path d={lineFor('baselinePct')} fill="none" stroke="#999" strokeWidth="1.5" strokeDasharray="4,3" />
      {/* Planned (blue) */}
      <path d={lineFor('plannedPct')} fill="none" stroke="#2563eb" strokeWidth="2" />
      {/* Actual (orange, only up to data date) */}
      <path d={actualLine} fill="none" stroke="#ff4d00" strokeWidth="2.5" />
      {/* X labels */}
      {[0, Math.floor(points.length / 4), Math.floor(points.length / 2), Math.floor(3 * points.length / 4), points.length - 1].map(i => (
        <text key={i} x={x(i)} y={H - padB + 12} textAnchor="middle" fontSize="9" fill="#666" fontFamily="monospace">{points[i].date}</text>
      ))}
    </svg>
  );
}

function Gantt({
  scopes, projectStart, projectFinish, dataDate, onUpdateDates, updating,
}: {
  scopes: any[];
  projectStart: string | null;
  projectFinish: string | null;
  dataDate: string;
  onUpdateDates: (boqItemId: string, plannedStart: string | null, plannedFinish: string | null) => void;
  updating: boolean;
}) {
  if (scopes.length === 0) return <p className="font-mono text-xs text-neutral-500">No scopes yet.</p>;
  // Compute timeline bounds across all scopes
  const allDates = scopes.flatMap(s => [s.planned.start, s.planned.finish, s.actual.start, s.actual.finish, s.baseline.start, s.baseline.finish].filter(Boolean));
  if (projectStart) allDates.push(projectStart);
  if (projectFinish) allDates.push(projectFinish);
  if (allDates.length === 0) return <p className="font-mono text-xs text-neutral-500">No dates set.</p>;
  const minT = Math.min(...allDates.map(d => new Date(d).getTime()));
  const maxT = Math.max(...allDates.map(d => new Date(d).getTime()));
  const spanMs = Math.max(86400_000, maxT - minT);
  const W = 900;
  const xRel = (date: string | null) => date ? ((new Date(date).getTime() - minT) / spanMs) * W : 0;
  const dataDateX = ((new Date(dataDate).getTime() - minT) / spanMs) * W;
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs">
        <thead className="text-neutral-500 border-b border-neutral-200">
          <tr>
            <th className="text-left py-2 pr-3 w-32 sticky left-0 bg-white">SCOPE</th>
            <th className="text-right py-2 pr-3 w-20">%</th>
            <th className="text-left py-2 pr-3 w-64">PLANNED START / FINISH</th>
            <th className="text-left py-2" style={{ width: W }}>TIMELINE</th>
          </tr>
        </thead>
        <tbody>
          {scopes.map(s => (
            <tr key={s.id} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="py-1.5 pr-3 sticky left-0 bg-white">
                <strong className="text-[var(--color-brand)]">{s.kode}</strong>
                <div className="text-[10px] text-neutral-500 truncate max-w-[120px]">{s.description}</div>
              </td>
              <td className="py-1.5 pr-3 text-right">
                <strong>{s.pctComplete.toFixed(0)}%</strong>
              </td>
              <td className="py-1.5 pr-3">
                <DateEditCell
                  scopeId={s.id}
                  initialStart={s.planned.start}
                  initialFinish={s.planned.finish}
                  disabled={updating}
                  onCommit={onUpdateDates}
                />
              </td>
              <td className="py-1.5">
                <div className="relative h-6" style={{ width: W }}>
                  {/* Data date marker */}
                  <div className="absolute top-0 bottom-0 w-px bg-[var(--color-brand)] opacity-30" style={{ left: dataDateX }} />
                  {/* Baseline bar (grey thin) */}
                  {s.baseline.start && s.baseline.finish && (
                    <div className="absolute h-1 bg-neutral-400 top-0" style={{ left: xRel(s.baseline.start), width: Math.max(2, xRel(s.baseline.finish) - xRel(s.baseline.start)) }} />
                  )}
                  {/* Planned bar (blue thick) */}
                  {s.planned.start && s.planned.finish && (
                    <div className="absolute h-3 bg-blue-200 border-l-2 border-r-2 border-blue-600 top-2" style={{ left: xRel(s.planned.start), width: Math.max(2, xRel(s.planned.finish) - xRel(s.planned.start)) }} />
                  )}
                  {/* Actual bar (orange overlay) */}
                  {s.actual.start && (
                    <div className="absolute h-3 bg-[var(--color-brand)] top-2" style={{
                      left: xRel(s.actual.start),
                      width: Math.max(2, (s.actual.finish ? xRel(s.actual.finish) : dataDateX) - xRel(s.actual.start)),
                      opacity: 0.7,
                    }} />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 font-mono text-[10px] text-neutral-500 mt-3">
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-1 bg-neutral-400"></span>baseline</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 bg-blue-200 border border-blue-600"></span>planned</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 bg-[var(--color-brand)] opacity-70"></span>actual</span>
        <span className="flex items-center gap-1"><span className="inline-block w-px h-3 bg-[var(--color-brand)]"></span>data date {dataDate}</span>
      </div>
    </div>
  );
}

function DateEditCell({
  scopeId, initialStart, initialFinish, disabled, onCommit,
}: {
  scopeId: string;
  initialStart: string | null;
  initialFinish: string | null;
  disabled: boolean;
  onCommit: (boqItemId: string, plannedStart: string | null, plannedFinish: string | null) => void;
}) {
  const norm = (v: string | null) => (v ? String(v).slice(0, 10) : '');
  const [start, setStart] = useState<string>(norm(initialStart));
  const [finish, setFinish] = useState<string>(norm(initialFinish));
  const commit = (nextStart: string, nextFinish: string) => {
    const s = nextStart || null;
    const f = nextFinish || null;
    if (s === norm(initialStart) && f === norm(initialFinish)) return;
    onCommit(scopeId, s, f);
  };
  return (
    <div className="flex flex-col gap-1">
      <input
        type="date"
        value={start}
        disabled={disabled}
        onChange={e => setStart(e.target.value)}
        onBlur={() => commit(start, finish)}
        className="border border-neutral-300 px-1 py-0.5 font-mono text-[10px] w-32 focus:border-[var(--color-brand)] focus:outline-none disabled:opacity-50"
      />
      <input
        type="date"
        value={finish}
        disabled={disabled}
        onChange={e => setFinish(e.target.value)}
        onBlur={() => commit(start, finish)}
        className="border border-neutral-300 px-1 py-0.5 font-mono text-[10px] w-32 focus:border-[var(--color-brand)] focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}
