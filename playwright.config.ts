import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config.
 *
 * LOCAL / CI-with-DB (default): Playwright boots the API (bun) + Web (next build/start,
 * prod mode to avoid turbopack cold-compile flakiness), and `globalSetup` provisions the
 * demo tenant + mints a REST API key. A Postgres DB must already be running and migrated —
 * locally `bash scripts/dev-start.sh`; in CI a postgres service + `pnpm db:migrate`.
 *
 * EXTERNAL target (e.g. nightly against staging): when E2E_BASE_URL points at a non-local
 * host, both the webServer and globalSetup are skipped — tests hit the deployed app and
 * read SITELOG_API_KEY from the environment (provided as a CI secret).
 *
 * Set E2E_NO_WEBSERVER=1 to manage the local servers yourself (faster iteration loop).
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EXTERNAL = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(BASE_URL);
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:dev@localhost:5434/sitelog';
const ADMIN_EMAILS = process.env.SITELOG_ADMIN_EMAILS ?? process.env.E2E_EMAIL ?? 'demo@sitelog.local';

export default defineConfig({
  testDir: './e2e',
  globalSetup: EXTERNAL ? undefined : './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: (process.env.E2E_NO_WEBSERVER || EXTERNAL) ? undefined : [
    {
      command: 'bun src/server.ts',
      cwd: './apps/api',
      url: 'http://localhost:4000/healthz',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        DATABASE_URL: DB_URL,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-32-bytes-long-stub-secret-key',
        SITELOG_ADMIN_EMAILS: ADMIN_EMAILS,
        PORT: '4000',
      },
    },
    {
      command: 'pnpm build && pnpm start',
      cwd: './apps/web',
      url: 'http://localhost:3000',
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:4000',
        NEXT_PUBLIC_WEB_URL: 'http://localhost:3000',
      },
    },
  ],
});
