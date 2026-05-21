/**
 * tRPC initialization — defines:
 *   - publicProcedure: no auth required
 *   - protectedProcedure: requires session
 *   - orgProcedure: requires session + active org context
 *   - rbacProcedure(roles[]): requires specific role(s) in current org
 */
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context.js';
import type { UserRole } from '@sitelog/db';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const orgProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.session.organizationId || ctx.session.organizationId === '') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No active organization. Create or join one first.' });
  }
  return next({ ctx });
});

export function requireRole(...allowed: UserRole[]) {
  return orgProcedure.use(({ ctx, next }) => {
    if (!allowed.includes(ctx.session.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Need role: ${allowed.join('|')}` });
    }
    return next({ ctx });
  });
}

export const middleware = t.middleware;
