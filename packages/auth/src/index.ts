/**
 * Better Auth configuration — shared between web (Next.js) + api (Hono).
 *
 * Features:
 *   - Email + password (bcrypt-hashed)
 *   - Magic link
 *   - Organization plugin (multi-tenant)
 *   - 2FA TOTP
 *   - Session JWT (database-backed)
 *
 * Sessions stored in `session` table (see @sitelog/db tenancy schema).
 */
import { betterAuth } from 'better-auth';
import { organization, twoFactor, magicLink } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, user, session, organization as orgTable, membership, account, verification } from '@sitelog/db';
import type { User, UserRole } from '@sitelog/db';
import { eq, and } from 'drizzle-orm';

export interface AuthSession {
  user: User;
  organizationId: string;   // empty string '' if user has no org yet (just signed up)
  role: UserRole;
  sessionId: string;
}

export const auth = betterAuth({
  trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? 'http://localhost:3000,http://localhost:4000').split(','),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification, organization: orgTable, member: membership },
  }),
  advanced: {
    database: { generateId: () => crypto.randomUUID() },
    // Same cookie shared across ports for local dev (web 3000, api 4000).
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: false,
      httpOnly: true,
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    },
    crossSubDomainCookies: { enabled: !!process.env.AUTH_COOKIE_DOMAIN, domain: process.env.AUTH_COOKIE_DOMAIN },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  plugins: [
    organization({ allowUserToCreateOrganization: true }),
    twoFactor(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // TODO: integrate with Resend
        console.log(`[auth] magic link for ${email}: ${url}`);
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
});

/**
 * Resolve auth session from incoming request (Authorization header bearer token or session cookie).
 * Returns context payload for tRPC: { user, organizationId, role, sessionId } or null.
 *
 * Org context selection: header `X-Org-Id` (preferred) → user's default membership.
 */
export async function resolveAuthSession(req: Request): Promise<AuthSession | null> {
  // 1. Try API key (Authorization: Bearer sk_live_...)
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader.startsWith('Bearer sk_live_')) {
    const key = authHeader.slice('Bearer '.length).trim();
    const { createHash } = await import('node:crypto');
    const hashed = createHash('sha256').update(key).digest('hex');
    const { apiKey } = await import('@sitelog/db');
    const { isNull } = await import('drizzle-orm');
    const [k] = await db.select().from(apiKey)
      .where(and(eq(apiKey.hashedKey, hashed), isNull(apiKey.revokedAt))).limit(1);
    if (!k) return null;
    if (k.expiresAt && k.expiresAt < new Date()) return null;
    // Touch last used (fire-and-forget)
    db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, k.id)).catch(() => {});
    // Role mapping: scope read → viewer, write → estimator, admin → admin
    const role: UserRole = k.scope === 'admin' ? 'admin' : k.scope === 'write' ? 'estimator' : 'viewer';
    return {
      user: { id: 'api-key:' + k.id, email: `api-key+${k.prefix}@sitelog.app` } as any,
      organizationId: k.organizationId,
      role,
      sessionId: 'api-key:' + k.id,
    };
  }

  // 2. Session cookie / Bearer session token
  const result = await auth.api.getSession({ headers: req.headers });
  if (!result?.user) return null;

  const orgHeader = req.headers.get('x-org-id');
  let orgId = orgHeader ?? null;
  if (!orgId) {
    const [defaultMem] = await db.select().from(membership)
      .where(eq(membership.userId, result.user.id)).limit(1);
    orgId = defaultMem?.organizationId ?? null;
  }

  // Return session even without org — new users need org.create access.
  if (!orgId) {
    return {
      user: result.user as any,
      organizationId: '',
      role: 'viewer',
      sessionId: result.session?.id ?? '',
    };
  }

  const [mem] = await db.select().from(membership)
    .where(and(eq(membership.userId, result.user.id), eq(membership.organizationId, orgId)))
    .limit(1);
  if (!mem) return null;

  return {
    user: result.user as any,
    organizationId: orgId,
    role: mem.role,
    sessionId: result.session?.id ?? '',
  };
}
