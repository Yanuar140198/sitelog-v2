import { pgTable, text, boolean, integer, timestamp, uuid, primaryKey, index } from 'drizzle-orm/pg-core';
import { organization } from './tenancy';

export const featureFlag = pgTable('feature_flag', {
  key: text('key').primaryKey(),
  description: text('description'),
  enabledGlobally: boolean('enabled_globally').notNull().default(false),
  rolloutPct: integer('rollout_pct').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const featureFlagOverride = pgTable('feature_flag_override', {
  organizationId: uuid('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  flagKey: text('flag_key').notNull().references(() => featureFlag.key, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.organizationId, t.flagKey] }),
  index('feature_flag_override_org_idx').on(t.organizationId),
]);

export type FeatureFlag = typeof featureFlag.$inferSelect;
export type FeatureFlagOverride = typeof featureFlagOverride.$inferSelect;
