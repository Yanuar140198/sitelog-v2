/**
 * Per-request context carrying auth + DB.
 *
 * Created in Hono middleware via `createContext`, then exposed to all tRPC procedures.
 */
import type { inferAsyncReturnType } from '@trpc/server';
import { db } from '@sitelog/db';
import type { AuthSession } from '@sitelog/auth';

export type { AuthSession };

export interface CreateContextOptions {
  req: Request;
  session: AuthSession | null;
}

export function createContext({ req, session }: CreateContextOptions) {
  return {
    db,
    req,
    session,
    headers: req.headers,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
