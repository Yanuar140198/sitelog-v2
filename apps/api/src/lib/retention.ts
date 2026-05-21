/**
 * Audit retention pruning — delete entries older than retention window.
 *
 * Default: 365 days. Override per org via env or future per-org config.
 */
import { db, auditLog, webhookDelivery } from '@sitelog/db';
import { lt, sql } from 'drizzle-orm';

export async function pruneAuditLog(daysToKeep = 365): Promise<{ deletedAudit: number; deletedDeliveries: number }> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  const audit = await db.delete(auditLog).where(lt(auditLog.createdAt, cutoff)).returning();
  // Also prune webhook deliveries older than 30 days
  const webhookCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dels = await db.delete(webhookDelivery).where(lt(webhookDelivery.createdAt, webhookCutoff)).returning();
  return { deletedAudit: audit.length, deletedDeliveries: dels.length };
}
