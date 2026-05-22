/**
 * Material stock + delivery tracking per project.
 *
 * Procedures:
 *   - stockList: balance per material code (received - used)
 *   - stockUpsert: create/update a stock row (PO ordered qty + supplier + unit price)
 *   - deliveryList: history of deliveries (DO/surat jalan log)
 *   - deliveryCreate: record a delivery; atomically increments stock.qty_received
 *   - consume: increment qty_used when material is used on site
 */
import { z } from 'zod';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc.js';
import { materialStock, materialDelivery, project } from '@sitelog/db';

async function assertProjectInOrg(ctx: any, projectId: string) {
  const [row] = await ctx.db.select({ id: project.id }).from(project)
    .where(and(eq(project.id, projectId), eq(project.organizationId, ctx.session.organizationId)))
    .limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
}

export const materialRouter = router({
  stockList: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);
      const rows = await ctx.db.select().from(materialStock)
        .where(eq(materialStock.projectId, input.projectId))
        .orderBy(materialStock.materialCode);
      return rows.map(r => {
        const received = Number(r.qtyReceived);
        const used = Number(r.qtyUsed);
        const ordered = Number(r.qtyOrdered);
        const unitPrice = Number(r.unitPrice);
        return {
          ...r,
          qtyBalance: received - used,
          qtyOutstanding: ordered - received,
          totalValue: received * unitPrice,
        };
      });
    }),

  stockUpsert: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      materialCode: z.string().min(1).max(64),
      materialName: z.string().min(1),
      satuan: z.string().min(1).max(16),
      qtyOrdered: z.number().nonnegative().default(0),
      supplier: z.string().max(160).optional(),
      unitPrice: z.number().nonnegative().default(0),
      resourceMasterId: z.string().uuid().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);
      const [row] = await ctx.db.insert(materialStock).values({
        projectId: input.projectId,
        materialCode: input.materialCode,
        materialName: input.materialName,
        satuan: input.satuan,
        qtyOrdered: input.qtyOrdered.toString(),
        supplier: input.supplier,
        unitPrice: input.unitPrice.toString(),
        resourceMasterId: input.resourceMasterId,
        notes: input.notes,
      }).onConflictDoUpdate({
        target: [materialStock.projectId, materialStock.materialCode],
        set: {
          materialName: input.materialName,
          satuan: input.satuan,
          qtyOrdered: input.qtyOrdered.toString(),
          supplier: input.supplier,
          unitPrice: input.unitPrice.toString(),
          resourceMasterId: input.resourceMasterId,
          notes: input.notes,
          updatedAt: new Date(),
        },
      }).returning();
      return row;
    }),

  deliveryList: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      from: z.string().optional(),  // ISO date
      to: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);
      const where = [eq(materialDelivery.projectId, input.projectId)];
      if (input.from) where.push(gte(materialDelivery.deliveryDate, input.from));
      if (input.to) where.push(lte(materialDelivery.deliveryDate, input.to));
      return ctx.db.select().from(materialDelivery)
        .where(and(...where))
        .orderBy(desc(materialDelivery.deliveryDate), desc(materialDelivery.createdAt));
    }),

  deliveryCreate: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      materialCode: z.string().min(1).max(64),
      qty: z.number().positive(),
      deliveryDate: z.string().min(1),  // ISO date
      doNumber: z.string().max(64).optional(),
      supplier: z.string().max(160).optional(),
      vehiclePlate: z.string().max(32).optional(),
      driverName: z.string().max(120).optional(),
      signedBy: z.string().max(120).optional(),
      unitPrice: z.number().nonnegative().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);

      return ctx.db.transaction(async (tx) => {
        // Find or create stock row for this material code
        let [stock] = await tx.select().from(materialStock)
          .where(and(
            eq(materialStock.projectId, input.projectId),
            eq(materialStock.materialCode, input.materialCode),
          ))
          .limit(1);

        if (!stock) {
          // Auto-create skeleton stock row so delivery can be tracked
          const inserted = await tx.insert(materialStock).values({
            projectId: input.projectId,
            materialCode: input.materialCode,
            materialName: input.materialCode,  // placeholder — PM can rename later
            satuan: '-',
            qtyOrdered: '0',
            supplier: input.supplier,
            unitPrice: (input.unitPrice ?? 0).toString(),
          }).returning();
          stock = inserted[0];
          if (!stock) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create stock row' });
        }

        // Increment received qty
        await tx.update(materialStock)
          .set({
            qtyReceived: sql`${materialStock.qtyReceived} + ${input.qty}`,
            updatedAt: new Date(),
          })
          .where(eq(materialStock.id, stock.id));

        // Insert delivery row
        const [delivery] = await tx.insert(materialDelivery).values({
          projectId: input.projectId,
          stockId: stock.id,
          deliveryDate: input.deliveryDate,
          doNumber: input.doNumber,
          materialCode: input.materialCode,
          qty: input.qty.toString(),
          unitPrice: input.unitPrice !== undefined ? input.unitPrice.toString() : null,
          supplier: input.supplier,
          vehiclePlate: input.vehiclePlate,
          driverName: input.driverName,
          signedBy: input.signedBy,
          notes: input.notes,
          recordedById: ctx.session.user.id,
        }).returning();

        return { delivery, stockId: stock.id };
      });
    }),

  consume: orgProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      materialCode: z.string().min(1).max(64),
      qty: z.number().positive(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);
      const [updated] = await ctx.db.update(materialStock)
        .set({
          qtyUsed: sql`${materialStock.qtyUsed} + ${input.qty}`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(materialStock.projectId, input.projectId),
          eq(materialStock.materialCode, input.materialCode),
        ))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Material stock row not found' });
      const balance = Number(updated.qtyReceived) - Number(updated.qtyUsed);
      return { id: updated.id, qtyBalance: balance, qtyUsed: Number(updated.qtyUsed) };
    }),
});
