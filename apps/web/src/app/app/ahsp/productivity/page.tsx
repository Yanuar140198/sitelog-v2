'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fmtIDR, fmtNum } from '@/lib/utils';
import { ArrowLeft, Calculator, Search, X } from 'lucide-react';

type HistoryRow = {
  ts: number;
  ahspKode: string;
  ahspJenis: string;
  volume: number;
  satuan: string;
  totalCost: number;
};

const HISTORY_KEY = 'ahsp-productivity-history';
const HISTORY_LIMIT = 8;

function ProductivityInner() {
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedKode, setSelectedKode] = useState<string>('');
  const [selectedJenis, setSelectedJenis] = useState<string>('');
  const [selectedSatuan, setSelectedSatuan] = useState<string>('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [volumeInput, setVolumeInput] = useState<string>('100');
  const [computedVolume, setComputedVolume] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  // Load history once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const catalog = trpc.ahsp.catalog.useQuery();

  const suggestions = useMemo(() => {
    if (!catalog.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return catalog.data.slice(0, 20);
    return catalog.data
      .filter(it => it.kode.toLowerCase().includes(q) || it.jenis.toLowerCase().includes(q))
      .slice(0, 20);
  }, [catalog.data, search]);

  const estimate = trpc.ahsp.productivityEstimate.useQuery(
    {
      ahspItemId: selectedId,
      plannedVolume: computedVolume ?? 0,
    },
    { enabled: !!selectedId && computedVolume !== null && computedVolume > 0 },
  );

  function pickAhsp(it: { id: string; kode: string; jenis: string; satuan: string }) {
    setSelectedId(it.id);
    setSelectedKode(it.kode);
    setSelectedJenis(it.jenis);
    setSelectedSatuan(it.satuan);
    setSearch('');
    setOpen(false);
    setComputedVolume(null);
  }

  function clearSelection() {
    setSelectedId('');
    setSelectedKode('');
    setSelectedJenis('');
    setSelectedSatuan('');
    setComputedVolume(null);
  }

  function runCalculation() {
    const v = Number(volumeInput);
    if (!selectedId || !isFinite(v) || v <= 0) return;
    setComputedVolume(v);
  }

  // Save successful calculations to localStorage history
  useEffect(() => {
    if (!estimate.data || !selectedKode || computedVolume === null) return;
    const row: HistoryRow = {
      ts: Date.now(),
      ahspKode: selectedKode,
      ahspJenis: selectedJenis,
      volume: computedVolume,
      satuan: selectedSatuan,
      totalCost: estimate.data.totalCost,
    };
    setHistory(prev => {
      // Dedupe identical (kode, volume) entries; newest first; cap.
      const next = [row, ...prev.filter(p => !(p.ahspKode === row.ahspKode && p.volume === row.volume))]
        .slice(0, HISTORY_LIMIT);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [estimate.data, selectedKode, selectedJenis, selectedSatuan, computedVolume]);

  function clearHistory() {
    setHistory([]);
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
  }

  const r = estimate.data;

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <Link href="/app/ahsp" className="inline-flex items-center gap-2 font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)]">
        <ArrowLeft size={14} /> AHSP CATALOG
      </Link>

      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">TOOLS · PRODUCTIVITY</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Productivity Estimator</h1>
        <p className="font-mono text-xs text-neutral-500 mt-2">
          Plug a planned volume into an AHSP, get total cost, hours, days, and required resources.
        </p>
      </div>

      {/* Input row */}
      <div className="border-2 border-[var(--color-ink)] bg-white">
        <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">INPUT</div>
        <div className="p-4 space-y-4">
          {/* AHSP picker */}
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-neutral-500 mb-1">AHSP ITEM</div>
            {selectedId ? (
              <div className="inline-flex items-center gap-2 border-2 border-[var(--color-ink)] bg-white px-3 py-1.5 font-mono text-xs shadow-[3px_3px_0_var(--color-brand)]">
                <strong className="text-[var(--color-brand)]">{selectedKode}</strong>
                <span className="text-neutral-700 max-w-[480px] truncate">{selectedJenis}</span>
                <span className="text-neutral-500">· /{selectedSatuan}</span>
                <button onClick={clearSelection} className="text-red-600 hover:bg-red-50 p-0.5" aria-label="Clear">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="relative max-w-2xl">
                <div className="flex items-center gap-2">
                  <Search size={14} className="text-neutral-400" />
                  <Input
                    value={search}
                    onFocus={() => setOpen(true)}
                    onChange={e => { setSearch(e.target.value); setOpen(true); }}
                    placeholder="Search AHSP by kode or jenis…"
                  />
                </div>
                {open && (suggestions.length > 0 || catalog.isLoading) && (
                  <div className="absolute z-10 left-0 right-0 mt-1 border-2 border-[var(--color-ink)] bg-white max-h-72 overflow-auto shadow-[4px_4px_0_var(--color-brand)]">
                    {catalog.isLoading && (
                      <div className="px-3 py-2 font-mono text-xs text-neutral-500">Loading…</div>
                    )}
                    {suggestions.map(it => (
                      <button
                        key={it.id}
                        onClick={() => pickAhsp(it)}
                        className="w-full text-left px-3 py-2 font-mono text-xs hover:bg-neutral-100 border-b border-neutral-100"
                      >
                        <strong className="text-[var(--color-brand)]">{it.kode}</strong>
                        <span className="ml-2 text-neutral-700">{it.jenis}</span>
                        <span className="ml-2 text-neutral-400">· {it.satuan}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Volume + calculate */}
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-neutral-500 mb-1">PLANNED VOLUME</div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={volumeInput}
                  onChange={e => setVolumeInput(e.target.value)}
                  className="w-40"
                />
                <span className="font-mono text-xs text-neutral-500 min-w-[40px]">
                  {selectedSatuan || '—'}
                </span>
              </div>
            </div>
            <Button
              onClick={runCalculation}
              disabled={!selectedId || !volumeInput || Number(volumeInput) <= 0}
              className="gap-2"
            >
              <Calculator size={14} /> CALCULATE
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {!selectedId && (
        <div className="border-2 border-dashed border-neutral-300 p-12 text-center font-mono text-xs text-neutral-500">
          Pick an AHSP and a planned volume to calculate.
        </div>
      )}

      {selectedId && computedVolume === null && (
        <div className="border-2 border-dashed border-neutral-300 p-8 text-center font-mono text-xs text-neutral-500">
          Press CALCULATE to compute totals & resource requirements.
        </div>
      )}

      {estimate.isLoading && computedVolume !== null && (
        <div className="p-8 font-mono text-xs text-neutral-500">Calculating…</div>
      )}

      {r && computedVolume !== null && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="UNIT RATE" value={fmtIDR(r.unitRate)} sub={`per ${r.item.satuan}`} accent="ink" />
            <Kpi label="TOTAL COST" value={fmtIDR(r.totalCost)} sub={`${fmtNum(computedVolume, 2)} ${r.item.satuan}`} accent="brand" />
            <Kpi
              label="EST. HOURS"
              value={r.estimatedHours !== null ? fmtNum(r.estimatedHours, 1) : '—'}
              sub={r.productivityPerHour !== null ? `${fmtNum(r.productivityPerHour, 3)} ${r.item.satuan}/hr` : 'no Q1/Q2/Qt found'}
              accent={r.estimatedHours !== null ? 'ink' : 'muted'}
            />
            <Kpi
              label="EST. DAYS"
              value={r.estimatedDays !== null ? fmtNum(r.estimatedDays, 2) : '—'}
              sub={r.productivityPerDay !== null ? `${fmtNum(r.productivityPerDay, 3)} ${r.item.satuan}/day` : 'no Q1/Q2/Qt found'}
              accent={r.estimatedDays !== null ? 'ink' : 'muted'}
            />
          </div>

          {(r.productivityPerHour === null && r.productivityPerDay === null) && (
            <div className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 font-mono text-xs text-amber-800">
              No productivity value (Q1, Q2, or Qt) found in this AHSP's inputs or koefisien. Add one to see hours/days estimates.
            </div>
          )}

          {/* Required Resources */}
          <div className="border-2 border-[var(--color-ink)] bg-white">
            <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">
              REQUIRED RESOURCES (× {fmtNum(computedVolume, 2)} {r.item.satuan})
            </div>
            {r.requiredResources.length === 0 ? (
              <div className="p-6 font-mono text-xs text-neutral-500 text-center">
                AHSP has no resource lines.
              </div>
            ) : (
              <table className="w-full font-mono text-xs">
                <thead className="bg-neutral-100 border-b border-[var(--color-ink)]">
                  <tr>
                    <th className="text-left px-3 py-2 tracking-wider w-24">CAT.</th>
                    <th className="text-left px-3 py-2 tracking-wider w-28">KODE</th>
                    <th className="text-left px-3 py-2 tracking-wider">URAIAN</th>
                    <th className="text-right px-3 py-2 tracking-wider w-40">TOTAL QTY</th>
                    <th className="text-left px-3 py-2 tracking-wider w-20">SATUAN</th>
                  </tr>
                </thead>
                <tbody>
                  {r.requiredResources.map((rr, i) => (
                    <tr key={`${rr.kode}-${i}`} className="border-b border-neutral-100">
                      <td className="px-3 py-2">
                        <span className={
                          rr.category === 'tenaga' ? 'text-amber-600 uppercase'
                          : rr.category === 'bahan' ? 'text-emerald-600 uppercase'
                          : 'text-sky-600 uppercase'
                        }>{rr.category}</span>
                      </td>
                      <td className="px-3 py-2 font-bold text-[var(--color-brand)]">{rr.kode}</td>
                      <td className="px-3 py-2">{rr.uraian}</td>
                      <td className="px-3 py-2 text-right font-bold">{fmtNum(rr.totalQty, 4)}</td>
                      <td className="px-3 py-2 text-neutral-500">{rr.satuan ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="border-2 border-[var(--color-ink)] bg-white">
          <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em] flex items-center justify-between">
            <span>RECENT CALCULATIONS</span>
            <button onClick={clearHistory} className="text-neutral-300 hover:text-white">CLEAR</button>
          </div>
          <table className="w-full font-mono text-xs">
            <thead className="bg-neutral-100 border-b border-[var(--color-ink)]">
              <tr>
                <th className="text-left px-3 py-2 tracking-wider w-28">KODE</th>
                <th className="text-left px-3 py-2 tracking-wider">JENIS</th>
                <th className="text-right px-3 py-2 tracking-wider w-32">VOLUME</th>
                <th className="text-right px-3 py-2 tracking-wider w-40">TOTAL COST</th>
                <th className="text-left px-3 py-2 tracking-wider w-32">WHEN</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={`${h.ahspKode}-${h.volume}-${h.ts}`} className="border-b border-neutral-100">
                  <td className="px-3 py-2 font-bold text-[var(--color-brand)]">{h.ahspKode}</td>
                  <td className="px-3 py-2 max-w-[420px] truncate" title={h.ahspJenis}>{h.ahspJenis}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(h.volume, 2)} {h.satuan}</td>
                  <td className="px-3 py-2 text-right font-bold">{fmtIDR(h.totalCost)}</td>
                  <td className="px-3 py-2 text-neutral-500">{new Date(h.ts).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent: 'ink' | 'brand' | 'muted' }) {
  const color =
    accent === 'brand' ? 'text-[var(--color-brand)]'
    : accent === 'muted' ? 'text-neutral-400'
    : 'text-[var(--color-ink)]';
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white p-4 shadow-[4px_4px_0_var(--color-brand)]">
      <div className="font-mono text-[10px] tracking-[0.2em] text-neutral-500">{label}</div>
      <div className={`font-display text-2xl md:text-3xl font-bold mt-2 break-words ${color}`}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function AhspProductivityPage() {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs">Loading…</div>}>
      <ProductivityInner />
    </Suspense>
  );
}
