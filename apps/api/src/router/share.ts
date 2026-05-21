/**
 * Public read-only share links per project.
 *
 * Token-gated, no auth required for view.
 */
import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { router, requireRole, publicProcedure } from '../trpc.js';
import { publicShare, project, boqItem, dailyEntry, entryActivity } from '@sitelog/db';
import { TRPCError } from '@trpc/server';
import { randomBytes } from 'node:crypto';

const N = (v: unknown) => Number(v ?? 0);

export const shareRouter = router({
  list: requireRole('owner', 'admin', 'estimator')
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(publicShare).where(eq(publicShare.projectId, input.projectId));
    }),

  create: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      projectId: z.string().uuid(),
      label: z.string().optional(),
      includeKpi: z.boolean().default(true),
      includeEntries: z.boolean().default(false),
      expiresAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
      const [proj] = await ctx.db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });
      const token = randomBytes(24).toString('hex');
      const [row] = await ctx.db.insert(publicShare).values({
        projectId: input.projectId,
        token,
        label: input.label,
        includeKpi: String(input.includeKpi),
        includeEntries: String(input.includeEntries),
        expiresAt: input.expiresAt,
        createdById: ctx.session.user.id,
      }).returning();
      return row;
    }),

  revoke: requireRole('owner', 'admin', 'estimator')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(publicShare).set({ revokedAt: new Date() }).where(eq(publicShare.id, input.id));
      return { ok: true };
    }),

  /** Public viewer — no auth required. */
  view: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const [share] = await ctx.db.select().from(publicShare)
        .where(and(eq(publicShare.token, input.token), isNull(publicShare.revokedAt))).limit(1);
      if (!share) throw new TRPCError({ code: 'NOT_FOUND', message: 'Link invalid or revoked' });
      if (share.expiresAt && share.expiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Link expired' });
      }
      const [proj] = await ctx.db.select().from(project).where(eq(project.id, share.projectId)).limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      // KPI bits
      const boqRows = await ctx.db.select().from(boqItem).where(eq(boqItem.projectId, proj.id));
      const subtotal = boqRows.reduce((a, it) => a + N(it.quantity) * N(it.unitRateOverride ?? 0), 0);

      const actualAgg = await ctx.db
        .select({ ahspItemId: entryActivity.ahspItemId, totalQty: sql<string>`sum(${entryActivity.quantity})` })
        .from(entryActivity).innerJoin(dailyEntry, eq(entryActivity.dailyEntryId, dailyEntry.id))
        .where(eq(dailyEntry.projectId, proj.id))
        .groupBy(entryActivity.ahspItemId);
      const actMap = new Map(actualAgg.map(r => [r.ahspItemId, N(r.totalQty)]));
      let earned = 0;
      for (const it of boqRows) {
        const planned = N(it.quantity); if (planned <= 0) continue;
        const actual = actMap.get(it.ahspItemId) ?? 0;
        earned += Math.min(1, actual / planned) * planned * N(it.unitRateOverride ?? 0);
      }
      const progressPct = subtotal > 0 ? (earned / subtotal) * 100 : 0;

      return {
        share: { label: share.label, createdAt: share.createdAt },
        project: {
          code: proj.code, name: proj.name, client: proj.client,
          location: proj.location, status: proj.status,
          startDate: proj.startDate, finishDate: proj.finishDate,
        },
        kpi: share.includeKpi === 'true' ? {
          subtotal: Math.round(subtotal),
          earned: Math.round(earned),
          progressPct: Math.round(progressPct * 10) / 10,
          scopeCount: boqRows.length,
        } : null,
      };
    }),
});
