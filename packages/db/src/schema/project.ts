/**
 * Construction project — root entity for BOQ/scheduling/tracking.
 */
import { pgTable, text, varchar, numeric, uuid, timestamp, date, pgEnum, index } from 'drizzle-orm/pg-core';
import { organization, user } from './tenancy';

export const projectStatus = pgEnum('project_status', ['planning', 'active', 'on_hold', 'completed', 'archived']);

export const project = pgTable('project', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 64 }).notNull(),         // e.g. "LS 44", "MMS 12"
  name: varchar('name', { length: 255 }).notNull(),
  client: varchar('client', { length: 255 }),
  location: text('location'),
  status: projectStatus('status').notNull().default('planning'),
  // Schedule
  startDate: date('start_date'),
  finishDate: date('finish_date'),
  durationDays: numeric('duration_days', { precision: 8, scale: 1 }),
  // Fleet design (text spec)
  fleetDesign: text('fleet_design'),
  // Plan volumes (m³)
  planLandClearing: numeric('plan_land_clearing', { precision: 14, scale: 2 }).notNull().default('0'),
  planCutSoil: numeric('plan_cut_soil', { precision: 14, scale: 2 }).notNull().default('0'),
  planCutRock: numeric('plan_cut_rock', { precision: 14, scale: 2 }).notNull().default('0'),
  planFill: numeric('plan_fill', { precision: 14, scale: 2 }).notNull().default('0'),
  // Targets (daily/monthly)
  targetCutDaily: numeric('target_cut_daily', { precision: 14, scale: 2 }).notNull().default('0'),
  targetFillDaily: numeric('target_fill_daily', { precision: 14, scale: 2 }).notNull().default('0'),
  // Financial summary (cached for dashboard, recomputed on BOQ change)
  cachedBoqSubtotal: numeric('cached_boq_subtotal', { precision: 18, scale: 2 }).notNull().default('0'),
  cachedGrandTotal: numeric('cached_grand_total', { precision: 18, scale: 2 }).notNull().default('0'),
  cachedSpi: numeric('cached_spi', { precision: 6, scale: 4 }),
  cachedCpi: numeric('cached_cpi', { precision: 6, scale: 4 }),
  cachedEarnedValue: numeric('cached_earned_value', { precision: 18, scale: 2 }).notNull().default('0'),
  cachedProgressPct: numeric('cached_progress_pct', { precision: 6, scale: 2 }).notNull().default('0'),
  // Markup configuration
  markupPct: numeric('markup_pct', { precision: 6, scale: 2 }).notNull().default('0'),
  contingencyPct: numeric('contingency_pct', { precision: 6, scale: 2 }).notNull().default('0'),
  ppnPct: numeric('ppn_pct', { precision: 6, scale: 2 }).notNull().default('11'),
  // Geofence (optional)
  siteLat: numeric('site_lat', { precision: 10, scale: 7 }),
  siteLng: numeric('site_lng', { precision: 10, scale: 7 }),
  geofenceRadiusM: numeric('geofence_radius_m', { precision: 8, scale: 0 }),
  // Currency (default to org currency)
  currency: varchar('currency', { length: 3 }),         // null = inherit from org
  fxRateToOrg: numeric('fx_rate_to_org', { precision: 14, scale: 6 }),  // multiply by to convert project→org currency
  // Soft delete
  deletedAt: timestamp('deleted_at'),
  createdById: uuid('created_by_id').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  index('project_org_code_idx').on(t.organizationId, t.code),
  index('project_org_status_idx').on(t.organizationId, t.status),
]);

export const projectAssignment = pgTable('project_assignment', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  roleOnProject: varchar('role_on_project', { length: 64 }),  // 'PM', 'Supervisor', 'Surveyor', etc
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
}, t => [
  index('proj_assign_idx').on(t.projectId, t.userId),
]);

export const publicShare = pgTable('public_share', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  label: varchar('label', { length: 128 }),
  includeKpi: text('include_kpi').notNull().default('true'),
  includeEntries: text('include_entries').notNull().default('false'),
  expiresAt: timestamp('expires_at'),
  createdById: uuid('created_by_id').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  revokedAt: timestamp('revoked_at'),
}, t => [index('public_share_project_idx').on(t.projectId)]);

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
export type ProjectStatus = typeof projectStatus.enumValues[number];
export type PublicShare = typeof publicShare.$inferSelect;
