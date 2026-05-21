/**
 * Custom domain verification — DNS TXT record challenge.
 *
 * Flow:
 *   1. Owner submits domain → backend stores domain + generates random verify token
 *   2. Returns TXT record instruction: _sitelog-verify.{domain} TXT "<token>"
 *   3. Owner adds DNS record at their registrar
 *   4. Owner calls verify → backend DNS lookup, marks verified
 */
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { router, requireRole } from '../trpc.js';
import { organization } from '@sitelog/db';
import { TRPCError } from '@trpc/server';
import { randomBytes } from 'node:crypto';
import { promises as dns } from 'node:dns';

export const domainRouter = router({
  status: requireRole('owner', 'admin').query(async ({ ctx }) => {
    const [org] = await ctx.db.select({
      customDomain: organization.customDomain,
      customDomainVerifyToken: organization.customDomainVerifyToken,
      customDomainVerifiedAt: organization.customDomainVerifiedAt,
    }).from(organization).where(eq(organization.id, ctx.session.organizationId)).limit(1);
    return org ?? null;
  }),

  request: requireRole('owner')
    .input(z.object({ domain: z.string().min(3).max(128).regex(/^[a-z0-9.-]+\.[a-z]+$/i) }))
    .mutation(async ({ ctx, input }) => {
      const token = 'sitelog-verify=' + randomBytes(20).toString('hex');
      await ctx.db.update(organization).set({
        customDomain: input.domain.toLowerCase(),
        customDomainVerifyToken: token,
        customDomainVerifiedAt: null,
      }).where(eq(organization.id, ctx.session.organizationId));
      return {
        domain: input.domain.toLowerCase(),
        recordType: 'TXT',
        recordName: `_sitelog-verify.${input.domain.toLowerCase()}`,
        recordValue: token,
        cnameTarget: process.env.NEXT_PUBLIC_WEB_URL?.replace(/^https?:\/\//, '') ?? 'app.sitelog.app',
      };
    }),

  verify: requireRole('owner').mutation(async ({ ctx }) => {
    const [org] = await ctx.db.select().from(organization)
      .where(eq(organization.id, ctx.session.organizationId)).limit(1);
    if (!org?.customDomain || !org.customDomainVerifyToken) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No domain requested yet' });
    }
    try {
      const records = await dns.resolveTxt(`_sitelog-verify.${org.customDomain}`);
      const flat = records.flat().join('');
      if (!flat.includes(org.customDomainVerifyToken)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'TXT record not found or mismatch' });
      }
      await ctx.db.update(organization).set({ customDomainVerifiedAt: new Date() })
        .where(eq(organization.id, ctx.session.organizationId));
      return { ok: true, verifiedAt: new Date() };
    } catch (e: any) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `DNS lookup failed: ${e.message}` });
    }
  }),

  remove: requireRole('owner').mutation(async ({ ctx }) => {
    await ctx.db.update(organization).set({
      customDomain: null, customDomainVerifyToken: null, customDomainVerifiedAt: null,
    }).where(eq(organization.id, ctx.session.organizationId));
    return { ok: true };
  }),
});
