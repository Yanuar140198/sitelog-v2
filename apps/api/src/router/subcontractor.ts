/**
 * Subcontractor (subkontraktor) router — org-level master + per-project
 * contracts + invoice ledger.
 *
 * Procedures:
 *   - list / create / update / delete: org-level subcontractor master
 *   - contractsList / contractCreate / contractDetail: per-project SPK
 *   - invoiceList / invoiceCreate / invoiceUpdate: progress claims
 *   - invoiceApprove / invoiceMarkPaid: status transitions (admin-only)
 *   - summary: total contract value / invoiced / paid / outstanding per project
 *
 * Authorization:
 *  - read endpoints: any org member (orgProcedure)
 *  - master mutate + approve/markPaid: owner|admin (requireRole)
 *  - contract create + invoice create/update: any org member
 *    (PM creates contracts; site team / subcon coordinator submits invoices)
 */
import { z } from 'zod';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure, requireRole } from '../trpc.js';
import {
  subcontractor,
  subcontract,
  subcontractorInvoice,
  project,
} from '@sitelog/db';

async function assertProjectInOrg(ctx: any, projectId: string) {
  const [row] = await ctx.db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.organizationId, ctx.session.organizationId)))
    .limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
}

async function assertSubcontractorInOrg(ctx: any, id: string) {
  const [row] = await ctx.db
    .select({ id: subcontractor.id })
    .from(subcontractor)
    .where(and(eq(subcontractor.id, id), eq(subcontractor.organizationId, ctx.session.organizationId)))
    .limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Subcontractor not found' });
}

/** Verify the subcontract belongs to a project in caller's org; return contract + projectId. */
async function assertSubcontractInOrg(ctx: any, subcontractId: string) {
  const [row] = await ctx.db
    .select({ id: subcontract.id, projectId: subcontract.projectId })
    .from(subcontract)
    .innerJoin(project, eq(project.id, subcontract.projectId))
    .where(and(
      eq(subcontract.id, subcontractId),
      eq(project.organizationId, ctx.session.organizationId),
    ))
    .limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Subcontract not found' });
  return row;
}

const invoiceStatusEnum = z.enum(['draft', 'submitted', 'verified', 'approved', 'paid', 'rejected']);

export const subcontractorRouter = router({
  // ---------------------------------------------------------------------------
  // Master: subcontractor (org-level)
  // ---------------------------------------------------------------------------

  list: orgProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(subcontractor)
      .where(eq(subcontractor.organizationId, ctx.session.organizationId))
      .orderBy(subcontractor.name),
  ),

  create: requireRole('owner', 'admin')
    .input(z.object({
      name: z.string().min(1).max(200),
      npwp: z.string().max(32).optional(),
      contactPerson: z.string().max(120).optional(),
      phone: z.string().max(32).optional(),
      email: z.string().email().max(160).optional().or(z.literal('')),
      address: z.string().optional(),
      bankName: z.string().max(80).optional(),
      bankAccount: z.string().max(40).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(subcontractor).values({
        organizationId: ctx.session.organizationId,
        name: input.name,
        npwp: input.npwp || null,
        contactPerson: input.contactPerson || null,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        bankName: input.bankName || null,
        bankAccount: input.bankAccount || null,
        notes: input.notes || null,
      }).returning();
      return row;
    }),

  update: requireRole('owner', 'admin')
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      npwp: z.string().max(32).nullable().optional(),
      contactPerson: z.string().max(120).nullable().optional(),
      phone: z.string().max(32).nullable().optional(),
      email: z.string().max(160).nullable().optional(),
      address: z.string().nullable().optional(),
      bankName: z.string().max(80).nullable().optional(),
      bankAccount: z.string().max(40).nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertSubcontractorInOrg(ctx, input.id);
      const { id, ...patch } = input;
      const [row] = await ctx.db.update(subcontractor)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(subcontractor.id, id))
        .returning();
      return row;
    }),

  delete: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertSubcontractorInOrg(ctx, input.id);
      // ON DELETE RESTRICT on subcontract.subcontractor_id will block deletion
      // if any project still references this subcontractor. Surface a friendly error.
      try {
        await ctx.db.delete(subcontractor).where(eq(subcontractor.id, input.id));
      } catch {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Subcontractor is referenced by one or more contracts; remove those first.',
        });
      }
      return { ok: true };
    }),

  // ---------------------------------------------------------------------------
  // Per-project contracts
  // ---------------------------------------------------------------------------

  contractsList: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);
      const rows = await ctx.db
        .select({
          id: subcontract.id,
          projectId: subcontract.projectId,
          subcontractorId: subcontract.subcontractorId,
          subcontractorName: subcontractor.name,
          contractNumber: subcontract.contractNumber,
          scopeDescription: subcontract.scopeDescription,
          contractValue: subcontract.contractValue,
          startDate: subcontract.startDate,
          endDate: subcontract.endDate,
          retentionPct: subcontract.retentionPct,
          notes: subcontract.notes,
          signedAt: subcontract.signedAt,
          createdAt: subcontract.createdAt,
        })
        .from(subcontract)
        .innerJoin(subcontractor, eq(subcontractor.id, subcontract.subcontractorId))
        .where(eq(subcontract.projectId, input.projectId))
        .orderBy(desc(subcontract.createdAt));

      if (rows.length === 0) return [];

      // Aggregate invoice totals per contract
      const ids = rows.map(r => r.id);
      const sums = await ctx.db
        .select({
          subcontractId: subcontractorInvoice.subcontractId,
          invoiced: sql<string>`COALESCE(SUM(${subcontractorInvoice.netAmount}), 0)`,
          paid: sql<string>`COALESCE(SUM(CASE WHEN ${subcontractorInvoice.status} = 'paid' THEN ${subcontractorInvoice.paidAmount} ELSE 0 END), 0)`,
          invoiceCount: sql<number>`COUNT(*)::int`,
        })
        .from(subcontractorInvoice)
        .where(inArray(subcontractorInvoice.subcontractId, ids))
        .groupBy(subcontractorInvoice.subcontractId);
      const byId = new Map(sums.map(s => [s.subcontractId, s]));
      return rows.map(r => {
        const s = byId.get(r.id);
        return {
          ...r,
          totalInvoiced: Number(s?.invoiced ?? 0),
          totalPaid: Number(s?.paid ?? 0),
          invoiceCount: Number(s?.invoiceCount ?? 0),
        };
      });
    }),

  contractCreate: requireRole('owner', 'admin')
    .input(z.object({
      projectId: z.string().uuid(),
      subcontractorId: z.string().uuid(),
      contractNumber: z.string().max(80).optional(),
      scopeDescription: z.string().min(1),
      contractValue: z.number().nonnegative().default(0),
      startDate: z.string().optional(),  // ISO date
      endDate: z.string().optional(),
      retentionPct: z.number().min(0).max(100).default(5),
      signedAt: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);
      await assertSubcontractorInOrg(ctx, input.subcontractorId);
      const [row] = await ctx.db.insert(subcontract).values({
        projectId: input.projectId,
        subcontractorId: input.subcontractorId,
        contractNumber: input.contractNumber || null,
        scopeDescription: input.scopeDescription,
        contractValue: input.contractValue.toString(),
        startDate: input.startDate || null,
        endDate: input.endDate || null,
        retentionPct: input.retentionPct.toString(),
        signedAt: input.signedAt || null,
        notes: input.notes || null,
      }).returning();
      return row;
    }),

  contractDetail: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ref = await assertSubcontractInOrg(ctx, input.id);
      const [row] = await ctx.db
        .select({
          id: subcontract.id,
          projectId: subcontract.projectId,
          subcontractorId: subcontract.subcontractorId,
          subcontractor: subcontractor,
          contractNumber: subcontract.contractNumber,
          scopeDescription: subcontract.scopeDescription,
          contractValue: subcontract.contractValue,
          startDate: subcontract.startDate,
          endDate: subcontract.endDate,
          retentionPct: subcontract.retentionPct,
          notes: subcontract.notes,
          signedAt: subcontract.signedAt,
          createdAt: subcontract.createdAt,
        })
        .from(subcontract)
        .innerJoin(subcontractor, eq(subcontractor.id, subcontract.subcontractorId))
        .where(eq(subcontract.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });

      const [agg] = await ctx.db
        .select({
          invoiced: sql<string>`COALESCE(SUM(${subcontractorInvoice.netAmount}), 0)`,
          paid: sql<string>`COALESCE(SUM(CASE WHEN ${subcontractorInvoice.status} = 'paid' THEN ${subcontractorInvoice.paidAmount} ELSE 0 END), 0)`,
        })
        .from(subcontractorInvoice)
        .where(eq(subcontractorInvoice.subcontractId, input.id));
      return {
        ...row,
        projectId: ref.projectId,
        totalInvoiced: Number(agg?.invoiced ?? 0),
        totalPaid: Number(agg?.paid ?? 0),
      };
    }),

  // ---------------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------------

  invoiceList: orgProcedure
    .input(z.object({
      subcontractId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
    }).refine(d => !!(d.subcontractId || d.projectId), { message: 'subcontractId or projectId required' }))
    .query(async ({ ctx, input }) => {
      if (input.subcontractId) {
        await assertSubcontractInOrg(ctx, input.subcontractId);
        return ctx.db
          .select()
          .from(subcontractorInvoice)
          .where(eq(subcontractorInvoice.subcontractId, input.subcontractId))
          .orderBy(desc(subcontractorInvoice.invoiceDate), desc(subcontractorInvoice.createdAt));
      }
      await assertProjectInOrg(ctx, input.projectId!);
      return ctx.db
        .select({
          id: subcontractorInvoice.id,
          subcontractId: subcontractorInvoice.subcontractId,
          subcontractorName: subcontractor.name,
          invoiceNumber: subcontractorInvoice.invoiceNumber,
          invoiceDate: subcontractorInvoice.invoiceDate,
          progressPct: subcontractorInvoice.progressPct,
          grossAmount: subcontractorInvoice.grossAmount,
          retentionAmount: subcontractorInvoice.retentionAmount,
          ppnAmount: subcontractorInvoice.ppnAmount,
          netAmount: subcontractorInvoice.netAmount,
          status: subcontractorInvoice.status,
          paidDate: subcontractorInvoice.paidDate,
          paidAmount: subcontractorInvoice.paidAmount,
          notes: subcontractorInvoice.notes,
          createdAt: subcontractorInvoice.createdAt,
        })
        .from(subcontractorInvoice)
        .innerJoin(subcontract, eq(subcontract.id, subcontractorInvoice.subcontractId))
        .innerJoin(subcontractor, eq(subcontractor.id, subcontract.subcontractorId))
        .where(eq(subcontract.projectId, input.projectId!))
        .orderBy(desc(subcontractorInvoice.invoiceDate), desc(subcontractorInvoice.createdAt));
    }),

  invoiceCreate: orgProcedure
    .input(z.object({
      subcontractId: z.string().uuid(),
      invoiceNumber: z.string().min(1).max(80),
      invoiceDate: z.string().min(1),  // ISO date
      progressPct: z.number().min(0).max(100).default(0),
      grossAmount: z.number().nonnegative(),
      retentionAmount: z.number().nonnegative().default(0),
      ppnAmount: z.number().nonnegative().default(0),
      netAmount: z.number().nonnegative(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertSubcontractInOrg(ctx, input.subcontractId);
      const [row] = await ctx.db.insert(subcontractorInvoice).values({
        subcontractId: input.subcontractId,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        progressPct: input.progressPct.toString(),
        grossAmount: input.grossAmount.toString(),
        retentionAmount: input.retentionAmount.toString(),
        ppnAmount: input.ppnAmount.toString(),
        netAmount: input.netAmount.toString(),
        notes: input.notes || null,
        submittedById: ctx.session.user.id,
        status: 'submitted',
      }).returning();
      return row;
    }),

  invoiceUpdate: orgProcedure
    .input(z.object({
      id: z.string().uuid(),
      invoiceNumber: z.string().min(1).max(80).optional(),
      invoiceDate: z.string().optional(),
      progressPct: z.number().min(0).max(100).optional(),
      grossAmount: z.number().nonnegative().optional(),
      retentionAmount: z.number().nonnegative().optional(),
      ppnAmount: z.number().nonnegative().optional(),
      netAmount: z.number().nonnegative().optional(),
      status: invoiceStatusEnum.optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Look up + auth-check via parent subcontract
      const [inv] = await ctx.db.select({
        id: subcontractorInvoice.id,
        subcontractId: subcontractorInvoice.subcontractId,
      }).from(subcontractorInvoice).where(eq(subcontractorInvoice.id, input.id)).limit(1);
      if (!inv) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertSubcontractInOrg(ctx, inv.subcontractId);

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.invoiceNumber !== undefined) patch.invoiceNumber = input.invoiceNumber;
      if (input.invoiceDate !== undefined) patch.invoiceDate = input.invoiceDate;
      if (input.progressPct !== undefined) patch.progressPct = input.progressPct.toString();
      if (input.grossAmount !== undefined) patch.grossAmount = input.grossAmount.toString();
      if (input.retentionAmount !== undefined) patch.retentionAmount = input.retentionAmount.toString();
      if (input.ppnAmount !== undefined) patch.ppnAmount = input.ppnAmount.toString();
      if (input.netAmount !== undefined) patch.netAmount = input.netAmount.toString();
      if (input.status !== undefined) patch.status = input.status;
      if (input.notes !== undefined) patch.notes = input.notes;

      const [row] = await ctx.db.update(subcontractorInvoice)
        .set(patch)
        .where(eq(subcontractorInvoice.id, input.id))
        .returning();
      return row;
    }),

  invoiceApprove: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [inv] = await ctx.db.select({
        id: subcontractorInvoice.id,
        subcontractId: subcontractorInvoice.subcontractId,
      }).from(subcontractorInvoice).where(eq(subcontractorInvoice.id, input.id)).limit(1);
      if (!inv) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertSubcontractInOrg(ctx, inv.subcontractId);

      const [row] = await ctx.db.update(subcontractorInvoice)
        .set({
          status: 'approved',
          approvedById: ctx.session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(subcontractorInvoice.id, input.id))
        .returning();
      return row;
    }),

  invoiceMarkPaid: requireRole('owner', 'admin')
    .input(z.object({
      id: z.string().uuid(),
      paidDate: z.string().min(1),
      paidAmount: z.number().nonnegative(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [inv] = await ctx.db.select({
        id: subcontractorInvoice.id,
        subcontractId: subcontractorInvoice.subcontractId,
      }).from(subcontractorInvoice).where(eq(subcontractorInvoice.id, input.id)).limit(1);
      if (!inv) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertSubcontractInOrg(ctx, inv.subcontractId);

      const [row] = await ctx.db.update(subcontractorInvoice)
        .set({
          status: 'paid',
          paidDate: input.paidDate,
          paidAmount: input.paidAmount.toString(),
          updatedAt: new Date(),
        })
        .where(eq(subcontractorInvoice.id, input.id))
        .returning();
      return row;
    }),

  /** Project-level rollup: contract value vs invoiced vs paid vs outstanding. */
  summary: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertProjectInOrg(ctx, input.projectId);
      const [agg] = await ctx.db
        .select({
          totalContractValue: sql<string>`COALESCE(SUM(${subcontract.contractValue}), 0)`,
          contractCount: sql<number>`COUNT(*)::int`,
        })
        .from(subcontract)
        .where(eq(subcontract.projectId, input.projectId));

      const [invAgg] = await ctx.db
        .select({
          totalInvoiced: sql<string>`COALESCE(SUM(${subcontractorInvoice.netAmount}), 0)`,
          totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${subcontractorInvoice.status} = 'paid' THEN ${subcontractorInvoice.paidAmount} ELSE 0 END), 0)`,
          invoiceCount: sql<number>`COUNT(*)::int`,
        })
        .from(subcontractorInvoice)
        .innerJoin(subcontract, eq(subcontract.id, subcontractorInvoice.subcontractId))
        .where(eq(subcontract.projectId, input.projectId));

      const totalContractValue = Number(agg?.totalContractValue ?? 0);
      const totalInvoiced = Number(invAgg?.totalInvoiced ?? 0);
      const totalPaid = Number(invAgg?.totalPaid ?? 0);
      return {
        totalContractValue,
        totalInvoiced,
        totalPaid,
        totalOutstanding: totalContractValue - totalPaid,
        contractCount: Number(agg?.contractCount ?? 0),
        invoiceCount: Number(invAgg?.invoiceCount ?? 0),
      };
    }),
});
