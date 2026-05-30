/**
 * Apply every hand-written SQL migration in drizzle/ in numeric order.
 *
 * This repo's drizzle journal is frozen at 0007 and the TS schema has diverged
 * from the SQL files (some tables — e.g. idempotency_key — exist only as SQL
 * migrations). Neither `drizzle-kit migrate` (journal-bound) nor `drizzle-kit
 * push` (TS-schema-bound) reproduces the full schema on a fresh DB. The ordered
 * SQL files are the real source of truth, so apply them directly. Files use
 * `IF NOT EXISTS`, so re-running against an existing DB is safe.
 */
import postgres from 'postgres';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const sql = postgres(url, { max: 1 });
try {
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    process.stdout.write(`apply ${f} ... `);
    await sql.unsafe(text);
    console.log('ok');
  }
  console.log(`applied ${files.length} SQL migrations`);
} finally {
  await sql.end({ timeout: 5 });
}
