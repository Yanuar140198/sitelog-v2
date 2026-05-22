/**
 * Daily weather log + rain-delay tracking per project.
 *
 * One row per (project_id, log_date). Captures morning/afternoon/evening
 * conditions plus rainfall, temp, wind, and the count of work-disrupted hours.
 * Used as evidence for time-extension / rain-delay claims under most
 * Indonesian construction contracts (FIDIC + AV1941 / RKS / SSKK).
 */
import { pgTable, text, numeric, uuid, timestamp, date, boolean, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { project } from './project';
import { user } from './tenancy';

export const WEATHER_CONDITIONS = [
  'cerah',
  'berawan',
  'gerimis',
  'hujan_ringan',
  'hujan_sedang',
  'hujan_lebat',
  'badai',
  'kabut',
] as const;
export type WeatherCondition = typeof WEATHER_CONDITIONS[number];

export const weatherCondition = pgEnum('weather_condition', WEATHER_CONDITIONS);

export const weatherLog = pgTable('weather_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  logDate: date('log_date').notNull(),
  morning: weatherCondition('morning'),
  afternoon: weatherCondition('afternoon'),
  evening: weatherCondition('evening'),
  rainfallMm: numeric('rainfall_mm', { precision: 6, scale: 1 }),
  tempMinC: numeric('temp_min_c', { precision: 4, scale: 1 }),
  tempMaxC: numeric('temp_max_c', { precision: 4, scale: 1 }),
  windKmh: numeric('wind_kmh', { precision: 5, scale: 1 }),
  workDisruptedHours: numeric('work_disrupted_hours', { precision: 4, scale: 1 }).notNull().default('0'),
  rainDelayClaimed: boolean('rain_delay_claimed').notNull().default(false),
  rainDelayApproved: boolean('rain_delay_approved').notNull().default(false),
  notes: text('notes'),
  recordedById: uuid('recorded_by_id').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  uniqueIndex('weather_project_date_unique').on(t.projectId, t.logDate),
  index('weather_project_date_idx').on(t.projectId, t.logDate),
]);

export type WeatherLog = typeof weatherLog.$inferSelect;
export type NewWeatherLog = typeof weatherLog.$inferInsert;
