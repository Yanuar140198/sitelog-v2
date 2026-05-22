/**
 * AHSP (Analisa Harga Satuan Pekerjaan) — Unit Rate Analysis catalog.
 *
 * Three-level structure mirroring Bina Marga AHSP standard:
 *   ahspItem (work item — "Cut Soil with Excavator + DT haul 2km")
 *     ├── ahspInput (variables: Tk, Fh, L, Fb, T1, ...) — editable assumptions
 *     ├── ahspKoefisien (derived: Q1 productivity, koefisien per M3) — computed
 *     └── ahspResource (T/B/A breakdown lines: code × koef × HSD = total)
 *
 * Two scopes:
 *   - Global catalog (organizationId NULL) — system templates
 *   - Org-owned (organizationId set) — custom items per organization
 *
 * Per-project overrides → boq.resourceOverride table (in boq.ts).
 */
import { pgTable, text, varchar, numeric, integer, uuid, timestamp, pgEnum, index, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { organization, user } from './tenancy';

export const resourceCategory = pgEnum('resource_category', ['tenaga', 'bahan', 'peralatan']);

export const ahspItem = pgTable('ahsp_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organization.id, { onDelete: 'cascade' }),
  kode: varchar('kode', { length: 32 }).notNull(),       // canonical unique (e.g. "AHSP-1" or "EI-311")
  label: varchar('label', { length: 64 }),                // display (e.g. "EI-311")
  sourceKode: varchar('source_kode', { length: 64 }),     // original from Excel/BinaMarga
  itemNo: varchar('item_no', { length: 32 }),
  section: varchar('section', { length: 128 }),
  jenis: varchar('jenis', { length: 255 }).notNull(),     // work description
  deskripsi: text('deskripsi'),
  satuan: varchar('satuan', { length: 16 }).notNull(),    // unit: M3, M2, m, Jam, etc
  category: varchar('category', { length: 64 }),          // filter bucket: galian/timbunan/perkerasan/drainase/struktur/pembersihan/haul/finishing/overhead/lain-lain
  ohpPct: numeric('ohp_pct', { precision: 5, scale: 2 }).notNull().default('0'),  // Overhead+Profit %
  metadata: text('metadata'),                             // JSON for extra fields
  archivedAt: timestamp('archived_at'),                   // soft-archive (null = active)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  index('ahsp_item_org_kode_idx').on(t.organizationId, t.kode),
  index('ahsp_item_section_idx').on(t.section),
  index('ahsp_item_archived_idx').on(t.archivedAt),
]);

export const ahspInput = pgTable('ahsp_input', {
  id: uuid('id').primaryKey().defaultRandom(),
  ahspItemId: uuid('ahsp_item_id').notNull().references(() => ahspItem.id, { onDelete: 'cascade' }),
  ordinal: integer('ordinal').notNull(),
  kode: varchar('kode', { length: 64 }).notNull(),         // Tk, Fh, L, Fb, T1, etc
  variable: varchar('variable', { length: 64 }),
  uraian: text('uraian').notNull(),
  nilai: numeric('nilai', { precision: 18, scale: 6 }),
  satuan: varchar('satuan', { length: 32 }),
  sumber: text('sumber'),                                  // formula reference / data source
}, t => [index('ahsp_input_item_idx').on(t.ahspItemId, t.ordinal)]);

export const ahspKoefisien = pgTable('ahsp_koefisien', {
  id: uuid('id').primaryKey().defaultRandom(),
  ahspItemId: uuid('ahsp_item_id').notNull().references(() => ahspItem.id, { onDelete: 'cascade' }),
  ordinal: integer('ordinal').notNull(),
  kode: varchar('kode', { length: 64 }).notNull(),
  variable: varchar('variable', { length: 64 }),
  uraian: text('uraian'),
  nilai: numeric('nilai', { precision: 18, scale: 8 }),
  satuan: varchar('satuan', { length: 32 }),
  formula: text('formula'),
}, t => [index('ahsp_koef_item_idx').on(t.ahspItemId, t.ordinal)]);

export const ahspResource = pgTable('ahsp_resource', {
  id: uuid('id').primaryKey().defaultRandom(),
  ahspItemId: uuid('ahsp_item_id').notNull().references(() => ahspItem.id, { onDelete: 'cascade' }),
  category: resourceCategory('category').notNull(),         // tenaga / bahan / peralatan
  ordinal: integer('ordinal').notNull(),
  resourceCode: varchar('resource_code', { length: 32 }).notNull(),  // L01, E10, ZB01, etc
  uraian: text('uraian').notNull(),
  koefisien: numeric('koefisien', { precision: 18, scale: 8 }).notNull(),
  satuan: varchar('satuan', { length: 32 }),
  hsd: numeric('hsd', { precision: 18, scale: 2 }).notNull(),  // unit price (Harga Satuan Dasar)
}, t => [
  index('ahsp_resource_item_idx').on(t.ahspItemId, t.category, t.ordinal),
  index('ahsp_resource_code_idx').on(t.resourceCode),
]);

/**
 * Version log: every mutation (item meta, inputs, koefisien, resources) appends
 * a JSONB snapshot here. Restore replays a snapshot back into live tables.
 */
export const ahspVersion = pgTable('ahsp_version', {
  id: uuid('id').primaryKey().defaultRandom(),
  ahspItemId: uuid('ahsp_item_id').notNull().references(() => ahspItem.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  snapshot: jsonb('snapshot').notNull(),  // { item, inputs, koefisien, resources, computedRate }
  changedById: uuid('changed_by_id').references(() => user.id),
  changeSummary: varchar('change_summary', { length: 200 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('ahsp_version_item_idx').on(t.ahspItemId, t.versionNumber),
]);

/**
 * Per-user pinned/favorite AHSP items. Pinned items sort to the top of the catalog list.
 * Composite PK (userId, ahspItemId) ensures a single pin per user/item pair.
 */
export const ahspPin = pgTable('ahsp_pin', {
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  ahspItemId: uuid('ahsp_item_id').notNull().references(() => ahspItem.id, { onDelete: 'cascade' }),
  pinnedAt: timestamp('pinned_at').notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.userId, t.ahspItemId] }),
  index('ahsp_pin_user_idx').on(t.userId),
]);

export type AhspItem = typeof ahspItem.$inferSelect;
export type AhspResource = typeof ahspResource.$inferSelect;
export type AhspVersion = typeof ahspVersion.$inferSelect;
export type AhspPin = typeof ahspPin.$inferSelect;
export type ResourceCategory = typeof resourceCategory.enumValues[number];
