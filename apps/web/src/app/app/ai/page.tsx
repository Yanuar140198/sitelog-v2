'use client';
import { useState } from 'react';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, FileText, Calculator, Copy, Check, Loader2, KeyRound, Lightbulb } from 'lucide-react';
import { useFeatureFlag } from '@/hooks/use-feature-flag';

type Tool = 'report' | 'rate' | 'suggest';

export default function AiAssistantPage() {
  const [tool, setTool] = useState<Tool>('report');
  const suggestEnabled = useFeatureFlag('ai-suggest');

  const status = trpc.ai.status.useQuery();
  const configured = status.data?.configured === true;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* HEADER */}
      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">ASSISTANT</p>
        <div className="flex items-baseline gap-3 mt-1">
          <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight">AI Assistant</h1>
          <Sparkles size={20} className="text-[var(--color-brand)]" />
        </div>
        <p className="font-mono text-xs text-neutral-500 mt-2">
          Claude-powered helpers for daily reports, AHSP rate explanations, and BOQ scope suggestions.
        </p>
      </div>

      {/* API KEY SETTINGS */}
      <ApiKeySettings />

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
        {suggestEnabled && (
          <button
            onClick={() => setTool('suggest')}
            className={`px-4 py-2 font-mono text-xs tracking-wider flex items-center gap-2 border-l-2 border-[var(--color-ink)] ${
              tool === 'suggest' ? 'bg-[var(--color-ink)] text-white' : 'bg-white text-neutral-600 hover:bg-neutral-100'
            }`}
          ><Lightbulb size={14} /> SARAN LINGKUP BOQ</button>
        )}
      </div>

      {tool === 'report' && <DailyReportTool disabled={!configured} />}
      {tool === 'rate' && <ExplainRateTool disabled={!configured} />}
      {tool === 'suggest' && suggestEnabled && <SuggestScopesTool disabled={!configured} />}
    </div>
  );
}

/* ---------- API key settings ---------- */
function ApiKeySettings() {
  const utils = trpc.useUtils();
  const status = trpc.ai.status.useQuery();
  const [key, setKey] = useState('');

  const setApiKey = trpc.ai.setApiKey.useMutation({
    onSuccess: () => {
      setKey('');
      utils.ai.status.invalidate();
    },
  });
  const clearApiKey = trpc.ai.clearApiKey.useMutation({
    onSuccess: () => {
      utils.ai.status.invalidate();
    },
  });

  const data = status.data;
  const source = data?.source;

  return (
    <div className="border-2 border-[var(--color-ink)] bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound size={14} className="text-[var(--color-brand)]" />
        <h2 className="font-mono text-xs tracking-[0.2em]">PENGATURAN AI — ANTHROPIC API KEY</h2>
      </div>

      {/* STATUS */}
      {data?.configured && source === 'org' && (
        <div className="flex items-center justify-between gap-3 font-mono text-xs">
          <span className="text-green-700">Terhubung (key: {data.hint})</span>
          <Button
            variant="danger"
            size="sm"
            disabled={clearApiKey.isPending}
            onClick={() => clearApiKey.mutate()}
          >
            {clearApiKey.isPending ? <><Loader2 size={14} className="animate-spin" /> MENGHAPUS…</> : 'Hapus Key'}
          </Button>
        </div>
      )}
      {data?.configured && source === 'server' && (
        <p className="font-mono text-xs text-neutral-600">Menggunakan key server (fallback).</p>
      )}
      {data && !data.configured && (
        <p className="font-mono text-xs text-neutral-600">
          AI memerlukan Anthropic API key milik organisasi Anda untuk aktif.
        </p>
      )}

      {/* INPUT */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="font-mono text-[10px] tracking-[0.2em]">API KEY</Label>
          <Input
            type="password"
            placeholder="sk-ant-..."
            value={key}
            onChange={e => setKey(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          disabled={!key || setApiKey.isPending}
          onClick={() => setApiKey.mutate({ key })}
        >
          {setApiKey.isPending ? <><Loader2 size={14} className="animate-spin" /> MENYIMPAN…</> : 'Simpan Key'}
        </Button>
      </div>

      {setApiKey.error && (
        <div className="border-2 border-red-600 bg-red-50 p-3 font-mono text-xs text-red-700">
          {setApiKey.error.message}
        </div>
      )}
      {clearApiKey.error && (
        <div className="border-2 border-red-600 bg-red-50 p-3 font-mono text-xs text-red-700">
          {clearApiKey.error.message}
        </div>
      )}

      <p className="font-mono text-[10px] text-neutral-500">
        Dapatkan key di console.anthropic.com. Key disimpan terenkripsi.
      </p>
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

/* ---------- Suggest BOQ scopes tool ---------- */
function SuggestScopesTool({ disabled }: { disabled: boolean }) {
  const [description, setDescription] = useState('');
  const suggest = trpc.ai.suggestScopes.useMutation();

  return (
    <div className="space-y-4">
      <div className="border-2 border-[var(--color-ink)] bg-white p-4 space-y-3">
        <div>
          <Label className="font-mono text-[10px] tracking-[0.2em]">DESKRIPSI PROYEK / LINGKUP</Label>
          <textarea
            className="w-full border border-neutral-300 px-3 py-2 font-mono text-xs bg-white min-h-[120px] resize-y"
            placeholder="Contoh: Jalan tanah 2 km lebar 6 m — galian tanah biasa, timbunan pilihan, perkerasan agregat kelas A & B, gorong-gorong beton."
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={disabled}
          />
          <p className="font-mono text-[10px] text-neutral-500 mt-1">
            Saran lingkup dipetakan ke kode AHSP yang tersedia di katalog organisasi Anda.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={disabled || description.trim().length < 10 || suggest.isPending}
          onClick={() => suggest.mutate({ description })}
        >
          {suggest.isPending ? <><Loader2 size={14} className="animate-spin" /> MENYUSUN…</> : <><Sparkles size={14} /> SARANKAN LINGKUP</>}
        </Button>
      </div>

      {suggest.error && (
        <div className="border-2 border-red-600 bg-red-50 p-3 font-mono text-xs text-red-700">{suggest.error.message}</div>
      )}
      {suggest.data && <ResultPanel text={suggest.data.text} />}
    </div>
  );
}
