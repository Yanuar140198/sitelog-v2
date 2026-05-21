/**
 * Fleet — equipment units + per-project assignment.
 */
import { pgTable, text, varchar, numeric, uuid, timestamp, integer, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organization, user } from './tenancy';
import { project } from './project';

export const fleetRole = pgEnum('fleet_role', ['primary', 'backup', 'standby', 'spare']);

export const unit = pgTable('unit', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  nomor: varchar('nomor', { length: 64 }).notNull(),
  fleet: varchar('fleet', { length: 64 }),                 // group/fleet code
  jenisAlat: varchar('jenis_alat', { length: 64 }),        // DT, EX, ADT, LDR, etc
  brand: varchar('brand', { length: 64 }),
  model: varchar('model', { length: 64 }),
  capacity: varchar('capacity', { length: 64 }),
  vendor: varchar('vendor', { length: 128 }),
  ratePerHour: numeric('rate_per_hour', { precision: 14, scale: 2 }),
  // GPS tracking integration
  externalTrackingId: varchar('external_tracking_id', { length: 128 }),
  trackingProvider: varchar('tracking_provider', { length: 32 }),  // 'intellitrac', 'navixy', etc
  // Status
  active: text('active').notNull().default('true'),  // text for flexibility
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  uniqueIndex('unit_org_nomor_idx').on(t.organizationId, t.nomor),
  index('unit_org_jenis_idx').on(t.organizationId, t.jenisAlat),
]);

export const projectFleetAssignment = pgTable('project_fleet_assignment', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  unitId: uuid('unit_id').notNull().references(() => unit.id, { onDelete: 'cascade' }),
  role: fleetRole('role').notNull().default('primary'),
  note: text('note'),
  assignedById: uuid('assigned_by_id').references(() => user.id),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  unassignedAt: timestamp('unassigned_at'),
}, t => [
  uniqueIndex('proj_fleet_unique').on(t.projectId, t.unitId),
  index('proj_fleet_project_idx').on(t.projectId),
]);

export const maintenanceKind = pgEnum('maintenance_kind', ['scheduled', 'breakdown', 'inspection', 'oil_change', 'tire', 'overhaul']);
export const maintenanceStatus = pgEnum('maintenance_status', ['planned', 'in_progress', 'completed', 'overdue', 'cancelled']);

export const unitMaintenance = pgTable('unit_maintenance', {
  id: uuid('id').primaryKey().defaultRandom(),
  unitId: uuid('unit_id').notNull().references(() => unit.id, { onDelete: 'cascade' }),
  kind: maintenanceKind('kind').notNull(),
  status: maintenanceStatus('status').notNull().default('planned'),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  // Triggers: due at HM threshold OR due at date
  dueAtHm: numeric('due_at_hm', { precision: 10, scale: 1 }),
  dueAtDate: timestamp('due_at_date', { mode: 'date' }),
  intervalHm: numeric('interval_hm', { precision: 10, scale: 1 }),   // recurring every N HM
  intervalDays: integer('interval_days'),                            // recurring every N days
  // Execution
  performedAt: timestamp('performed_at'),
  performedAtHm: numeric('performed_at_hm', { precision: 10, scale: 1 }),
  cost: numeric('cost', { precision: 14, scale: 2 }),
  vendor: varchar('vendor', { length: 128 }),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  index('maint_unit_idx').on(t.unitId, t.status),
  index('maint_due_idx').on(t.dueAtDate),
]);

export type Unit = typeof unit.$inferSelect;
export type ProjectFleetAssignment = typeof projectFleetAssignment.$inferSelect;
export type UnitMaintenance = typeof unitMaintenance.$inferSelect;
