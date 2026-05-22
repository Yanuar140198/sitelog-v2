/**
 * Resource Master tRPC router — manages centralized HSD library.
 *
 * - Global resources (organizationId NULL) are visible to all orgs (read-only here).
 * - Org-owned resources can be created/updated/deleted by org admins.
 * - Regional prices override default_hsd per region with effective_from cutoff.
 */
import { z } from 'zod';
import { and, desc, eq, isNull, or, sql, asc, ilike, lte } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { resourceMaster, resourceMasterPrice } from '@sitelog/db';

const categorySchema = z.enum(['tenaga', 'bahan', 'peralatan']);

export const resourceMasterRouter = router({
  /**
   * List resources visible to the active org: globals (orgId NULL) + own org.
   * If region given, augments each row with `regionHsd` (latest effective price).
   */
  list: orgProcedure
    .input(z.object({
      category: categorySchema.optional(),
      q: z.string().optional(),
      region: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where = [
        or(isNull(resourceMaster.organizationId), eq(resourceMaster.organizationId, ctx.session.organizationId)),
      ];
      if (input?.category) where.push(eq(resourceMaster.category, input.category));
      if (input?.q && input.q.trim()) {
        const q = `%${input.q.trim()}%`;
        where.push(or(ilike(resourceMaster.kode, q), ilike(resourceMaster.nama, q))!);
      }

      const rows = await ctx.db.select().from(resourceMaster)
        .where(and(...where))
        .orderBy(asc(resourceMaster.category), asc(resourceMaster.kode));

      // Compute effectiveHsd: region price (latest effective_from <= today) OR default
      const region = input?.region?.trim();
      if (!region || rows.length === 0) {
        return rows.map(r => ({ ...r, regionHsd: null as string | null, effectiveHsd: r.defaultHsd }));
      }

      const ids = rows.map(r => r.id);
      const prices = await ctx.db.select().from(resourceMasterPrice)
        .where(and(
          sql`${resourceMasterPrice.resourceId} = ANY(${ids})`,
          eq(resourceMasterPrice.region, region),
          lte(resourceMasterPrice.effectiveFrom, sql`CURRENT_DATE`),
        ))
        .orderBy(desc(resourceMasterPrice.effectiveFrom));

      const latestByResource = new Map<string, string>();
      for (const p of prices) {
        if (!latestByResource.has(p.resourceId)) latestByResource.set(p.resourceId, p.hsd);
      }

      return rows.map(r => {
        const regionHsd = latestByResource.get(r.id) ?? null;
        return { ...r, regionHsd, effectiveHsd: regionHsd ?? r.defaultHsd };
      });
    }),

  create: requireRole('owner', 'admin')
    .input(z.object({
      kode: z.string().min(1).max(32),
      nama: z.string().min(1),
      category: categorySchema,
      satuan: z.string().min(1).max(16),
      defaultHsd: z.number().nonnegative(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(resourceMaster).values({
        organizationId: ctx.session.organizationId,
        kode: input.kode,
        nama: input.nama,
        category: input.category,
        satuan: input.satuan,
        defaultHsd: input.defaultHsd.toString(),
        notes: input.notes,
      }).returning();
      return row;
    }),

  update: requireRole('owner', 'admin')
    .input(z.object({
      id: z.string().uuid(),
      kode: z.string().min(1).max(32).optional(),
      nama: z.string().min(1).optional(),
      category: categorySchema.optional(),
      satuan: z.string().min(1).max(16).optional(),
      defaultHsd: z.number().nonnegative().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, defaultHsd, ...rest } = input;
      // Only allow updating org-owned rows
      const [existing] = await ctx.db.select().from(resourceMaster)
        .where(and(eq(resourceMaster.id, id), eq(resourceMaster.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found or not owned by org' });

      const patch: Record<string, unknown> = { ...rest, updatedAt: new Date() };
      if (defaultHsd !== undefined) patch.defaultHsd = defaultHsd.toString();

      const [row] = await ctx.db.update(resourceMaster).set(patch)
        .where(eq(resourceMaster.id, id))
        .returning();
      return row;
    }),

  delete: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.db.delete(resourceMaster)
        .where(and(eq(resourceMaster.id, input.id), eq(resourceMaster.organizationId, ctx.session.organizationId)))
        .returning();
      if (res.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Resource not found or not owned by org' });
      return { ok: true };
    }),

  setPrice: requireRole('owner', 'admin')
    .input(z.object({
      resourceId: z.string().uuid(),
      region: z.string().min(1).max(64),
      hsd: z.number().nonnegative(),
      effectiveFrom: z.string().optional(),  // ISO date string
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource exists and is accessible to org (global or own)
      const [res] = await ctx.db.select().from(resourceMaster)
        .where(and(
          eq(resourceMaster.id, input.resourceId),
          or(isNull(resourceMaster.organizationId), eq(resourceMaster.organizationId, ctx.session.organizationId)),
        ))
        .limit(1);
      if (!res) throw new TRPCError({ code: 'NOT_FOUND' });

      const [row] = await ctx.db.insert(resourceMasterPrice).values({
        resourceId: input.resourceId,
        region: input.region.toUpperCase(),
        hsd: input.hsd.toString(),
        effectiveFrom: input.effectiveFrom ?? new Date().toISOString().slice(0, 10),
        notes: input.notes,
      }).returning();
      return row;
    }),

  priceHistory: orgProcedure
    .input(z.object({
      resourceId: z.string().uuid(),
      region: z.string().min(1).max(64),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.select().from(resourceMasterPrice)
        .where(and(
          eq(resourceMasterPrice.resourceId, input.resourceId),
          eq(resourceMasterPrice.region, input.region.toUpperCase()),
        ))
        .orderBy(desc(resourceMasterPrice.effectiveFrom));
    }),
});
