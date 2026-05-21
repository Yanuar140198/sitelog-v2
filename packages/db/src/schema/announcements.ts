import { pgTable, uuid, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { user } from './tenancy';

export const announcement = pgTable('announcement', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  severity: text('severity').$type<'info' | 'warning' | 'critical'>().notNull().default('info'),
  startsAt: timestamp('starts_at').notNull().defaultNow(),
  endsAt: timestamp('ends_at'),
  dismissible: boolean('dismissible').notNull().default(true),
  createdById: uuid('created_by_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [index('announcement_active_idx').on(t.startsAt, t.endsAt)]);

export type Announcement = typeof announcement.$inferSelect;
