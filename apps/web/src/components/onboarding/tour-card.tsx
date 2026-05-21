'use client';
import { trpc } from '@sitelog/api-client/react';
import Link from 'next/link';
import { Check, Sparkles, X } from 'lucide-react';

const STEPS: Record<string, { label: string; href: string }> = {
  create_project: { label: 'Create your first project', href: '/app/projects/new' },
  add_boq_scope: { label: 'Add a BOQ scope', href: '/app/projects' },
  add_unit: { label: 'Add fleet equipment', href: '/app/fleet' },
  invite_member: { label: 'Invite a team member', href: '/app/settings/members' },
  submit_entry: { label: 'Submit a daily entry (mobile)', href: '/app/entries' },
};

export function OnboardingTour() {
  const status = trpc.onboarding.status.useQuery();
  const utils = trpc.useUtils();
  const dismiss = trpc.onboarding.dismiss.useMutation({
    onSuccess: () => utils.onboarding.status.invalidate(),
  });

  if (!status.data || status.data.finishedAt) return null;
  const { steps, progressPct } = status.data;

  return (
    <div className="border-2 border-[var(--color-ink)] bg-white shadow-[4px_4px_0_var(--color-brand)] p-5 relative">
      <button onClick={() => dismiss.mutate()}
        className="absolute top-2 right-2 p-1 hover:bg-neutral-100" title="Dismiss">
        <X size={14} />
      </button>
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-[var(--color-brand)]" />
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--color-brand)] font-bold">GETTING STARTED</p>
      </div>
      <h3 className="font-display text-xl font-bold mt-2">Welcome to Sitelog</h3>
      <p className="font-mono text-xs text-neutral-600 mt-1">Complete these {steps.length} steps to set up your workspace.</p>

      <div className="mt-4 h-2 bg-neutral-200 border border-[var(--color-ink)]">
        <div className="h-full bg-[var(--color-brand)] transition-all" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="font-mono text-[10px] text-neutral-500 mt-1 text-right">{progressPct}% complete</div>

      <div className="mt-4 space-y-2">
        {steps.map(s => {
          const meta = STEPS[s.key];
          if (!meta) return null;
          return (
            <Link key={s.key} href={meta.href as any}
              className={`flex items-center gap-3 px-3 py-2 border-2 ${s.completed ? 'border-green-600 bg-green-50' : 'border-neutral-300 hover:border-[var(--color-brand)]'}`}>
              <div className={`w-5 h-5 border-2 flex items-center justify-center ${s.completed ? 'bg-green-600 border-green-600 text-white' : 'border-neutral-400'}`}>
                {s.completed && <Check size={12} />}
              </div>
              <span className={`font-mono text-xs ${s.completed ? 'line-through text-neutral-500' : ''}`}>{meta.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
