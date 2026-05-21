/**
 * Outgoing webhooks + API keys.
 */
import { pgTable, text, varchar, uuid, timestamp, boolean, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organization, user } from './tenancy';

export const webhookEndpoint = pgTable('webhook_endpoint', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  events: text('events').notNull(),               // CSV: project.created,entry.submitted,*
  secret: text('secret').notNull(),               // HMAC signing secret
  active: boolean('active').notNull().default(true),
  description: varchar('description', { length: 255 }),
  createdById: uuid('created_by_id').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastFiredAt: timestamp('last_fired_at'),
  lastStatus: integer('last_status'),
  lastError: text('last_error'),
}, t => [index('webhook_org_idx').on(t.organizationId)]);

export const webhookDelivery = pgTable('webhook_delivery', {
  id: uuid('id').primaryKey().defaultRandom(),
  endpointId: uuid('endpoint_id').notNull().references(() => webhookEndpoint.id, { onDelete: 'cascade' }),
  event: varchar('event', { length: 64 }).notNull(),
  payload: text('payload').notNull(),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  attempts: integer('attempts').notNull().default(0),
  deliveredAt: timestamp('delivered_at'),
  failedAt: timestamp('failed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [index('webhook_delivery_endpoint_idx').on(t.endpointId, t.createdAt)]);

export const apiKey = pgTable('api_key', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  prefix: varchar('prefix', { length: 16 }).notNull(),    // first 8 chars for display (sk_live_xxxx)
  hashedKey: text('hashed_key').notNull(),                // bcrypt of full key
  scope: varchar('scope', { length: 32 }).notNull().default('read'),  // 'read' | 'write' | 'admin'
  createdById: uuid('created_by_id').references(() => user.id),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  uniqueIndex('api_key_hashed_idx').on(t.hashedKey),
  index('api_key_org_idx').on(t.organizationId),
]);

export type WebhookEndpoint = typeof webhookEndpoint.$inferSelect;
export type ApiKey = typeof apiKey.$inferSelect;
