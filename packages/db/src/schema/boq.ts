/**
 * BOQ (Bill of Quantities) per project.
 *
 *   boqItem (scope per project: AHSP item + qty + optional unit rate override)
 *     └── boqResourceOverride (per-resource override: koef/hsd per AHSP per project)
 *
 * Computed values (subtotal, applied_rate, breakdown by tenaga/bahan/peralatan) live in API layer
 * — they derive from boqItem.quantity × resolved unit rate (with overrides applied).
 *
 * Versioning: boqVersion captures snapshot for revision history + estimator comparison.
 */
import { pgTable, text, varchar, numeric, uuid, timestamp, integer, date, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { project } from './project';
import { ahspItem } from './ahsp';
import { user } from './tenancy';

export const boqItem = pgTable('boq_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  ahspItemId: uuid('ahsp_item_id').notNull().references(() => ahspItem.id, { onDelete: 'restrict' }),
  ordinal: integer('ordinal').notNull().default(0),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull().default('0'),
  // Optional manual unit rate override (Rp). NULL = use computed AHSP rate.
  unitRateOverride: numeric('unit_rate_override', { precision: 18, scale: 2 }),
  note: text('note'),
  // Schedule fields (Primavera-style)
  plannedStart: date('planned_start'),
  plannedFinish: date('planned_finish'),
  actualStart: date('actual_start'),
  actualFinish: date('actual_finish'),
  baselineStart: date('baseline_start'),
  baselineFinish: date('baseline_finish'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdById: uuid('created_by_id').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  uniqueIndex('boq_item_unique').on(t.projectId, t.ahspItemId),
  index('boq_item_project_idx').on(t.projectId),
]);

export const scheduleBaseline = pgTable('schedule_baseline', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  setById: uuid('set_by').references(() => user.id),
  setAt: timestamp('set_at').notNull().defaultNow(),
  notes: text('notes'),
  snapshot: jsonb('snapshot').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('schedule_baseline_project_idx').on(t.projectId, t.setAt),
]);

export const boqResourceOverride = pgTable('boq_resource_override', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  ahspItemId: uuid('ahsp_item_id').notNull().references(() => ahspItem.id, { onDelete: 'cascade' }),
  resourceCode: varchar('resource_code', { length: 32 }).notNull(),  // L01, E10, etc
  // NULL = no override on that dimension; numeric (including 0) = explicit override
  koefisien: numeric('koefisien', { precision: 18, scale: 8 }),
  hsd: numeric('hsd', { precision: 18, scale: 2 }),
  note: text('note'),
  updatedById: uuid('updated_by_id').references(() => user.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  uniqueIndex('boq_resource_override_unique').on(t.projectId, t.ahspItemId, t.resourceCode),
  index('boq_resource_override_project_idx').on(t.projectId),
]);

export const boqVersion = pgTable('boq_version', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  label: varchar('label', { length: 128 }),
  snapshot: text('snapshot').notNull(),  // JSON: full BOQ state (items + overrides + totals)
  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  uniqueIndex('boq_version_unique').on(t.projectId, t.versionNumber),
]);

export const boqTemplate = pgTable('boq_template', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'),    // null = public/global template
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 64 }),  // 'mining', 'civil_road', 'building', etc
  items: text('items').notNull(),  // JSON: [{ahspKode, defaultQty, note}]
  publishedAt: timestamp('published_at'),
  createdById: uuid('created_by_id').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('boq_template_org_idx').on(t.organizationId),
  index('boq_template_category_idx').on(t.category),
]);

export type BoqItem = typeof boqItem.$inferSelect;
export type BoqResourceOverride = typeof boqResourceOverride.$inferSelect;
export type BoqVersion = typeof boqVersion.$inferSelect;
export type BoqTemplate = typeof boqTemplate.$inferSelect;
export type ScheduleBaseline = typeof scheduleBaseline.$inferSelect;
