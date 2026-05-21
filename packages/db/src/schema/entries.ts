/**
 * Daily production entries from field supervisors.
 *
 *   dailyEntry (per day, per project, per shift) — header
 *     ├── entryActivity (work performed: AHSP code → quantity actual that day)
 *     ├── entryEquipmentUtil (per-unit HM, fuel, status)
 *     └── entryPhoto (photos with GPS + caption)
 *
 * Aggregations roll up to project earned-value for SPI/CPI dashboards.
 */
import { pgTable, text, varchar, numeric, uuid, timestamp, date, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { project } from './project';
import { ahspItem } from './ahsp';
import { unit } from './fleet';
import { user } from './tenancy';

export const shiftEnum = pgEnum('shift', ['day', 'night', 'all']);
export const weatherEnum = pgEnum('weather', ['clear', 'cloudy', 'rain_light', 'rain_heavy', 'storm']);

export const dailyEntry = pgTable('daily_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  entryDate: date('entry_date').notNull(),
  shift: shiftEnum('shift').notNull().default('day'),
  weather: weatherEnum('weather'),
  effectiveHours: numeric('effective_hours', { precision: 5, scale: 2 }),
  workforce: integer('workforce'),
  notes: text('notes'),
  // Geo + device
  submittedAtLat: numeric('submitted_at_lat', { precision: 10, scale: 7 }),
  submittedAtLng: numeric('submitted_at_lng', { precision: 10, scale: 7 }),
  appVersion: varchar('app_version', { length: 32 }),
  // Submission
  submittedById: uuid('submitted_by_id').references(() => user.id),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
  // Soft delete
  deletedAt: timestamp('deleted_at'),
}, t => [
  index('daily_entry_project_date_idx').on(t.projectId, t.entryDate),
  index('daily_entry_submitter_idx').on(t.submittedById, t.submittedAt),
]);

export const entryActivity = pgTable('entry_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  dailyEntryId: uuid('daily_entry_id').notNull().references(() => dailyEntry.id, { onDelete: 'cascade' }),
  ahspItemId: uuid('ahsp_item_id').references(() => ahspItem.id),  // nullable for ad-hoc
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 14, scale: 4 }).notNull(),
  satuan: varchar('satuan', { length: 16 }),
  // Optional location segment
  station: varchar('station', { length: 64 }),
}, t => [
  index('entry_activity_entry_idx').on(t.dailyEntryId),
  index('entry_activity_ahsp_idx').on(t.ahspItemId),
]);

export const entryEquipmentUtil = pgTable('entry_equipment_util', {
  id: uuid('id').primaryKey().defaultRandom(),
  dailyEntryId: uuid('daily_entry_id').notNull().references(() => dailyEntry.id, { onDelete: 'cascade' }),
  unitId: uuid('unit_id').references(() => unit.id),
  // Hour meter readings
  hmStart: numeric('hm_start', { precision: 10, scale: 1 }),
  hmEnd: numeric('hm_end', { precision: 10, scale: 1 }),
  hmWork: numeric('hm_work', { precision: 6, scale: 1 }),
  hmIdle: numeric('hm_idle', { precision: 6, scale: 1 }),
  hmBreakdown: numeric('hm_breakdown', { precision: 6, scale: 1 }),
  // Fuel
  fuelLiters: numeric('fuel_liters', { precision: 8, scale: 2 }),
  // Odometer (DT)
  odometerKm: numeric('odometer_km', { precision: 10, scale: 1 }),
  trips: integer('trips'),
  status: varchar('status', { length: 32 }),  // 'working', 'idle', 'breakdown', 'standby'
  note: text('note'),
}, t => [
  index('entry_eq_util_entry_idx').on(t.dailyEntryId),
  index('entry_eq_util_unit_idx').on(t.unitId),
]);

export const entryPhoto = pgTable('entry_photo', {
  id: uuid('id').primaryKey().defaultRandom(),
  dailyEntryId: uuid('daily_entry_id').notNull().references(() => dailyEntry.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),    // R2 object key
  url: text('url'),                              // resolved CDN URL (cached)
  caption: text('caption'),
  takenAt: timestamp('taken_at'),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  width: integer('width'),
  height: integer('height'),
  sizeBytes: integer('size_bytes'),
  // AI analysis output (auto-populated by photo-tag cron)
  aiCaption: text('ai_caption'),
  aiTags: text('ai_tags'),           // JSON array
  aiProgressPct: numeric('ai_progress_pct', { precision: 5, scale: 1 }),
  aiAnalyzedAt: timestamp('ai_analyzed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [index('entry_photo_entry_idx').on(t.dailyEntryId)]);

export type DailyEntry = typeof dailyEntry.$inferSelect;
export type EntryActivity = typeof entryActivity.$inferSelect;
export type EntryEquipmentUtil = typeof entryEquipmentUtil.$inferSelect;
export type EntryPhoto = typeof entryPhoto.$inferSelect;
