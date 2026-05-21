/**
 * Unit maintenance schedule + history.
 */
import { z } from 'zod';
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { unitMaintenance, unit } from '@sitelog/db';
import { TRPCError } from '@trpc/server';

const KIND = ['scheduled', 'breakdown', 'inspection', 'oil_change', 'tire', 'overhaul'] as const;

export const maintenanceRouter = router({
  listByUnit: orgProcedure
    .input(z.object({ unitId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [u] = await ctx.db.select().from(unit)
        .where(and(eq(unit.id, input.unitId), eq(unit.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!u) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.db.select().from(unitMaintenance)
        .where(eq(unitMaintenance.unitId, input.unitId))
        .orderBy(desc(unitMaintenance.dueAtDate), desc(unitMaintenance.createdAt));
    }),

  /** Upcoming + overdue across all org units */
  upcoming: orgProcedure
    .input(z.object({ horizonDays: z.number().default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const horizon = new Date(Date.now() + (input?.horizonDays ?? 30) * 24 * 60 * 60 * 1000);
      const rows = await ctx.db.select({
        m: unitMaintenance,
        unitNomor: unit.nomor, unitJenis: unit.jenisAlat,
      })
        .from(unitMaintenance)
        .innerJoin(unit, eq(unitMaintenance.unitId, unit.id))
        .where(and(
          eq(unit.organizationId, ctx.session.organizationId),
          or(eq(unitMaintenance.status, 'planned'), eq(unitMaintenance.status, 'overdue')),
          isNull(unitMaintenance.performedAt),
        ))
        .orderBy(asc(unitMaintenance.dueAtDate));
      return rows.filter(r => !r.m.dueAtDate || new Date(r.m.dueAtDate) <= horizon);
    }),

  create: requireRole('owner', 'admin', 'scheduler')
    .input(z.object({
      unitId: z.string().uuid(),
      kind: z.enum(KIND),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      dueAtHm: z.number().optional(),
      dueAtDate: z.date().optional(),
      intervalHm: z.number().optional(),
      intervalDays: z.number().int().optional(),
      vendor: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [u] = await ctx.db.select().from(unit)
        .where(and(eq(unit.id, input.unitId), eq(unit.organizationId, ctx.session.organizationId))).limit(1);
      if (!u) throw new TRPCError({ code: 'NOT_FOUND' });
      const [row] = await ctx.db.insert(unitMaintenance).values({
        unitId: input.unitId, kind: input.kind, title: input.title,
        description: input.description,
        dueAtHm: input.dueAtHm !== undefined ? String(input.dueAtHm) : null,
        dueAtDate: input.dueAtDate ?? null,
        intervalHm: input.intervalHm !== undefined ? String(input.intervalHm) : null,
        intervalDays: input.intervalDays ?? null,
        vendor: input.vendor,
      }).returning();
      return row;
    }),

  markCompleted: requireRole('owner', 'admin', 'scheduler')
    .input(z.object({
      id: z.string().uuid(),
      performedAtHm: z.number().optional(),
      cost: z.number().optional(),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.update(unitMaintenance).set({
        status: 'completed',
        performedAt: new Date(),
        performedAtHm: input.performedAtHm !== undefined ? String(input.performedAtHm) : null,
        cost: input.cost !== undefined ? String(input.cost) : null,
        note: input.note,
        updatedAt: new Date(),
      }).where(eq(unitMaintenance.id, input.id)).returning();

      // Recurring: spawn next occurrence
      if (row && (row.intervalDays || row.intervalHm)) {
        const nextDate = row.intervalDays && row.dueAtDate
          ? new Date(new Date(row.dueAtDate).getTime() + row.intervalDays * 24 * 60 * 60 * 1000)
          : null;
        const nextHm = row.intervalHm && input.performedAtHm
          ? input.performedAtHm + Number(row.intervalHm) : null;
        await ctx.db.insert(unitMaintenance).values({
          unitId: row.unitId, kind: row.kind, title: row.title, description: row.description,
          dueAtDate: nextDate, dueAtHm: nextHm !== null ? String(nextHm) : null,
          intervalDays: row.intervalDays, intervalHm: row.intervalHm,
          vendor: row.vendor,
        });
      }
      return row;
    }),

  cancel: requireRole('owner', 'admin', 'scheduler')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(unitMaintenance).set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(unitMaintenance.id, input.id));
      return { ok: true };
    }),
});
