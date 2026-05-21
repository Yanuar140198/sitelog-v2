import { z } from 'zod';
import { and, eq, or, isNull, asc } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { ahspItem, ahspInput, ahspKoefisien, ahspResource } from '@sitelog/db';
import { TRPCError } from '@trpc/server';

export const ahspRouter = router({
  // Catalog visible to org: global (orgId NULL) + org-owned items
  catalog: orgProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ ctx }) => {
      return ctx.db.select().from(ahspItem)
        .where(or(
          isNull(ahspItem.organizationId),
          eq(ahspItem.organizationId, ctx.session.organizationId),
        ))
        .orderBy(asc(ahspItem.section), asc(ahspItem.kode));
    }),

  detail: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.db.select().from(ahspItem)
        .where(and(
          eq(ahspItem.id, input.id),
          or(isNull(ahspItem.organizationId), eq(ahspItem.organizationId, ctx.session.organizationId)),
        ))
        .limit(1);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
      const [inputs, koef, resources] = await Promise.all([
        ctx.db.select().from(ahspInput).where(eq(ahspInput.ahspItemId, item.id)).orderBy(asc(ahspInput.ordinal)),
        ctx.db.select().from(ahspKoefisien).where(eq(ahspKoefisien.ahspItemId, item.id)).orderBy(asc(ahspKoefisien.ordinal)),
        ctx.db.select().from(ahspResource).where(eq(ahspResource.ahspItemId, item.id)).orderBy(asc(ahspResource.category), asc(ahspResource.ordinal)),
      ]);
      return { item, inputs, koefisien: koef, resources };
    }),

  // Create custom org-scoped AHSP item
  create: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      kode: z.string().min(1).max(32),
      label: z.string().optional(),
      section: z.string().optional(),
      jenis: z.string().min(1),
      satuan: z.string().min(1),
      ohpPct: z.number().min(0).max(100).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(ahspItem).values({
        ...input,
        organizationId: ctx.session.organizationId,
        ohpPct: String(input.ohpPct),
      }).returning();
      return row;
    }),

  update: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      id: z.string().uuid(),
      data: z.object({
        kode: z.string().optional(),
        label: z.string().optional(),
        section: z.string().optional(),
        jenis: z.string().optional(),
        satuan: z.string().optional(),
        ohpPct: z.number().min(0).max(100).optional(),
        deskripsi: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const sets: any = { ...input.data, updatedAt: new Date() };
      if (sets.ohpPct !== undefined) sets.ohpPct = String(sets.ohpPct);
      const [row] = await ctx.db.update(ahspItem).set(sets)
        .where(and(eq(ahspItem.id, input.id), eq(ahspItem.organizationId, ctx.session.organizationId)))
        .returning();
      return row;
    }),

  delete: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(ahspItem)
        .where(and(eq(ahspItem.id, input.id), eq(ahspItem.organizationId, ctx.session.organizationId)));
      return { ok: true };
    }),

  resourceUpsert: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      ahspItemId: z.string().uuid(),
      id: z.string().uuid().optional(),
      category: z.enum(['tenaga', 'bahan', 'peralatan']),
      ordinal: z.number().int().default(0),
      resourceCode: z.string().min(1),
      uraian: z.string().min(1),
      koefisien: z.number(),
      satuan: z.string().optional(),
      hsd: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ahsp item belongs to org
      const [own] = await ctx.db.select().from(ahspItem)
        .where(and(eq(ahspItem.id, input.ahspItemId), eq(ahspItem.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!own) throw new TRPCError({ code: 'FORBIDDEN', message: 'Can only edit org-owned AHSP items' });
      const values = {
        ahspItemId: input.ahspItemId,
        category: input.category,
        ordinal: input.ordinal,
        resourceCode: input.resourceCode,
        uraian: input.uraian,
        koefisien: String(input.koefisien),
        satuan: input.satuan,
        hsd: String(input.hsd),
      };
      if (input.id) {
        const [row] = await ctx.db.update(ahspResource).set(values).where(eq(ahspResource.id, input.id)).returning();
        return row;
      }
      const [row] = await ctx.db.insert(ahspResource).values(values).returning();
      return row;
    }),

  resourceDelete: requireRole('owner', 'admin', 'estimator')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(ahspResource).where(eq(ahspResource.id, input.id));
      return { ok: true };
    }),
});
