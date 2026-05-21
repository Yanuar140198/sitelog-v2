/**
 * BOQ version snapshots — revision history per project.
 *
 * Use cases:
 *   - Before bidding: snapshot current BOQ → submit
 *   - Compare estimator iterations
 *   - Restore to past version
 */
import { z } from 'zod';
import { and, eq, desc, max } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { boqVersion, boqItem, boqResourceOverride, project } from '@sitelog/db';
import { TRPCError } from '@trpc/server';

export const boqVersionRouter = router({
  list: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(boqVersion)
        .where(eq(boqVersion.projectId, input.projectId))
        .orderBy(desc(boqVersion.versionNumber));
    }),

  snapshot: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      projectId: z.string().uuid(),
      label: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
      const [proj] = await ctx.db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      const items = await ctx.db.select().from(boqItem).where(eq(boqItem.projectId, input.projectId));
      const overrides = await ctx.db.select().from(boqResourceOverride).where(eq(boqResourceOverride.projectId, input.projectId));

      const [maxRow] = await ctx.db.select({ m: max(boqVersion.versionNumber) }).from(boqVersion)
        .where(eq(boqVersion.projectId, input.projectId));
      const next = (maxRow?.m ?? 0) + 1;

      const snapshot = JSON.stringify({
        savedAt: new Date().toISOString(),
        project: {
          code: proj.code, name: proj.name,
          markupPct: proj.markupPct, contingencyPct: proj.contingencyPct, ppnPct: proj.ppnPct,
        },
        items, overrides,
      });

      const [row] = await ctx.db.insert(boqVersion).values({
        projectId: input.projectId,
        versionNumber: next,
        label: input.label ?? `v${next}`,
        notes: input.notes,
        snapshot,
        createdById: ctx.session.user.id,
      }).returning();
      return row;
    }),

  diff: orgProcedure
    .input(z.object({ versionAId: z.string().uuid(), versionBId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [a, b] = await Promise.all([
        ctx.db.select().from(boqVersion).where(eq(boqVersion.id, input.versionAId)).limit(1),
        ctx.db.select().from(boqVersion).where(eq(boqVersion.id, input.versionBId)).limit(1),
      ]);
      if (!a[0] || !b[0]) throw new TRPCError({ code: 'NOT_FOUND' });
      const sa = JSON.parse(a[0].snapshot);
      const sb = JSON.parse(b[0].snapshot);
      const mapA = new Map<string, any>((sa.items ?? []).map((it: any) => [it.ahspItemId, it]));
      const mapB = new Map<string, any>((sb.items ?? []).map((it: any) => [it.ahspItemId, it]));
      const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
      const lines = [...allKeys].map(k => {
        const ia = mapA.get(k); const ib = mapB.get(k);
        let status: 'added' | 'removed' | 'changed' | 'same' = 'same';
        if (!ia) status = 'added';
        else if (!ib) status = 'removed';
        else if (String(ia.quantity) !== String(ib.quantity) || String(ia.unitRateOverride ?? '') !== String(ib.unitRateOverride ?? '')) status = 'changed';
        return {
          ahspItemId: k,
          status,
          a: ia ? { quantity: Number(ia.quantity), unitRateOverride: ia.unitRateOverride !== null && ia.unitRateOverride !== undefined ? Number(ia.unitRateOverride) : null } : null,
          b: ib ? { quantity: Number(ib.quantity), unitRateOverride: ib.unitRateOverride !== null && ib.unitRateOverride !== undefined ? Number(ib.unitRateOverride) : null } : null,
        };
      });
      const counts = { added: 0, removed: 0, changed: 0, same: 0 };
      for (const l of lines) counts[l.status]++;
      const sumOf = (items: any[]) => (items ?? []).reduce((acc, it) =>
        acc + Number(it.quantity ?? 0) * Number(it.unitRateOverride ?? 0), 0);
      const subA = sumOf(sa.items);
      const subB = sumOf(sb.items);
      const totals = {
        subtotalA: Math.round(subA),
        subtotalB: Math.round(subB),
        delta: Math.round(subB - subA),
        deltaPct: subA > 0 ? Math.round(((subB - subA) / subA) * 1000) / 10 : 0,
      };
      return { a: a[0], b: b[0], lines, counts, totals };
    }),

  restore: requireRole('owner', 'admin', 'estimator')
    .input(z.object({ versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [ver] = await ctx.db.select().from(boqVersion)
        .where(eq(boqVersion.id, input.versionId)).limit(1);
      if (!ver) throw new TRPCError({ code: 'NOT_FOUND' });
      const [proj] = await ctx.db.select().from(project)
        .where(and(eq(project.id, ver.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      const snap = JSON.parse(ver.snapshot);
      // Replace current BOQ + overrides with snapshot
      await ctx.db.delete(boqItem).where(eq(boqItem.projectId, ver.projectId));
      await ctx.db.delete(boqResourceOverride).where(eq(boqResourceOverride.projectId, ver.projectId));
      if (snap.items?.length) {
        await ctx.db.insert(boqItem).values(snap.items.map((it: any) => ({
          projectId: ver.projectId,
          ahspItemId: it.ahspItemId,
          quantity: it.quantity,
          unitRateOverride: it.unitRateOverride,
          note: it.note,
          ordinal: it.ordinal ?? 0,
        })));
      }
      if (snap.overrides?.length) {
        await ctx.db.insert(boqResourceOverride).values(snap.overrides.map((o: any) => ({
          projectId: ver.projectId,
          ahspItemId: o.ahspItemId,
          resourceCode: o.resourceCode,
          koefisien: o.koefisien,
          hsd: o.hsd,
          note: o.note,
        })));
      }
      return { ok: true, restored: ver.versionNumber };
    }),
});
