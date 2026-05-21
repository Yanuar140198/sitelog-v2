/**
 * Per-project member assignments — restrict supervisors to assigned projects.
 *
 * Project visibility:
 *   - owner/admin/estimator/scheduler: see all org projects
 *   - supervisor: only assigned projects
 *   - viewer: only assigned projects
 */
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { router, orgProcedure, requireRole } from '../trpc.js';
import { projectAssignment, project, user, membership } from '@sitelog/db';
import { TRPCError } from '@trpc/server';

export const projectMemberRouter = router({
  list: orgProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify project ownership
      const [p] = await ctx.db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!p) throw new TRPCError({ code: 'NOT_FOUND' });
      return ctx.db.select({
        id: projectAssignment.id,
        userId: projectAssignment.userId,
        roleOnProject: projectAssignment.roleOnProject,
        assignedAt: projectAssignment.assignedAt,
        email: user.email, name: user.name,
      })
      .from(projectAssignment)
      .innerJoin(user, eq(projectAssignment.userId, user.id))
      .where(eq(projectAssignment.projectId, input.projectId));
    }),

  assign: requireRole('owner', 'admin')
    .input(z.object({
      projectId: z.string().uuid(),
      userId: z.string().uuid(),
      roleOnProject: z.string().max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify both project + target user belong to same org
      const [p] = await ctx.db.select().from(project)
        .where(and(eq(project.id, input.projectId), eq(project.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!p) throw new TRPCError({ code: 'NOT_FOUND' });
      const [mem] = await ctx.db.select().from(membership)
        .where(and(eq(membership.userId, input.userId), eq(membership.organizationId, ctx.session.organizationId)))
        .limit(1);
      if (!mem) throw new TRPCError({ code: 'BAD_REQUEST', message: 'User not member of org' });

      const existing = await ctx.db.select().from(projectAssignment)
        .where(and(eq(projectAssignment.projectId, input.projectId), eq(projectAssignment.userId, input.userId)))
        .limit(1);
      if (existing.length > 0) {
        await ctx.db.update(projectAssignment).set({ roleOnProject: input.roleOnProject })
          .where(eq(projectAssignment.id, existing[0]!.id));
        return existing[0];
      }
      const [row] = await ctx.db.insert(projectAssignment).values({
        projectId: input.projectId, userId: input.userId, roleOnProject: input.roleOnProject,
      }).returning();
      return row;
    }),

  unassign: requireRole('owner', 'admin')
    .input(z.object({ assignmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(projectAssignment).where(eq(projectAssignment.id, input.assignmentId));
      return { ok: true };
    }),

  /** Helper: list project IDs visible to current session user (for supervisors/viewers). */
  myProjects: orgProcedure.query(async ({ ctx }) => {
    if (['owner', 'admin', 'estimator', 'scheduler'].includes(ctx.session.role)) {
      // Full access
      const all = await ctx.db.select({ id: project.id }).from(project)
        .where(eq(project.organizationId, ctx.session.organizationId));
      return all.map(r => r.id);
    }
    const assigned = await ctx.db.select({ projectId: projectAssignment.projectId })
      .from(projectAssignment).where(eq(projectAssignment.userId, ctx.session.user.id));
    return assigned.map(a => a.projectId);
  }),
});
