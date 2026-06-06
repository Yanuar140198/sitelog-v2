'use client';
import { trpc } from '@sitelog/api-client/react';
import { Button } from '@/components/ui/button';

export default function BillingPage() {
  const plans = trpc.billing.plans.useQuery();
  const current = trpc.billing.current.useQuery();
  const checkout = trpc.billing.checkoutSession.useMutation({
    onSuccess: (d) => { if (d.url) window.location.href = d.url; },
  });
  const portal = trpc.billing.portalSession.useMutation({
    onSuccess: (d) => { if (d.url) window.location.href = d.url; },
  });

  const sub = current.data?.subscription;
  const org = current.data?.organization;

  // Plan ordering, used to label a switch as Upgrade vs Downgrade.
  const PLAN_RANK: Record<string, number> = { starter: 0, pro: 1, enterprise: 2 };
  const pending = checkout.isPending || portal.isPending;

  // An existing subscriber switching plans (up OR down) goes through the Stripe
  // billing portal, where proration/downgrades are handled correctly. Checkout
  // is only for starting a brand-new subscription (and the enterprise mailto).
  const changePlan = (planKey: string) => {
    if (sub && planKey !== 'enterprise') {
      portal.mutate();
    } else {
      checkout.mutate({ plan: planKey as any });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-2 border-[var(--color-ink)] bg-white">
        <div className="px-4 py-2 bg-[var(--color-ink)] text-white font-mono text-xs tracking-[0.2em]">CURRENT PLAN</div>
        <div className="p-5 flex flex-wrap gap-3 justify-between items-center">
          <div>
            <div className="font-mono text-xs text-neutral-500">Plan</div>
            <div className="font-display text-3xl font-bold capitalize">{sub?.plan ?? org?.plan ?? 'trial'}</div>
            {org?.trialEndsAt && new Date(org.trialEndsAt) > new Date() && (
              <div className="font-mono text-xs text-[var(--color-brand)] mt-1">
                Trial ends {new Date(org.trialEndsAt).toLocaleDateString()}
              </div>
            )}
          </div>
          {sub && (
            <Button onClick={() => portal.mutate()} disabled={portal.isPending}>MANAGE SUBSCRIPTION</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.data?.map(p => (
          <div key={p.key} className={`border-2 border-[var(--color-ink)] bg-white p-6 ${sub?.plan === p.key ? 'shadow-[6px_6px_0_var(--color-brand)]' : ''}`}>
            <div className="font-mono text-xs tracking-wider text-[var(--color-brand)]">{p.key.toUpperCase()}</div>
            <div className="font-display text-3xl font-bold mt-2">{p.name}</div>
            <div className="font-mono text-2xl font-bold mt-3">
              {p.priceMonth === null ? 'Custom' : `$${p.priceMonth}`}
              {p.priceMonth !== null && <span className="text-xs text-neutral-500">/mo</span>}
            </div>
            <ul className="mt-4 font-mono text-xs space-y-1.5 text-neutral-700">
              <li>▸ {p.seats === -1 ? 'Unlimited' : p.seats} seats</li>
              <li>▸ {p.projectsLimit === -1 ? 'Unlimited' : p.projectsLimit} projects</li>
              <li>▸ All features</li>
              <li>▸ Email support</li>
            </ul>
            {(() => {
              const isCurrent = sub?.plan === p.key;
              const currentRank = sub ? PLAN_RANK[sub.plan] ?? -1 : -1;
              const targetRank = PLAN_RANK[p.key] ?? 0;
              const action = !sub
                ? `CHOOSE ${p.name.toUpperCase()}`
                : targetRank > currentRank
                ? `UPGRADE TO ${p.name.toUpperCase()}`
                : `DOWNGRADE TO ${p.name.toUpperCase()}`;
              return (
                <Button onClick={() => changePlan(p.key)} disabled={pending || isCurrent}
                  variant={isCurrent ? 'secondary' : 'primary'} className="w-full mt-5">
                  {isCurrent ? 'CURRENT' : action}
                </Button>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
