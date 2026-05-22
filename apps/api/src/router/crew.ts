/**
 * Crew Management tRPC router — workforce roster + project postings.
 *
 * Replaces the simple `daily_entry.workforce` headcount with a real named-individual
 * model so PMs can track who is on site, what they're paid, and which projects they
 * are currently assigned to.
 *
 * Authorization model (mirrors fleet/resource-master):
 *  - read endpoints: any org member (orgProcedure)
 *  - mutate endpoints: owner|admin only (requireRole)
 *
 * Deletion is a soft delete (status='terminated') to preserve historical assignment
 * + future timesheet/payroll integrity.
 */
import { z } from 'zod';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { crewMember, crewAssignment, project } from '@sitelog/db';

const roleEnum = z.enum([
  'mandor', 'tukang', 'pekerja', 'operator', 'helper', 'driver', 'surveyor', 'security', 'admin', 'other',
]);
const statusEnum = z.enum(['active', 'on_leave', 'terminated']);

export const crewRouter = router({
  /**
   * List crew for active org with optional role/status/text filters.
   * Augments each row with `activeAssignments` count (assignments whose toDate is
   * null or in the future).
   */
  list: orgProcedure
    .input(z.object({
      status: statusEnum.optional(),
      role: roleEnum.optional(),
      q: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where = [eq(crewMember.organizationId, ctx.session.organizationId)];
      if (input?.status) where.push(eq(crewMember.status, input.status));
      if (input?.role) where.push(eq(crewMember.role, input.role));
      if (input?.q && input.q.trim()) {
        const q = `%${input.q.trim()}%`;
        where.push(or(
          ilike(crewMember.fullName, q),
          ilike(crewMember.nickname, q),
          ilike(crewMember.phone, q),
          ilike(crewMember.nationalId, q),
        )!);
      }
      const rows = await ctx.db.select().from(crewMember)
        .where(and(...where))
        .orderBy(asc(crewMember.fullName));

      if (rows.length === 0) return [];

      const ids = rows.map(r => r.id);
      const counts = await ctx.db.select({
        crewMemberId: crewAssignment.crewMemberId,
        n: sql<number>`COUNT(*)::int`.as('n'),
      }).from(crewAssignment)
        .where(and(
          sql`${crewAssignment.crewMemberId} = ANY(${ids})`,
          or(sql`${crewAssignment.toDate} IS NULL`, sql`${crewAssignment.toDate} >= CURRENT_DATE`)!,
        ))
        .groupBy(crewAssignment.crewMemberId);
      const byId = new Map(counts.map(c => [c.crewMemberId, c.n]));
      return rows.map(r => ({ ...r, activeAssignments: byId.get(r.id) ?? 0 }));
    }),

  /** Get one crew member + all their assignments (joined with project info). */
  get: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db.select().from(crewMember)
        .where(and(eq(crewMember.id, input.id), eq(crewMember.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });

      const assignments = await ctx.db.select({
        id: crewAssignment.id,
        projectId: crewAssignment.projectId,
        projectCode: project.code,
        projectName: project.name,
        fromDate: crewAssignment.fromDate,
        toDate: crewAssignment.toDate,
        roleOverride: crewAssignment.roleOverride,
        dailyRateOverride: crewAssignment.dailyRateOverride,
        notes: crewAssignment.notes,
        createdAt: crewAssignment.createdAt,
      }).from(crewAssignment)
        .innerJoin(project, eq(project.id, crewAssignment.projectId))
        .where(eq(crewAssignment.crewMemberId, input.id))
        .orderBy(desc(crewAssignment.fromDate));

      return { ...row, assignments };
    }),

  create: requireRole('owner', 'admin')
    .input(z.object({
      fullName: z.string().min(1).max(160),
      nickname: z.string().max(60).optional(),
      phone: z.string().max(32).optional(),
      nationalId: z.string().max(32).optional(),
      role: roleEnum.default('pekerja'),
      dailyRate: z.number().nonnegative().default(0),
      hourlyRate: z.number().nonnegative().default(0),
      hireDate: z.string().optional(),  // ISO date
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(crewMember).values({
        organizationId: ctx.session.organizationId,
        fullName: input.fullName,
        nickname: input.nickname,
        phone: input.phone,
        nationalId: input.nationalId,
        role: input.role,
        dailyRate: input.dailyRate.toString(),
        hourlyRate: input.hourlyRate.toString(),
        hireDate: input.hireDate,
        notes: input.notes,
      }).returning();
      return row;
    }),

  update: requireRole('owner', 'admin')
    .input(z.object({
      id: z.string().uuid(),
      fullName: z.string().min(1).max(160).optional(),
      nickname: z.string().max(60).nullable().optional(),
      phone: z.string().max(32).nullable().optional(),
      nationalId: z.string().max(32).nullable().optional(),
      role: roleEnum.optional(),
      dailyRate: z.number().nonnegative().optional(),
      hourlyRate: z.number().nonnegative().optional(),
      status: statusEnum.optional(),
      hireDate: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, dailyRate, hourlyRate, ...rest } = input;
      const [existing] = await ctx.db.select().from(crewMember)
        .where(and(eq(crewMember.id, id), eq(crewMember.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      const patch: Record<string, unknown> = { ...rest, updatedAt: new Date() };
      if (dailyRate !== undefined) patch.dailyRate = dailyRate.toString();
      if (hourlyRate !== undefined) patch.hourlyRate = hourlyRate.toString();

      const [row] = await ctx.db.update(crewMember).set(patch)
        .where(eq(crewMember.id, id))
        .returning();
      return row;
    }),

  /** Soft-delete: flip status to 'terminated' so historical assignments are preserved. */
  delete: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.db.update(crewMember)
        .set({ status: 'terminated', updatedAt: new Date() })
        .where(and(eq(crewMember.id, input.id), eq(crewMember.organizationId, ctx.session.organizationId)))
        .returning();
      if (res.length === 0) throw new TRPCError({ code: 'NOT_FOUND' });
      return { ok: true };
    }),

  assignToProject: requireRole('owner', 'admin')
    .input(z.object({
      crewMemberId: z.string().uuid(),
      projectId: z.string().uuid(),
      fromDate: z.string(),  // ISO date
      toDate: z.string().optional(),
      roleOverride: roleEnum.optional(),
      dailyRateOverride: z.number().nonnegative().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify crew belongs to org
      const [c] = await ctx.db.select({ id: crewMember.id }).from(crewMember)
        .where(and(eq(crewMember.id, input.crewMemberId), eq(crewMember.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: 'Crew member not found' });

      // Verify project belongs to org
      const [p] = await ctx.db.select({ id: project.id }).from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });

      const [row] = await ctx.db.insert(crewAssignment).values({
        crewMemberId: input.crewMemberId,
        projectId: input.projectId,
        fromDate: input.fromDate,
        toDate: input.toDate,
        roleOverride: input.roleOverride,
        dailyRateOverride: input.dailyRateOverride !== undefined ? input.dailyRateOverride.toString() : undefined,
        notes: input.notes,
        assignedBy: ctx.session.user.id,
      }).returning();
      return row;
    }),

  unassignFromProject: requireRole('owner', 'admin')
    .input(z.object({ assignmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the assignment's crew member belongs to org
      const [a] = await ctx.db.select({ id: crewAssignment.id }).from(crewAssignment)
        .innerJoin(crewMember, eq(crewMember.id, crewAssignment.crewMemberId))
        .where(and(
          eq(crewAssignment.id, input.assignmentId),
          eq(crewMember.organizationId, ctx.session.organizationId),
        ))
        .limit(1);
      if (!a) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.db.delete(crewAssignment).where(eq(crewAssignment.id, input.assignmentId));
      return { ok: true };
    }),

  /** Assignments for a project + joined crew info. */
  byProject: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify project belongs to org
      const [p] = await ctx.db.select({ id: project.id }).from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!p) throw new TRPCError({ code: 'NOT_FOUND' });

      return ctx.db.select({
        id: crewAssignment.id,
        crewMemberId: crewAssignment.crewMemberId,
        fullName: crewMember.fullName,
        nickname: crewMember.nickname,
        baseRole: crewMember.role,
        baseDailyRate: crewMember.dailyRate,
        status: crewMember.status,
        fromDate: crewAssignment.fromDate,
        toDate: crewAssignment.toDate,
        roleOverride: crewAssignment.roleOverride,
        dailyRateOverride: crewAssignment.dailyRateOverride,
        notes: crewAssignment.notes,
        createdAt: crewAssignment.createdAt,
      }).from(crewAssignment)
        .innerJoin(crewMember, eq(crewMember.id, crewAssignment.crewMemberId))
        .where(eq(crewAssignment.projectId, input.projectId))
        .orderBy(desc(crewAssignment.fromDate));
    }),
});
