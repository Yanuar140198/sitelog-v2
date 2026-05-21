import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { unit, projectFleetAssignment } from '@sitelog/db';
import { audit } from '../lib/audit.js';

const unitInput = z.object({
  nomor: z.string().min(1).max(64),
  fleet: z.string().optional(),
  jenisAlat: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  capacity: z.string().optional(),
  vendor: z.string().optional(),
  ratePerHour: z.number().nonnegative().optional(),
  externalTrackingId: z.string().optional(),
  trackingProvider: z.string().optional(),
});

export const fleetRouter = router({
  unitList: orgProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(unit).where(eq(unit.organizationId, ctx.session.organizationId));
  }),

  unitCreate: requireRole('owner', 'admin', 'scheduler')
    .input(unitInput)
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(unit).values({
        ...input,
        organizationId: ctx.session.organizationId,
        ratePerHour: input.ratePerHour !== undefined ? String(input.ratePerHour) : null,
      }).returning();
      if (row) await audit(ctx, { action: 'unit.create', resource: 'unit', resourceId: row.id, after: { nomor: row.nomor, jenisAlat: row.jenisAlat } });
      return row;
    }),

  unitUpdate: requireRole('owner', 'admin', 'scheduler')
    .input(z.object({ id: z.string().uuid(), data: unitInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      const sets: any = { ...input.data, updatedAt: new Date() };
      if (sets.ratePerHour !== undefined) sets.ratePerHour = String(sets.ratePerHour);
      const [row] = await ctx.db.update(unit).set(sets)
        .where(and(eq(unit.id, input.id), eq(unit.organizationId, ctx.session.organizationId)))
        .returning();
      if (row) await audit(ctx, { action: 'unit.update', resource: 'unit', resourceId: row.id, after: sets });
      return row;
    }),

  unitDelete: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(unit)
        .where(and(eq(unit.id, input.id), eq(unit.organizationId, ctx.session.organizationId)));
      await audit(ctx, { action: 'unit.delete', resource: 'unit', resourceId: input.id });
      return { ok: true };
    }),

  assignments: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.projectFleetAssignment.findMany({
        where: eq(projectFleetAssignment.projectId, input.projectId),
        with: { },
      });
    }),

  assign: requireRole('owner', 'admin', 'scheduler', 'estimator')
    .input(z.object({
      projectId: z.string().uuid(),
      unitId: z.string().uuid(),
      role: z.enum(['primary', 'backup', 'standby', 'spare']).default('primary'),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.select().from(projectFleetAssignment)
        .where(and(eq(projectFleetAssignment.projectId, input.projectId), eq(projectFleetAssignment.unitId, input.unitId)))
        .limit(1);
      if (existing.length > 0) {
        const [row] = await ctx.db.update(projectFleetAssignment).set({
          role: input.role, note: input.note, unassignedAt: null,
        }).where(eq(projectFleetAssignment.id, existing[0]!.id)).returning();
        return row;
      }
      const [row] = await ctx.db.insert(projectFleetAssignment).values({
        ...input,
        assignedById: ctx.session.user.id,
      }).returning();
      if (row) await audit(ctx, { action: 'fleet.assign', resource: 'project_fleet_assignment', resourceId: row.id, after: { unitId: input.unitId, role: input.role } });
      return row;
    }),

  unassign: requireRole('owner', 'admin', 'scheduler', 'estimator')
    .input(z.object({ projectId: z.string().uuid(), unitId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(projectFleetAssignment).set({ unassignedAt: new Date() })
        .where(and(
          eq(projectFleetAssignment.projectId, input.projectId),
          eq(projectFleetAssignment.unitId, input.unitId),
        ));
      await audit(ctx, { action: 'fleet.unassign', resource: 'project_fleet_assignment', after: { unitId: input.unitId } });
      return { ok: true };
    }),
});
