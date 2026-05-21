import { test, expect } from '@playwright/test';

/**
 * Fresh signup → onboarding org create → dashboard.
 * Validates the critical Better Auth + tRPC cookie cross-port flow.
 */

const ts = Date.now();
const EMAIL = `e2e-${ts}@sitelog.test`;
const PASSWORD = 'e2e-test-pwd-123';
const ORG_NAME = `E2E Org ${ts}`;

test.describe.serial('Full happy path', () => {
  test('signup creates account + lands on onboarding', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('#name', 'E2E User');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.fill('#org', ORG_NAME);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
    await expect(page.getByText(/Set up your workspace/i)).toBeVisible();
  });

  test('onboarding submit creates org + lands on app', async ({ page }) => {
    // Login again — fresh page context, need new session
    await page.goto('/login');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForTimeout(3000);
    // If onboarding not done yet, complete it
    if (page.url().includes('/onboarding')) {
      await page.click('button[type=submit]');
    }
    await page.waitForURL(/\/app/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('navigate to all main sections without 404', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/app/, { timeout: 10_000 });

    for (const path of ['/app/projects', '/app/ahsp', '/app/fleet', '/app/entries', '/app/analytics', '/app/settings']) {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText(/404|page could not be found/i);
    }
  });

  test('logout returns to login screen', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/app/, { timeout: 10_000 });
    // Find logout button (LogOut icon in topbar)
    await page.locator('a[title="Sign out"], button[title="Sign out"]').first().click().catch(() => {});
    await page.waitForTimeout(2000);
    // Should redirect to login
    const url = page.url();
    expect(url).toMatch(/login|signup|\/$/);
  });
});
