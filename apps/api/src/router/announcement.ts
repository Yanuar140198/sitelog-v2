/**
 * Platform announcement banner.
 * - Public list (active only) for app shell banner
 * - Super-admin CRUD
 */
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc.js';
import { db, announcement } from '@sitelog/db';
import { and, gte, lte, isNull, or, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

function assertSuperAdmin(email: string) {
  const allow = (process.env.SITELOG_ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!allow.includes(email.toLowerCase())) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a Sitelog super-admin' });
  }
}

export const announcementRouter = router({
  /** Public — current active announcements for any authenticated user. */
  active: protectedProcedure.query(async () => {
    const now = new Date();
    return db.select().from(announcement)
      .where(and(
        lte(announcement.startsAt, now),
        or(isNull(announcement.endsAt), gte(announcement.endsAt, now)),
      ))
      .orderBy(desc(announcement.createdAt));
  }),

  /** Super-admin: list all (incl. expired). */
  listAll: protectedProcedure.query(async ({ ctx }) => {
    assertSuperAdmin(ctx.session.user.email);
    return db.select().from(announcement).orderBy(desc(announcement.createdAt)).limit(100);
  }),

  /** Super-admin: create. */
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(120),
      body: z.string().min(1).max(2000),
      severity: z.enum(['info', 'warning', 'critical']).default('info'),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional(),
      dismissible: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      assertSuperAdmin(ctx.session.user.email);
      const [row] = await db.insert(announcement).values({
        title: input.title,
        body: input.body,
        severity: input.severity,
        startsAt: input.startsAt ? new Date(input.startsAt) : new Date(),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        dismissible: input.dismissible,
        createdById: ctx.session.user.id,
      }).returning();
      return row;
    }),

  /** Super-admin: delete (hard). */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      assertSuperAdmin(ctx.session.user.email);
      await db.execute(sql`DELETE FROM announcement WHERE id = ${input.id}`);
      // eq variant works too — execute is simpler here
      return { ok: true };
    }),
});

export type AnnouncementRouter = typeof announcementRouter;
