'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, GitMerge } from 'lucide-react';

type DupGroup = {
  jenis: string;
  satuan: string;
  items: Array<{ id: string; kode: string; computedRate: number; usedInProjects: number }>;
};

type GroupChoice = {
  keepId: string;
  removeIds: Set<string>;
};

const groupKey = (g: DupGroup) =>
  `${g.jenis.toLowerCase().trim()}\x1f${g.satuan.toLowerCase().trim()}`;

const fmt = (n: number) =>
  n.toLocaleString('id-ID', { maximumFractionDigits: 0 });

export default function AhspDedupPage() {
  const dups = trpc.ahsp.findDuplicates.useQuery();
  const utils = trpc.useUtils();
  const merge = trpc.ahsp.mergeItems.useMutation({
    onSuccess: () => {
      void utils.ahsp.findDuplicates.invalidate();
      void utils.ahsp.catalogWithRates.invalidate();
    },
  });

  const [choices, setChoices] = useState<Record<string, GroupChoice>>({});

  // Default selection: keep the row with most projects-used; tiebreaker = highest rate.
  useEffect(() => {
    if (!dups.data) return;
    setChoices(prev => {
      const next = { ...prev };
      for (const g of dups.data) {
        const k = groupKey(g);
        if (next[k]) continue;
        const sorted = [...g.items].sort((a, b) => {
          if (b.usedInProjects !== a.usedInProjects) return b.usedInProjects - a.usedInProjects;
          return b.computedRate - a.computedRate;
        });
        const keep = sorted[0]!;
        next[k] = {
          keepId: keep.id,
          removeIds: new Set(g.items.filter(i => i.id !== keep.id).map(i => i.id)),
        };
      }
      return next;
    });
  }, [dups.data]);

  function setKeep(g: DupGroup, newKeepId: string) {
    const k = groupKey(g);
    setChoices(prev => ({
      ...prev,
      [k]: {
        keepId: newKeepId,
        removeIds: new Set(g.items.filter(i => i.id !== newKeepId).map(i => i.id)),
      },
    }));
  }

  function toggleRemove(g: DupGroup, id: string) {
    const k = groupKey(g);
    setChoices(prev => {
      const cur = prev[k];
      if (!cur || id === cur.keepId) return prev;
      const next = new Set(cur.removeIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [k]: { ...cur, removeIds: next } };
    });
  }

  async function mergeGroup(g: DupGroup) {
    const k = groupKey(g);
    const choice = choices[k];
    if (!choice) return;
    const removeIds = Array.from(choice.removeIds);
    if (removeIds.length === 0) {
      alert('Select at least one item to remove.');
      return;
    }
    const removedKodes = g.items
      .filter(i => removeIds.includes(i.id))
      .map(i => i.kode);
    const keepKode = g.items.find(i => i.id === choice.keepId)?.kode ?? '?';
    const ok = confirm(
      `Merge ${removeIds.length} duplicate(s) into "${keepKode}"?\n\n`
      + `Will remove: ${removedKodes.join(', ')}\n\n`
      + `All boq_item references will be rerouted to the kept item. `
      + `This cannot be undone (but a version snapshot is saved on the kept item).`,
    );
    if (!ok) return;
    try {
      const res = await merge.mutateAsync({
        keepId: choice.keepId,
        removeIds,
        reason: `dedup: ${g.jenis} · ${g.satuan}`,
      });
      alert(`Merged ${res.merged} item(s). ${res.projectsAffected} project(s) affected.`);
    } catch (e: any) {
      alert(`Merge failed: ${e?.message ?? e}`);
    }
  }

  if (!dups.data) return <div className="p-8 font-mono text-xs">Loading…</div>;

  const groups = dups.data;

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <Link href="/app/ahsp" className="inline-flex items-center gap-2 font-mono text-xs text-neutral-500 hover:text-[var(--color-brand)]">
        <ArrowLeft size={14} /> AHSP CATALOG
      </Link>

      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)]">TOOLS · DEDUP</p>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">AHSP Duplicate Resolution</h1>
        <p className="font-mono text-xs text-neutral-500 mt-2">
          {groups.length} duplicate group{groups.length === 1 ? '' : 's'} detected
          {' · '}grouped by case-insensitive (jenis, satuan)
        </p>
      </div>

      {groups.length === 0 && (
        <div className="border-2 border-green-500 bg-green-50 p-8 text-center font-mono text-xs">
          <div className="font-bold text-green-700">No duplicates found ✓</div>
          <div className="text-neutral-600 mt-1">Your AHSP catalog is clean.</div>
        </div>
      )}

      {groups.map(g => {
        const k = groupKey(g);
        const choice = choices[k];
        const removeCount = choice?.removeIds.size ?? 0;
        return (
          <div key={k} className="border-2 border-[var(--color-ink)] bg-white">
            <div className="px-4 py-3 bg-[var(--color-ink)] text-white">
              <div className="font-mono text-xs tracking-[0.15em] uppercase opacity-70">
                {g.items.length} duplicate items
              </div>
              <div className="font-display text-lg font-bold mt-0.5">
                {g.jenis} <span className="opacity-60">·</span> {g.satuan}
              </div>
            </div>

            <table className="w-full font-mono text-xs">
              <thead className="bg-neutral-100 text-neutral-700">
                <tr>
                  <th className="text-left px-3 py-2 tracking-wider w-32">KODE</th>
                  <th className="text-right px-3 py-2 tracking-wider w-40">COMPUTED RATE</th>
                  <th className="text-right px-3 py-2 tracking-wider w-32">USED IN</th>
                  <th className="text-center px-3 py-2 tracking-wider w-24">KEEP</th>
                  <th className="text-center px-3 py-2 tracking-wider w-24">REMOVE</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map(it => {
                  const isKeep = choice?.keepId === it.id;
                  const isRemove = choice?.removeIds.has(it.id) ?? false;
                  return (
                    <tr
                      key={it.id}
                      className={`border-t border-neutral-200 ${isKeep ? 'bg-green-50' : isRemove ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-3 py-2 font-bold">
                        <Link href={`/app/ahsp/${it.id}`} className="hover:text-[var(--color-brand)] underline-offset-4 hover:underline">
                          {it.kode}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        Rp {fmt(it.computedRate)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {it.usedInProjects} project{it.usedInProjects === 1 ? '' : 's'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="radio"
                          name={`keep-${k}`}
                          checked={isKeep}
                          onChange={() => setKeep(g, it.id)}
                          aria-label={`Keep ${it.kode}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isRemove}
                          disabled={isKeep}
                          onChange={() => toggleRemove(g, it.id)}
                          aria-label={`Remove ${it.kode}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
              <div className="font-mono text-xs text-neutral-600">
                Will remove {removeCount} of {g.items.length} item(s).
                {' '}Default keeps the row with most project usage.
              </div>
              <Button
                onClick={() => mergeGroup(g)}
                disabled={merge.isPending || removeCount === 0}
                className="bg-[var(--color-brand)] hover:bg-[var(--color-ink)] text-white"
              >
                <GitMerge size={14} className="mr-2" />
                {merge.isPending ? 'MERGING…' : 'MERGE NOW'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
