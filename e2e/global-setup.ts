/**
 * Playwright global setup — provisions the demo tenant the e2e specs assume,
 * then mints a fresh REST API key so the rest-api.spec.ts contract tests run
 * instead of skipping.
 *
 * Idempotent: safe to run against a fresh DB or one that already has the demo
 * account. Runs AFTER the webServer(s) are ready (Playwright lifecycle), so it
 * can sign up via the live web app and write to the live DB.
 *
 * Uses raw SQL via postgres.js (not @sitelog/db — that workspace package isn't
 * resolvable from the repo root and its TS source uses .js-extension imports).
 *
 * Outputs:
 *   - demo@sitelog.local / demopass123 with an org + ≥1 project
 *   - e2e/.api-key  (full sk_live_… key; gitignored) — read by rest-api.spec.ts
 */
import { chromium, type FullConfig } from '@playwright/test';
import postgres from 'postgres';
import { randomBytes, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WEB = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:dev@localhost:5434/sitelog';
const EMAIL = process.env.E2E_EMAIL ?? 'demo@sitelog.local';
const PASSWORD = process.env.E2E_PASSWORD ?? 'demopass123';
const ORG_NAME = 'Demo Construction';
const ORG_SLUG = 'demo-construction';

const KEY_FILE = join(dirname(fileURLToPath(import.meta.url)), '.api-key');

export default async function globalSetup(_config: FullConfig) {
  const sql = postgres(DB_URL, { max: 1 });
  try {
    // 1. Demo user — sign up through the real UI (Better Auth handles hashing).
    let [u] = await sql`select id from "user" where email = ${EMAIL} limit 1`;
    if (!u) {
      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.goto(`${WEB}/signup`, { waitUntil: 'domcontentloaded' });
      await page.fill('#name', 'Demo User');
      await page.fill('#email', EMAIL);
      await page.fill('#password', PASSWORD);
      const orgField = await page.$('#org');
      if (orgField) await orgField.fill(ORG_NAME);
      await page.click('button[type=submit]');
      await page.waitForTimeout(3000);
      await browser.close();
      [u] = await sql`select id from "user" where email = ${EMAIL} limit 1`;
      if (!u) throw new Error('[e2e globalSetup] signup failed — demo user not created');
    }

    // 2. Org + owner membership — created directly (signup only lands on onboarding).
    const [m] = await sql`select organization_id from membership where user_id = ${u.id} limit 1`;
    let orgId = m?.organization_id as string | undefined;
    if (!orgId) {
      const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const [existing] = await sql`select id from organization where slug = ${ORG_SLUG} limit 1`;
      const [org] = existing
        ? [existing]
        : await sql`insert into organization (slug, name, plan, trial_ends_at)
                    values (${ORG_SLUG}, ${ORG_NAME}, 'trial', ${trialEnds}) returning id`;
      orgId = org.id as string;
      await sql`insert into membership (user_id, organization_id, role, accepted_at)
                values (${u.id}, ${orgId}, 'owner', now())`;
    }

    // 3. At least one project (smoke + rest-api expect a non-empty portfolio).
    const [proj] = await sql`select id from project where organization_id = ${orgId} limit 1`;
    if (!proj) {
      await sql`insert into project (organization_id, code, name)
                values (${orgId}, 'E2E-001', 'E2E Demo Project')`;
    }

    // 4. Fresh REST API key — drop prior auto keys, mint one, persist for the specs.
    await sql`delete from api_key where organization_id = ${orgId} and name = 'e2e-auto'`;
    const full = `sk_live_${randomBytes(32).toString('base64url')}`;
    const hashed = createHash('sha256').update(full).digest('hex');
    await sql`insert into api_key (organization_id, name, prefix, hashed_key, scope, created_by_id)
              values (${orgId}, 'e2e-auto', ${full.slice(0, 16)}, ${hashed}, 'admin', ${u.id})`;
    writeFileSync(KEY_FILE, full, 'utf8');
    process.env.SITELOG_API_KEY = full;

    console.log(`[e2e globalSetup] demo tenant ready (org=${orgId}); API key minted → ${KEY_FILE}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
