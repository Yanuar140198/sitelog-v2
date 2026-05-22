/**
 * Variation Order (VO) / Change Request register per project.
 *
 * Lifecycle: draft → submitted → under_review → approved|rejected → implemented → invoiced.
 * Tracks cost_impact (IDR, may be negative for deletion/credit) and time_impact_days
 * (schedule extension). Approval is gated to owner|admin at the API layer.
 */
import { pgTable, uuid, text, varchar, numeric, integer, timestamp, date, pgEnum, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { project } from './project';
import { user } from './tenancy';

export const voStatus = pgEnum('vo_status', [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'implemented',
  'invoiced',
]);

export const voType = pgEnum('vo_type', [
  'addition',
  'deletion',
  'substitution',
  'time_extension',
  'design_change',
]);

export type VoRefDoc = { label: string; url: string };

export const variationOrder = pgTable('variation_order', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  voNumber: varchar('vo_number', { length: 40 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  voType: voType('vo_type').notNull(),
  description: text('description').notNull(),
  justification: text('justification'),
  costImpact: numeric('cost_impact', { precision: 18, scale: 2 }).notNull().default('0'),
  timeImpactDays: integer('time_impact_days').notNull().default(0),
  status: voStatus('status').notNull().default('draft'),
  requestedBy: varchar('requested_by', { length: 160 }),
  requestedDate: date('requested_date'),
  submittedAt: timestamp('submitted_at'),
  reviewedAt: timestamp('reviewed_at'),
  approvedAt: timestamp('approved_at'),
  approvedById: uuid('approved_by_id').references(() => user.id),
  implementedAt: date('implemented_at'),
  rejectionReason: text('rejection_reason'),
  referenceDocuments: jsonb('reference_documents').$type<VoRefDoc[]>().default([]),
  notes: text('notes'),
  createdById: uuid('created_by_id').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  uniqueIndex('vo_project_number_idx').on(t.projectId, t.voNumber),
  index('vo_status_idx').on(t.status),
]);

export type VariationOrder = typeof variationOrder.$inferSelect;
export type NewVariationOrder = typeof variationOrder.$inferInsert;
export type VoStatus = typeof voStatus.enumValues[number];
export type VoType = typeof voType.enumValues[number];
