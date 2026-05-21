import { test, expect } from '@playwright/test';

/**
 * Smoke test — runs against the live dev server (web :3000 + API :4000 + Postgres :5434).
 * Assumes demo@sitelog.local / demopass123 is seeded with at least 1 project.
 */

const EMAIL = process.env.E2E_EMAIL ?? 'demo@sitelog.local';
const PASSWORD = process.env.E2E_PASSWORD ?? 'demopass123';

test.describe('Public marketing', () => {
  test('landing renders hero + CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Build BOQ/i)).toBeVisible();
    await expect(page.getByText(/Hit your numbers/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /start.*free|sign\s*up/i }).first()).toBeVisible();
  });

  test('pricing shows 3 tiers', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/Starter/i).first()).toBeVisible();
    await expect(page.getByText(/Pro/i).first()).toBeVisible();
    await expect(page.getByText(/Enterprise/i).first()).toBeVisible();
  });

  test('status page reports component health', async ({ page }) => {
    await page.goto('/status');
    await expect(page.getByText(/components/i)).toBeVisible();
    await expect(page.getByText(/^db$/i)).toBeVisible();
  });
});

test.describe('Auth flow', () => {
  test('login → dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/app/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('dashboard shows portfolio KPIs', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/app/);
    await expect(page.getByText(/portfolio\s*value/i)).toBeVisible();
    await expect(page.getByText(/projects/i).first()).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/app/);
  });

  for (const [name, path] of [
    ['Projects', '/app/projects'],
    ['AHSP Catalog', '/app/ahsp'],
    ['Templates', '/app/templates'],
    ['Fleet', '/app/fleet'],
    ['Daily Entries', '/app/entries'],
    ['Analytics', '/app/analytics'],
    ['AI Assistant', '/app/ai'],
    ['Audit Log', '/app/audit'],
    ['Settings', '/app/settings'],
  ] as const) {
    test(`renders ${name} page`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText(/404|page could not be found/i);
    });
  }
});
