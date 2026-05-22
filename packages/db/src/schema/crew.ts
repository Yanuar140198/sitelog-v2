/**
 * Crew Management — named individuals + roles + daily rates + project assignments.
 *
 * Replaces the legacy `daily_entry.workforce` headcount with proper roster:
 *   crewMember (per-org master list of workers/foremen/operators)
 *     └── crewAssignment (time-bounded project posting w/ optional role/rate override)
 *
 * Daily rates and roles can be overridden per assignment to accommodate temporary
 * promotions, hardship pay, or per-project negotiated rates.
 */
import { pgTable, text, varchar, numeric, uuid, timestamp, date, pgEnum, index } from 'drizzle-orm/pg-core';
import { organization, user } from './tenancy';
import { project } from './project';

export const crewRole = pgEnum('crew_role', [
  'mandor', 'tukang', 'pekerja', 'operator', 'helper', 'driver', 'surveyor', 'security', 'admin', 'other',
]);

export const crewStatus = pgEnum('crew_status', ['active', 'on_leave', 'terminated']);

export const crewMember = pgTable('crew_member', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 160 }).notNull(),
  nickname: varchar('nickname', { length: 60 }),
  phone: varchar('phone', { length: 32 }),
  nationalId: varchar('national_id', { length: 32 }),  // KTP
  role: crewRole('role').notNull().default('pekerja'),
  dailyRate: numeric('daily_rate', { precision: 14, scale: 2 }).notNull().default('0'),
  hourlyRate: numeric('hourly_rate', { precision: 14, scale: 2 }).notNull().default('0'),
  status: crewStatus('status').notNull().default('active'),
  hireDate: date('hire_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [
  index('crew_org_idx').on(t.organizationId, t.status),
]);

export const crewAssignment = pgTable('crew_assignment', {
  id: uuid('id').primaryKey().defaultRandom(),
  crewMemberId: uuid('crew_member_id').notNull().references(() => crewMember.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => project.id, { onDelete: 'cascade' }),
  fromDate: date('from_date').notNull(),
  toDate: date('to_date'),
  roleOverride: crewRole('role_override'),
  dailyRateOverride: numeric('daily_rate_override', { precision: 14, scale: 2 }),
  notes: text('notes'),
  assignedBy: uuid('assigned_by').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  index('crew_assign_project_idx').on(t.projectId, t.fromDate),
  index('crew_assign_crew_idx').on(t.crewMemberId),
]);

export type CrewMember = typeof crewMember.$inferSelect;
export type CrewAssignment = typeof crewAssignment.$inferSelect;
export type CrewRole = typeof crewRole.enumValues[number];
export type CrewStatus = typeof crewStatus.enumValues[number];
