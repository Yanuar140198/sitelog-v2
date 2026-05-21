/**
 * Stripe subscription router.
 *
 * Webhook handled separately (server.ts /api/webhooks/stripe).
 * Procedures here = checkout/portal links + status read.
 */
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { subscription, organization } from '@sitelog/db';
import { TRPCError } from '@trpc/server';
import { stripe, STRIPE_PRICES } from '../lib/stripe.js';

const PLANS = {
  starter: { name: 'Starter', priceMonth: 29, seats: 5, projectsLimit: 10 },
  pro: { name: 'Pro', priceMonth: 99, seats: 25, projectsLimit: 100 },
  enterprise: { name: 'Enterprise', priceMonth: null, seats: -1, projectsLimit: -1 },
} as const;

export const billingRouter = router({
  plans: orgProcedure.query(() => Object.entries(PLANS).map(([k, v]) => ({ key: k, ...v }))),

  current: orgProcedure.query(async ({ ctx }) => {
    const [sub] = await ctx.db.select().from(subscription)
      .where(eq(subscription.organizationId, ctx.session.organizationId)).limit(1);
    const [org] = await ctx.db.select().from(organization)
      .where(eq(organization.id, ctx.session.organizationId)).limit(1);
    return { subscription: sub ?? null, organization: org };
  }),

  checkoutSession: requireRole('owner')
    .input(z.object({ plan: z.enum(['starter', 'pro', 'enterprise']) }))
    .mutation(async ({ ctx, input }) => {
      if (input.plan === 'enterprise') {
        return { url: 'mailto:sales@sitelog.app?subject=Enterprise%20Plan' };
      }
      if (!stripe) return { url: `/app/settings/billing?stub=${input.plan}` };
      const priceId = STRIPE_PRICES[input.plan];
      if (!priceId) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: `STRIPE_PRICE_${input.plan.toUpperCase()} not configured` });

      const [existing] = await ctx.db.select().from(subscription)
        .where(eq(subscription.organizationId, ctx.session.organizationId)).limit(1);
      const sess = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        customer: existing?.stripeCustomerId ?? undefined,
        customer_email: existing?.stripeCustomerId ? undefined : ctx.session.user.email,
        client_reference_id: ctx.session.organizationId,
        metadata: {
          organizationId: ctx.session.organizationId,
          plan: input.plan,
        },
        success_url: `${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/app/settings/billing?ok=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/app/settings/billing`,
        subscription_data: {
          trial_period_days: 14,
          metadata: { organizationId: ctx.session.organizationId },
        },
      });
      return { url: sess.url ?? '' };
    }),

  portalSession: requireRole('owner').mutation(async ({ ctx }) => {
    if (!stripe) return { url: '/app/settings/billing?portal=stub' };
    const [sub] = await ctx.db.select().from(subscription)
      .where(eq(subscription.organizationId, ctx.session.organizationId)).limit(1);
    if (!sub?.stripeCustomerId) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No active subscription' });
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/app/settings/billing`,
    });
    return { url: portal.url };
  }),
});
