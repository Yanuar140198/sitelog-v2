/**
 * Subcontractor (subkontraktor) master + per-project contracts + invoice ledger.
 *
 * Construction projects sub work out to specialists (Lab boring, Survey, Hauling,
 * Civil works). We need to track:
 *   - subcontractor: org-level master record (one company can serve many projects)
 *   - subcontract: per-project SPK (Surat Perintah Kerja) with scope + value + retention
 *   - subcontractor_invoice: progress claims / berita acara opname submitted by subcon
 *
 * Invoice lifecycle: draft → submitted → verified → approved → paid (or rejected).
 * Retention (default 5%) is withheld from each gross until release at handover.
 */
import {
  pgTable,
  text,
  varchar,
  numeric,
  uuid,
  timestamp,
  date,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { organization, user } from './tenancy';
import { project } from './project';

export const invoiceStatus = pgEnum('invoice_status', [
  'draft',
  'submitted',
  'verified',
  'approved',
  'paid',
  'rejected',
]);

export const subcontractor = pgTable('subcontractor', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  npwp: varchar('npwp', { length: 32 }),
  contactPerson: varchar('contact_person', { length: 120 }),
  phone: varchar('phone', { length: 32 }),
  email: varchar('email', { length: 160 }),
  address: text('address'),
  bankName: varchar('bank_name', { length: 80 }),
  bankAccount: varchar('bank_account', { length: 40 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  index('subcon_org_idx').on(t.organizationId),
]);

export const subcontract = pgTable('subcontract', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  subcontractorId: uuid('subcontractor_id').notNull().references(() => subcontractor.id, { onDelete: 'restrict' }),
  contractNumber: varchar('contract_number', { length: 80 }),
  scopeDescription: text('scope_description').notNull(),
  contractValue: numeric('contract_value', { precision: 18, scale: 2 }).notNull().default('0'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  retentionPct: numeric('retention_pct', { precision: 5, scale: 2 }).notNull().default('5'),
  notes: text('notes'),
  signedAt: date('signed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('subcontract_project_idx').on(t.projectId),
]);

export const subcontractorInvoice = pgTable('subcontractor_invoice', {
  id: uuid('id').primaryKey().defaultRandom(),
  subcontractId: uuid('subcontract_id').notNull().references(() => subcontract.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 80 }).notNull(),
  invoiceDate: date('invoice_date').notNull(),
  progressPct: numeric('progress_pct', { precision: 5, scale: 2 }).notNull().default('0'),
  grossAmount: numeric('gross_amount', { precision: 18, scale: 2 }).notNull(),
  retentionAmount: numeric('retention_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  ppnAmount: numeric('ppn_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  netAmount: numeric('net_amount', { precision: 18, scale: 2 }).notNull(),
  status: invoiceStatus('status').notNull().default('draft'),
  paidDate: date('paid_date'),
  paidAmount: numeric('paid_amount', { precision: 18, scale: 2 }),
  notes: text('notes'),
  submittedById: uuid('submitted_by_id').references(() => user.id),
  approvedById: uuid('approved_by_id').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  index('subcon_inv_subcontract').on(t.subcontractId, t.invoiceDate),
  index('subcon_inv_status').on(t.status),
]);

export type Subcontractor = typeof subcontractor.$inferSelect;
export type NewSubcontractor = typeof subcontractor.$inferInsert;
export type Subcontract = typeof subcontract.$inferSelect;
export type NewSubcontract = typeof subcontract.$inferInsert;
export type SubcontractorInvoice = typeof subcontractorInvoice.$inferSelect;
export type NewSubcontractorInvoice = typeof subcontractorInvoice.$inferInsert;
export type InvoiceStatus = (typeof invoiceStatus.enumValues)[number];
