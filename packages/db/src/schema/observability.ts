/**
 * Error log — captures runtime errors (server + client) for debugging / QA.
 * No FKs on org/user: errors can happen pre-auth or reference deleted rows.
 */
import { pgTable, text, varchar, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const errorLog = pgTable('error_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: varchar('source', { length: 16 }).notNull(),   // client | trpc | rest | server
  level: varchar('level', { length: 16 }).notNull().default('error'),
  message: text('message').notNull(),
  stack: text('stack'),
  path: text('path'),                                    // tRPC path or URL path
  method: varchar('method', { length: 8 }),
  status: integer('status'),
  url: text('url'),
  userAgent: text('user_agent'),
  organizationId: uuid('organization_id'),
  userId: uuid('user_id'),
  requestId: varchar('request_id', { length: 64 }),
  context: text('context'),                              // JSON string
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [index('error_log_created_idx').on(t.createdAt)]);

export type ErrorLog = typeof errorLog.$inferSelect;
