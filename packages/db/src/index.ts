import * as schema from './schema/index.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

// Use Neon HTTP driver for neon.tech URLs; postgres-js for any other Postgres (Docker, RDS, etc).
const isNeon = /neon\.tech|neon\.build/.test(url);

export const db = await (async () => {
  if (isNeon) {
    const { drizzle } = await import('drizzle-orm/neon-http');
    const { neon } = await import('@neondatabase/serverless');
    return drizzle(neon(url), { schema });
  }
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const postgres = (await import('postgres')).default;
  const client = postgres(url, { prepare: false });
  return drizzle(client, { schema });
})();

export * from './schema/index.js';
export type Database = typeof db;
