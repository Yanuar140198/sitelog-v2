/**
 * BOQ template library — reusable scope packs.
 *
 *   - Org templates (visible only to org members)
 *   - Public templates (organizationId NULL — industry-standard scaffolds)
 *
 * Apply template to project: bulk insert boq_item rows from template.items JSON.
 */
import { z } from 'zod';
import { and, eq, or, isNull, asc } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { boqTemplate, boqItem, project, ahspItem } from '@sitelog/db';
import { TRPCError } from '@trpc/server';

interface TemplateScope {
  ahspKode: string;       // e.g. 'CL-LC-001' or 'AHSP-1'
  defaultQty: number;
  note?: string;
}

export const boqTemplateRouter = router({
  list: orgProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conds = [
        or(isNull(boqTemplate.organizationId), eq(boqTemplate.organizationId, ctx.session.organizationId)),
      ];
      if (input?.category) conds.push(eq(boqTemplate.category, input.category));
      return ctx.db.select().from(boqTemplate)
        .where(and(...conds))
        .orderBy(asc(boqTemplate.name));
    }),

  detail: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db.select().from(boqTemplate)
        .where(and(
          eq(boqTemplate.id, input.id),
          or(isNull(boqTemplate.organizationId), eq(boqTemplate.organizationId, ctx.session.organizationId)),
        )).limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      let items: TemplateScope[] = [];
      try { items = JSON.parse(row.items); } catch {}
      return { ...row, scopes: items };
    }),

  create: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      name: z.string().min(1).max(128),
      description: z.string().optional(),
      category: z.string().optional(),
      scopes: z.array(z.object({
        ahspKode: z.string(),
        defaultQty: z.number().nonnegative(),
        note: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(boqTemplate).values({
        organizationId: ctx.session.organizationId,
        name: input.name,
        description: input.description,
        category: input.category,
        items: JSON.stringify(input.scopes),
        createdById: ctx.session.user.id,
      }).returning();
      return row;
    }),

  delete: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(boqTemplate)
        .where(and(eq(boqTemplate.id, input.id), eq(boqTemplate.organizationId, ctx.session.organizationId)));
      return { ok: true };
    }),

  /** Apply template to project — bulk insert. Skips kodes already present. */
  applyToProject: requireRole('owner', 'admin', 'estimator')
    .input(z.object({ templateId: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [tpl] = await ctx.db.select().from(boqTemplate)
        .where(and(
          eq(boqTemplate.id, input.templateId),
          or(isNull(boqTemplate.organizationId), eq(boqTemplate.organizationId, ctx.session.organizationId)),
        )).limit(1);
      if (!tpl) throw new TRPCError({ code: 'NOT_FOUND' });
      const [proj] = await ctx.db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: 'NOT_FOUND' });

      let scopes: TemplateScope[] = [];
      try { scopes = JSON.parse(tpl.items); } catch {}

      const existing = await ctx.db.select({ id: boqItem.ahspItemId }).from(boqItem)
        .where(eq(boqItem.projectId, input.projectId));
      const existingIds = new Set(existing.map(e => e.id));

      let added = 0, missing = 0;
      for (const s of scopes) {
        const [a] = await ctx.db.select({ id: ahspItem.id }).from(ahspItem)
          .where(eq(ahspItem.kode, s.ahspKode)).limit(1);
        if (!a) { missing++; continue; }
        if (existingIds.has(a.id)) continue;
        await ctx.db.insert(boqItem).values({
          projectId: input.projectId,
          ahspItemId: a.id,
          quantity: String(s.defaultQty),
          note: s.note,
          createdById: ctx.session.user.id,
        });
        added++;
      }
      return { added, missing, total: scopes.length };
    }),

  /** Snapshot project's current BOQ as a new template. */
  saveFromProject: requireRole('owner', 'admin', 'estimator')
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().optional(),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select({
        kode: ahspItem.kode, quantity: boqItem.quantity, note: boqItem.note,
      }).from(boqItem)
        .innerJoin(ahspItem, eq(boqItem.ahspItemId, ahspItem.id))
        .where(eq(boqItem.projectId, input.projectId));
      const scopes: TemplateScope[] = rows.map(r => ({
        ahspKode: r.kode,
        defaultQty: Number(r.quantity ?? 0),
        note: r.note ?? undefined,
      }));
      const [tpl] = await ctx.db.insert(boqTemplate).values({
        organizationId: ctx.session.organizationId,
        name: input.name,
        description: input.description,
        category: input.category,
        items: JSON.stringify(scopes),
        createdById: ctx.session.user.id,
      }).returning();
      return { ...tpl, scopesCount: scopes.length };
    }),
});
