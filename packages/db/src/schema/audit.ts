/**
 * Audit log + login history for security + compliance.
 */
import { pgTable, text, varchar, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { organization, user } from './tenancy';

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organization.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => user.id),
  action: varchar('action', { length: 64 }).notNull(),       // 'boq.update', 'project.create', etc
  resource: varchar('resource', { length: 64 }).notNull(),   // table/entity name
  resourceId: varchar('resource_id', { length: 64 }),
  diff: text('diff'),                                         // JSON before/after
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('audit_org_created_idx').on(t.organizationId, t.createdAt),
  index('audit_resource_idx').on(t.resource, t.resourceId),
]);

export const loginLog = pgTable('login_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  userId: uuid('user_id').references(() => user.id),
  success: text('success').notNull().default('false'),
  reason: varchar('reason', { length: 128 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('login_log_email_idx').on(t.email, t.createdAt),
  index('login_log_user_idx').on(t.userId, t.createdAt),
]);

export type AuditLog = typeof auditLog.$inferSelect;
export type LoginLog = typeof loginLog.$inferSelect;
