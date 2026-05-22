/**
 * HSE (Health, Safety, Environment) incident log per project.
 * Construction compliance: track near-misses, injuries, environmental incidents,
 * property damage. Lifecycle: open → investigating → corrective_action → closed.
 */
import { pgTable, uuid, text, varchar, timestamp, date, time, pgEnum, jsonb, index } from 'drizzle-orm/pg-core';
import { project } from './project';
import { user } from './tenancy';

export const hseSeverity = pgEnum('hse_severity', [
  'near_miss',
  'first_aid',
  'medical',
  'lost_time',
  'fatality',
  'property_damage',
  'environmental',
]);

export const hseStatus = pgEnum('hse_status', [
  'open',
  'investigating',
  'corrective_action',
  'closed',
]);

export const hseIncident = pgTable('hse_incident', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  incidentDate: date('incident_date').notNull(),
  incidentTime: time('incident_time'),
  severity: hseSeverity('severity').notNull(),
  incidentType: varchar('incident_type', { length: 80 }).notNull(),
  location: text('location').notNull(),
  description: text('description').notNull(),
  involvedPersons: text('involved_persons'),
  immediateAction: text('immediate_action'),
  rootCause: text('root_cause'),
  correctiveAction: text('corrective_action'),
  status: hseStatus('status').notNull().default('open'),
  reportedById: uuid('reported_by_id').references(() => user.id),
  closedAt: timestamp('closed_at'),
  closedById: uuid('closed_by_id').references(() => user.id),
  photoKeys: jsonb('photo_keys').$type<string[]>().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  index('hse_project_date_idx').on(t.projectId, t.incidentDate),
  index('hse_severity_idx').on(t.severity, t.status),
]);

export type HseIncident = typeof hseIncident.$inferSelect;
export type NewHseIncident = typeof hseIncident.$inferInsert;
export type HseSeverity = typeof hseSeverity.enumValues[number];
export type HseStatus = typeof hseStatus.enumValues[number];
