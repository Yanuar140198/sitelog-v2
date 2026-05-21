/**
 * Multi-tenant SaaS hierarchy:
 *   organization (paying customer / company)
 *     ├── members (users with role per org)
 *     ├── projects (construction projects)
 *     └── subscription (Stripe billing)
 *
 * Users are global accounts (can belong to multiple orgs).
 * Permissions checked at membership level.
 */
import { pgTable, text, timestamp, uuid, varchar, boolean, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const userRole = pgEnum('user_role', [
  'owner',       // org creator, full control + billing
  'admin',       // org admin, manage members + all projects
  'estimator',   // create/edit BOQ + rates
  'scheduler',   // assign fleet + planning
  'supervisor',  // submit daily entries
  'viewer',      // read-only
]);

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: varchar('name', { length: 255 }),
  image: text('image'),
  passwordHash: text('password_hash'),
  totpSecret: text('totp_secret'),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
});

export const session = pgTable('session', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [index('session_user_idx').on(t.userId)]);

export const organization = pgTable('organization', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  logo: text('logo'),
  // Localization defaults
  currency: varchar('currency', { length: 3 }).notNull().default('IDR'),
  locale: varchar('locale', { length: 8 }).notNull().default('id-ID'),
  timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Jakarta'),
  // Trial + plan
  plan: varchar('plan', { length: 32 }).notNull().default('trial'),
  trialEndsAt: timestamp('trial_ends_at'),
  // White-label branding (Pro+ plans only enforced in UI)
  brandColor: varchar('brand_color', { length: 16 }).notNull().default('#FF5500'),
  brandSecondary: varchar('brand_secondary', { length: 16 }).notNull().default('#0A0A0A'),
  customDomain: varchar('custom_domain', { length: 128 }),
  customDomainVerifyToken: varchar('custom_domain_verify_token', { length: 64 }),
  customDomainVerifiedAt: timestamp('custom_domain_verified_at'),
  // Soft delete
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [index('organization_slug_idx').on(t.slug)]);

export const membership = pgTable('membership', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  role: userRole('role').notNull().default('viewer'),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  uniqueIndex('membership_unique').on(t.userId, t.organizationId),
  index('membership_org_idx').on(t.organizationId),
]);

export const invitation = pgTable('invitation', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: userRole('role').notNull().default('viewer'),
  token: text('token').notNull().unique(),
  invitedById: uuid('invited_by_id').references(() => user.id),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [index('invitation_org_email_idx').on(t.organizationId, t.email)]);

// Relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  memberships: many(membership),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  memberships: many(membership),
  invitations: many(invitation),
}));

export const membershipRelations = relations(membership, ({ one }) => ({
  user: one(user, { fields: [membership.userId], references: [user.id] }),
  organization: one(organization, { fields: [membership.organizationId], references: [organization.id] }),
}));

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Organization = typeof organization.$inferSelect;
export type Membership = typeof membership.$inferSelect;
export type UserRole = typeof userRole.enumValues[number];
