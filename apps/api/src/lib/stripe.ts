/**
 * Stripe SDK singleton. Lazy-init — only constructs if STRIPE_SECRET_KEY set.
 * All call sites must check `stripe` for null and fail gracefully (e.g. stub URL).
 */
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
export const stripe = key ? new Stripe(key, { apiVersion: '2024-12-18.acacia' as any }) : null;

export const STRIPE_PRICES: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
};
