/**
 * In-app notifications + user preferences.
 */
import { pgTable, text, varchar, uuid, timestamp, boolean, pgEnum, index, jsonb } from 'drizzle-orm/pg-core';
import { user, organization } from './tenancy';

export const notificationKind = pgEnum('notification_kind', [
  'invite', 'invite_accepted', 'project_created', 'boq_changed', 'entry_submitted',
  'fleet_assigned', 'billing', 'mention', 'system',
]);

export const notification = pgTable('notification', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organization.id, { onDelete: 'cascade' }),
  kind: notificationKind('kind').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  href: text('href'),                       // optional in-app link
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('notification_user_read_idx').on(t.userId, t.readAt),
  index('notification_user_created_idx').on(t.userId, t.createdAt),
]);

export const userPreference = pgTable('user_preference', {
  userId: uuid('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  emailDigestWeekly: boolean('email_digest_weekly').notNull().default(true),
  emailMentions: boolean('email_mentions').notNull().default(true),
  emailBilling: boolean('email_billing').notNull().default(true),
  // Per-event toggles (JSON: { "boq_changed": false, ... })
  eventOptOut: text('event_opt_out'),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  onboardingSteps: text('onboarding_steps'),  // JSON array of completed step keys
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const pushSubscription = pgTable('push_subscription', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 16 }).notNull(),
  token: text('token').notNull().unique(),
  p256dh: text('p256dh'),
  authKey: text('auth_key'),
  deviceLabel: varchar('device_label', { length: 128 }),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [index('push_user_idx').on(t.userId)]);

/**
 * Outbound integration channels per org (Slack/Discord/Email).
 * Routes domain events to external systems.
 */
export const notificationChannel = pgTable('notification_channel', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  channelType: varchar('channel_type', { length: 32 }).notNull(),  // 'slack' | 'discord' | 'email'
  name: varchar('name', { length: 120 }).notNull(),
  webhookUrl: text('webhook_url'),
  emailAddress: varchar('email_address', { length: 255 }),
  events: jsonb('events').notNull().default([]).$type<string[]>(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [index('notif_channel_org_idx').on(t.organizationId)]);

export type Notification = typeof notification.$inferSelect;
export type UserPreference = typeof userPreference.$inferSelect;
export type PushSubscription = typeof pushSubscription.$inferSelect;
export type NotificationChannel = typeof notificationChannel.$inferSelect;
