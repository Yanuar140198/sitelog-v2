import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { router, requireRole } from '../trpc.js';
import { apiKey } from '@sitelog/db';
import { randomBytes, createHash } from 'node:crypto';

function generateKey(): { full: string; prefix: string; hashed: string } {
  const raw = randomBytes(32).toString('base64url');
  const full = `sk_live_${raw}`;
  const prefix = full.slice(0, 16);
  const hashed = createHash('sha256').update(full).digest('hex');
  return { full, prefix, hashed };
}

export const apiKeysRouter = router({
  list: requireRole('owner', 'admin').query(async ({ ctx }) => {
    return ctx.db.select({
      id: apiKey.id, name: apiKey.name, prefix: apiKey.prefix, scope: apiKey.scope,
      lastUsedAt: apiKey.lastUsedAt, expiresAt: apiKey.expiresAt, revokedAt: apiKey.revokedAt,
      createdAt: apiKey.createdAt,
    }).from(apiKey)
      .where(eq(apiKey.organizationId, ctx.session.organizationId))
      .orderBy(desc(apiKey.createdAt));
  }),

  create: requireRole('owner', 'admin')
    .input(z.object({
      name: z.string().min(1).max(128),
      scope: z.enum(['read', 'write', 'admin']).default('read'),
      expiresAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { full, prefix, hashed } = generateKey();
      const [row] = await ctx.db.insert(apiKey).values({
        organizationId: ctx.session.organizationId,
        name: input.name,
        prefix,
        hashedKey: hashed,
        scope: input.scope,
        expiresAt: input.expiresAt,
        createdById: ctx.session.user.id,
      }).returning();
      return { ...row, key: full };  // only returned once at create
    }),

  revoke: requireRole('owner', 'admin')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(apiKey).set({ revokedAt: new Date() })
        .where(and(eq(apiKey.id, input.id), eq(apiKey.organizationId, ctx.session.organizationId)));
      return { ok: true };
    }),
});
