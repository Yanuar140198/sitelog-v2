/**
 * Stripe subscription billing per organization.
 */
import { pgTable, text, varchar, uuid, timestamp, integer, numeric, pgEnum, index } from 'drizzle-orm/pg-core';
import { organization } from './tenancy';

export const subscriptionStatus = pgEnum('subscription_status', [
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'paused',
]);

export const subscription = pgTable('subscription', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }).unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 128 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 128 }),
  stripePriceId: varchar('stripe_price_id', { length: 128 }),
  plan: varchar('plan', { length: 32 }).notNull().default('trial'),  // 'trial','starter','pro','enterprise'
  status: subscriptionStatus('status').notNull().default('trialing'),
  seats: integer('seats').notNull().default(5),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: text('cancel_at_period_end').notNull().default('false'),
  trialEnd: timestamp('trial_end'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [index('subscription_stripe_idx').on(t.stripeSubscriptionId)]);

export const usageRecord = pgTable('usage_record', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  metric: varchar('metric', { length: 64 }).notNull(),  // 'projects', 'photos_uploaded_mb', 'api_calls', etc
  value: numeric('value', { precision: 18, scale: 2 }).notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  reportedAt: timestamp('reported_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('usage_org_metric_period_idx').on(t.organizationId, t.metric, t.periodStart),
]);

export type Subscription = typeof subscription.$inferSelect;
export type SubscriptionStatus = typeof subscriptionStatus.enumValues[number];
