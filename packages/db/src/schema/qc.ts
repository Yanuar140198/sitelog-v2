/**
 * Quality Control test results log per project.
 *
 * Construction inspectors record material/work tests (sand cone density, slump,
 * concrete cube strength, CBR, asphalt extraction, gradation) against spec.
 * Each row captures the spec target + actual measured value + pass/fail verdict.
 *
 * Retest flow: when a fail occurs, the original is marked `retest_required` and
 * a new row is created with `retest_of_id` pointing back to the original,
 * preserving the full traceability chain for QA audit.
 */
import { pgTable, uuid, text, varchar, numeric, timestamp, date, pgEnum, jsonb, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { project } from './project';
import { user } from './tenancy';

export const qcResult = pgEnum('qc_result', ['pass', 'fail', 'pending', 'retest_required']);

export const qcTest = pgTable('qc_test', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  testDate: date('test_date').notNull(),
  testType: varchar('test_type', { length: 80 }).notNull(),
  station: varchar('station', { length: 64 }),
  locationDescription: text('location_description'),
  sampleCode: varchar('sample_code', { length: 80 }),
  specTarget: text('spec_target'),
  specMin: numeric('spec_min', { precision: 14, scale: 4 }),
  specMax: numeric('spec_max', { precision: 14, scale: 4 }),
  actualValue: numeric('actual_value', { precision: 14, scale: 4 }),
  actualText: text('actual_text'),
  unit: varchar('unit', { length: 16 }),
  result: qcResult('result').notNull().default('pending'),
  notes: text('notes'),
  testedBy: varchar('tested_by', { length: 120 }),
  inspectorId: uuid('inspector_id').references(() => user.id),
  retestOfId: uuid('retest_of_id').references((): AnyPgColumn => qcTest.id, { onDelete: 'set null' }),
  photoKeys: jsonb('photo_keys').$type<string[]>().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  index('qc_project_date_idx').on(t.projectId, t.testDate),
  index('qc_result_idx').on(t.projectId, t.result),
  index('qc_type_idx').on(t.testType),
]);

export type QcTest = typeof qcTest.$inferSelect;
export type NewQcTest = typeof qcTest.$inferInsert;
export type QcResult = typeof qcResult.enumValues[number];
