'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sparkles, FileText, Calculator, Copy, Check, Loader2 } from 'lucide-react';

type Tool = 'report' | 'rate';

export default function AiAssistantPage() {
  const [tool, setTool] = useState<Tool>('report');

  const status = trpc.ai.status.useQuery();
  const configured = status.data?.configured !== false;

  return (
    <div className="p-8 space-y-6">
      {/* HEADER */}
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">ASSISTANT</p>
        <div className="flex items-baseline gap-3 mt-1">
          <h1 className="font-display text-4xl font-bold tracking-tight">AI Assistant</h1>
          <Sparkles size={20} className="text-[var(--color-brand)]" />
        </div>
        <p className="font-mono text-xs text-neutral-500 mt-2">
          Claude-powered helpers for daily reports and rate explanations.
        </p>
      </div>

      {/* NOT CONFIGURED BANNER */}
      {status.data?.configured === false && (
        <div className="border-2 border-red-600 bg-red-50 p-4 font-mono text-xs text-red-700">
          AI belum dikonfigurasi di server (ANTHROPIC_API_KEY belum diset).
        </div>
      )}

      {/* TABS */}
      <div className="flex border-2 border-[var(--color-ink)] w-fit">
        <button
          onClick={() => setTool('report')}
          className={`px-4 py-2 font-mono text-xs tracking-wider flex items-center gap-2 ${
            tool === 'report' ? 'bg-[var(--color-ink)] text-white' : 'bg-white text-neutral-600 hover:bg-neutral-100'
          }`}
        ><FileText size={14} /> LAPORAN HARIAN</button>
        <button
          onClick={() => setTool('rate')}
          className={`px-4 py-2 font-mono text-xs tracking-wider flex items-center gap-2 border-l-2 border-[var(--color-ink)] ${
            tool === 'rate' ? 'bg-[var(--color-ink)] text-white' : 'bg-white text-neutral-600 hover:bg-neutral-100'
          }`}
        ><Calculator size={14} /> JELASKAN RATE AHSP</button>
      </div>

      {tool === 'report' ? <DailyReportTool disabled={!configured} /> : <ExplainRateTool disabled={!configured} />}
    </div>
  );
}

/* ---------- Result panel (shared) ---------- */
function ResultPanel({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="border-2 border-[var(--color-ink)] bg-white">
      <div className="flex items-center justify-between bg-[var(--color-ink)] text-white px-3 py-2">
        <span className="font-mono text-[10px] tracking-[0.2em]">RESULT</span>
        <button
          onClick={copy}
          className="font-mono text-[10px] tracking-wider flex items-center gap-1 px-2 py-1 hover:bg-white/10"
        >
          {copied ? <><Check size={12} /> COPIED</> : <><Copy size={12} /> COPY</>}
        </button>
      </div>
      <div className="p-4 font-mono text-xs whitespace-pre-wrap leading-relaxed">{text}</div>
    </div>
  );
}

/* ---------- Daily report tool ---------- */
function DailyReportTool({ disabled }: { disabled: boolean }) {
  const [entryId, setEntryId] = useState('');
  const list = trpc.entry.list.useQuery({});
  const draft = trpc.ai.draftDailyReport.useMutation();

  return (
    <div className="space-y-4">
      <div className="border-2 border-[var(--color-ink)] bg-white p-4 space-y-3">
        <div>
          <Label className="font-mono text-[10px] tracking-[0.2em]">DAILY ENTRY</Label>
          <select
            className="w-full border border-neutral-300 px-2 py-2 font-mono text-xs bg-white"
            value={entryId}
            onChange={e => setEntryId(e.target.value)}
            disabled={disabled}
          >
            <option value="">— SELECT ENTRY —</option>
            {(list.data ?? []).map(r => (
              <option key={r.entry.id} value={r.entry.id}>
                {new Date(r.entry.entryDate).toLocaleDateString('id-ID')} · {r.projectName}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="primary"
          disabled={disabled || !entryId || draft.isPending}
          onClick={() => draft.mutate({ entryId })}
        >
          {draft.isPending ? <><Loader2 size={14} className="animate-spin" /> DRAFTING…</> : <><Sparkles size={14} /> DRAFT LAPORAN</>}
        </Button>
      </div>

      {draft.error && (
        <div className="border-2 border-red-600 bg-red-50 p-3 font-mono text-xs text-red-700">{draft.error.message}</div>
      )}
      {draft.data && <ResultPanel text={draft.data.text} />}
    </div>
  );
}

/* ---------- Explain rate tool ---------- */
function ExplainRateTool({ disabled }: { disabled: boolean }) {
  const [ahspItemId, setAhspItemId] = useState('');
  const catalog = trpc.ahsp.catalog.useQuery();
  const explain = trpc.ai.explainRate.useMutation();

  return (
    <div className="space-y-4">
      <div className="border-2 border-[var(--color-ink)] bg-white p-4 space-y-3">
        <div>
          <Label className="font-mono text-[10px] tracking-[0.2em]">AHSP ITEM</Label>
          <select
            className="w-full border border-neutral-300 px-2 py-2 font-mono text-xs bg-white"
            value={ahspItemId}
            onChange={e => setAhspItemId(e.target.value)}
            disabled={disabled}
          >
            <option value="">— SELECT AHSP ITEM —</option>
            {(catalog.data ?? []).map(it => (
              <option key={it.id} value={it.id}>
                {it.kode} · {it.jenis}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="primary"
          disabled={disabled || !ahspItemId || explain.isPending}
          onClick={() => explain.mutate({ ahspItemId })}
        >
          {explain.isPending ? <><Loader2 size={14} className="animate-spin" /> EXPLAINING…</> : <><Sparkles size={14} /> JELASKAN</>}
        </Button>
      </div>

      {explain.error && (
        <div className="border-2 border-red-600 bg-red-50 p-3 font-mono text-xs text-red-700">{explain.error.message}</div>
      )}
      {explain.data && <ResultPanel text={explain.data.text} />}
    </div>
  );
}
