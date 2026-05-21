import { z } from 'zod';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { project } from '@sitelog/db';
import { TRPCError } from '@trpc/server';
import { assertProjectQuota } from '../lib/plan-limits.js';
import { audit } from '../lib/audit.js';
import { dispatchEvent } from '../lib/webhooks.js';

const projectInput = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  client: z.string().max(255).optional(),
  location: z.string().optional(),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'archived']).default('planning'),
  startDate: z.string().min(1).optional().or(z.literal('').transform(() => undefined)),
  finishDate: z.string().min(1).optional().or(z.literal('').transform(() => undefined)),
  durationDays: z.number().nonnegative().optional(),
  fleetDesign: z.string().optional(),
  planLandClearing: z.number().nonnegative().default(0),
  planCutSoil: z.number().nonnegative().default(0),
  planCutRock: z.number().nonnegative().default(0),
  planFill: z.number().nonnegative().default(0),
  targetCutDaily: z.number().nonnegative().default(0),
  targetFillDaily: z.number().nonnegative().default(0),
  markupPct: z.number().min(0).max(100).default(0),
  contingencyPct: z.number().min(0).max(100).default(0),
  ppnPct: z.number().min(0).max(100).default(11),
});

export const projectRouter = router({
  list: orgProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where = and(
        eq(project.organizationId, ctx.session.organizationId),
        isNull(project.deletedAt),
        input?.status ? eq(project.status, input.status as any) : undefined,
      );
      return ctx.db.select().from(project).where(where).orderBy(desc(project.updatedAt));
    }),

  get: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db.select().from(project)
        .where(and(eq(project.id, input.id), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return row;
    }),

  create: requireRole('owner', 'admin', 'estimator')
    .input(projectInput)
    .mutation(async ({ ctx, input }) => {
      await assertProjectQuota(ctx.session.organizationId);
      const { durationDays, ...rest } = input;
      const [row] = await ctx.db.insert(project).values({
        ...rest,
        organizationId: ctx.session.organizationId,
        createdById: ctx.session.user.id,
        durationDays: durationDays !== undefined ? String(durationDays) : null,
        planLandClearing: String(input.planLandClearing),
        planCutSoil: String(input.planCutSoil),
        planCutRock: String(input.planCutRock),
        planFill: String(input.planFill),
        targetCutDaily: String(input.targetCutDaily),
        targetFillDaily: String(input.targetFillDaily),
        markupPct: String(input.markupPct),
        contingencyPct: String(input.contingencyPct),
        ppnPct: String(input.ppnPct),
      }).returning();
      if (row) {
        await audit(ctx, { action: 'project.create', resource: 'project', resourceId: row.id, after: { code: row.code, name: row.name } });
        dispatchEvent(ctx.session.organizationId, 'project.created', { id: row.id, code: row.code, name: row.name }).catch(() => {});
      }
      return row;
    }),

  update: requireRole('owner', 'admin', 'estimator')
    .input(z.object({ id: z.string().uuid(), data: projectInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      const sets: any = { ...input.data, updatedAt: new Date() };
      for (const k of ['durationDays','planLandClearing','planCutSoil','planCutRock','planFill','targetCutDaily','targetFillDaily','markupPct','contingencyPct','ppnPct']) {
        if (sets[k] !== undefined) sets[k] = String(sets[k]);
      }
      const [row] = await ctx.db.update(project).set(sets)
        .where(and(eq(project.id, input.id), eq(project.organizationId, ctx.session.organizationId)))
        .returning();
      if (row) await audit(ctx, { action: 'project.update', resource: 'project', resourceId: row.id, after: sets });
      return row;
    }),

  archive: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(project).set({ deletedAt: new Date() })
        .where(and(eq(project.id, input.id), eq(project.organizationId, ctx.session.organizationId)));
      await audit(ctx, { action: 'project.archive', resource: 'project', resourceId: input.id });
      return { ok: true };
    }),

  bulkArchive: requireRole('owner', 'admin')
    .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { inArray } = await import('drizzle-orm');
      await ctx.db.update(project).set({ deletedAt: new Date() })
        .where(and(eq(project.organizationId, ctx.session.organizationId), inArray(project.id, input.ids)));
      await audit(ctx, { action: 'project.bulk_archive', resource: 'project', after: { count: input.ids.length } });
      return { ok: true, archived: input.ids.length };
    }),

  bulkUpdateStatus: requireRole('owner', 'admin')
    .input(z.object({
      ids: z.array(z.string().uuid()).min(1),
      status: z.enum(['planning', 'active', 'on_hold', 'completed', 'archived']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { inArray } = await import('drizzle-orm');
      await ctx.db.update(project).set({ status: input.status, updatedAt: new Date() })
        .where(and(eq(project.organizationId, ctx.session.organizationId), inArray(project.id, input.ids)));
      await audit(ctx, { action: 'project.bulk_status', resource: 'project', after: { status: input.status, count: input.ids.length } });
      return { ok: true, updated: input.ids.length };
    }),
});
