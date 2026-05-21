#!/usr/bin/env bun
/**
 * DB backup + restore CLI.
 *
 * Backup:  bun scripts/backup.ts backup
 *   - Dumps Postgres via pg_dump → uploads to R2 with timestamp prefix.
 *   - Output: backups/sitelog-YYYY-MM-DD-HHmm.sql.gz
 *
 * Restore: bun scripts/backup.ts restore <key>
 *   - Downloads from R2 → pipes into psql.
 *
 * Requires: pg_dump + psql installed locally, DATABASE_URL + R2_* env.
 */
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, statSync, unlinkSync } from 'node:fs';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL required');

const R2_ACCOUNT = process.env.R2_ACCOUNT_ID;
const R2_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET ?? 'sitelog-backups';

async function r2Client() {
  if (!R2_ACCOUNT || !R2_KEY || !R2_SECRET) {
    console.warn('[backup] R2 not configured — writing to local backups/ dir only');
    return null;
  }
  const { S3Client } = await import('@aws-sdk/client-s3');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_KEY, secretAccessKey: R2_SECRET },
  });
}

async function backup() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const key = `backups/sitelog-${ts}.sql.gz`;
  const localPath = join(tmpdir(), `sitelog-${ts}.sql.gz`);

  console.log(`[backup] Dumping → ${localPath}`);
  const dump = spawn('pg_dump', [DATABASE_URL!, '--no-owner', '--no-acl'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const gz = createGzip();
  const out = createWriteStream(localPath);
  await pipeline(dump.stdout, gz, out);

  const sizeKB = Math.round(statSync(localPath).size / 1024);
  console.log(`[backup] Compressed: ${sizeKB} KB`);

  const s3 = await r2Client();
  if (s3) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const buf = await Bun.file(localPath).arrayBuffer();
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET, Key: key,
      Body: new Uint8Array(buf),
      ContentType: 'application/gzip',
    }));
    console.log(`[backup] Uploaded to r2://${R2_BUCKET}/${key}`);
    unlinkSync(localPath);
  } else {
    console.log(`[backup] Saved locally: ${localPath}`);
  }
}

async function restore(key: string) {
  if (!key) throw new Error('Usage: restore <key>');
  let localPath = key;
  const s3 = await r2Client();
  if (s3 && key.startsWith('backups/')) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const ts = Date.now();
    localPath = join(tmpdir(), `restore-${ts}.sql.gz`);
    const res = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    await Bun.write(localPath, bytes);
    console.log(`[restore] Downloaded ${key} → ${localPath}`);
  }

  console.log(`[restore] ⚠ This will overwrite current database. Continue?`);
  await new Promise(r => setTimeout(r, 3000));

  const psql = spawn('psql', [DATABASE_URL!], { stdio: ['pipe', 'inherit', 'inherit'] });
  await pipeline(createReadStream(localPath), createGunzip(), psql.stdin);
  console.log('[restore] Done.');
}

const cmd = process.argv[2];
if (cmd === 'backup') await backup();
else if (cmd === 'restore') await restore(process.argv[3]!);
else { console.error('Usage: bun scripts/backup.ts backup | restore <key>'); process.exit(1); }
