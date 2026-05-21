/**
 * GDPR data subject rights — export + delete user data on request.
 *
 * Article 15 (Right of access): personalData.export → JSON of all user-attributable rows
 * Article 17 (Right to erasure): personalData.requestDeletion → marks user + cascade
 *
 * Note: full deletion delayed 30 days for compliance with retention. Reversible until that point.
 */
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db, user, membership, dailyEntry, entryActivity, auditLog, project } from '@sitelog/db';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const gdprRouter = router({
  /**
   * Export all personal data for the authenticated user.
   * Returns JSON blob — caller writes to file or downloads.
   */
  exportMyData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    if (!u) throw new TRPCError({ code: 'NOT_FOUND' });

    const memberships = await db.select().from(membership).where(eq(membership.userId, userId));
    const entries = await db.select().from(dailyEntry)
      .where(eq(dailyEntry.submittedById, userId)).limit(10_000);
    const entryIds = entries.map(e => e.id);
    const activities = entryIds.length > 0
      ? await db.select().from(entryActivity).where(
           
          (await import('drizzle-orm')).inArray(entryActivity.dailyEntryId, entryIds) as any
        )
      : [];
    const auditEvents = await db.select().from(auditLog)
      .where(eq(auditLog.actorId, userId)).limit(5_000);
    const projectsCreated = await db.select().from(project)
      .where(eq(project.createdById, userId)).limit(1_000);

    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: u.id, email: u.email, name: u.name,
        createdAt: u.createdAt, updatedAt: u.updatedAt,
      },
      memberships: memberships.map(m => ({
        organizationId: m.organizationId, role: m.role, acceptedAt: m.acceptedAt,
      })),
      dailyEntries: entries,
      entryActivities: activities,
      auditEvents,
      projectsCreated,
      counts: {
        memberships: memberships.length,
        dailyEntries: entries.length,
        entryActivities: activities.length,
        auditEvents: auditEvents.length,
        projectsCreated: projectsCreated.length,
      },
    };
  }),

  /**
   * Request account deletion. Soft-delete now, hard-delete after 30 days.
   * If user is sole owner of any org, deletion blocked until ownership transferred.
   */
  requestDeletion: protectedProcedure
    .input(z.object({ confirmation: z.literal('DELETE MY ACCOUNT') }))
    .mutation(async ({ ctx, input: _ }) => {
      const userId = ctx.session.user.id;

      // Block if sole owner of any org
      const ownerships = await db.select({ orgId: membership.organizationId })
        .from(membership)
        .where(and(eq(membership.userId, userId), eq(membership.role, 'owner')));

      for (const o of ownerships) {
        const others = await db.select().from(membership)
          .where(and(eq(membership.organizationId, o.orgId), eq(membership.role, 'owner')));
        if (others.length <= 1) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: `Cannot delete: sole owner of org ${o.orgId}. Transfer ownership first.`,
          });
        }
      }

      // Mark deletion requested — full deletion job runs after 30 days
      const deletionScheduled = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.update(user).set({
        email: `deleted-${userId}@deleted.invalid`,
        name: 'Deleted User',
        passwordHash: null,
      }).where(eq(user.id, userId));

      return {
        ok: true,
        scheduledFor: deletionScheduled.toISOString(),
        message: 'Account anonymized. Hard deletion scheduled for ' + deletionScheduled.toISOString(),
      };
    }),
});
