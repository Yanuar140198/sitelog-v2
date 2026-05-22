/**
 * Resource Master Library — centralized HSD (Harga Satuan Dasar) catalog.
 *
 * Replaces per-AHSP duplicated HSD with a single source of truth:
 *   resourceMaster (kode, nama, category, satuan, default_hsd, organization)
 *     └── resourceMasterPrice (region, hsd, effective_from)  -- regional tiers
 *
 * AHSP resources (`ahsp_resource.resource_master_id`) optionally link to master.
 * When master HSD changes (e.g. solar price update), AHSP rates recompute automatically.
 */
import { pgTable, text, varchar, numeric, uuid, timestamp, date, pgEnum, index } from 'drizzle-orm/pg-core';
import { organization } from './tenancy';

export const resourceMasterCategory = pgEnum('resource_master_category', ['tenaga', 'bahan', 'peralatan']);

export const resourceMaster = pgTable('resource_master', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organization.id, { onDelete: 'cascade' }),  // null = global
  kode: varchar('kode', { length: 32 }).notNull(),
  nama: text('nama').notNull(),
  category: resourceMasterCategory('category').notNull(),
  satuan: varchar('satuan', { length: 16 }).notNull(),
  defaultHsd: numeric('default_hsd', { precision: 18, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  index('resource_master_org_idx').on(t.organizationId, t.kode),
  index('resource_master_category_idx').on(t.category),
]);

export const resourceMasterPrice = pgTable('resource_master_price', {
  id: uuid('id').primaryKey().defaultRandom(),
  resourceId: uuid('resource_id').notNull().references(() => resourceMaster.id, { onDelete: 'cascade' }),
  region: varchar('region', { length: 64 }).notNull(),
  hsd: numeric('hsd', { precision: 18, scale: 2 }).notNull(),
  effectiveFrom: date('effective_from').notNull().defaultNow(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('resource_master_price_idx').on(t.resourceId, t.region, t.effectiveFrom),
]);

export type ResourceMaster = typeof resourceMaster.$inferSelect;
export type ResourceMasterPrice = typeof resourceMasterPrice.$inferSelect;
export type ResourceMasterCategory = typeof resourceMasterCategory.enumValues[number];
