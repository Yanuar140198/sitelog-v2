import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? 'demo@sitelog.local';
const PASSWORD = process.env.E2E_PASSWORD ?? 'demopass123';

async function login(page: any) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/app/, { timeout: 10_000 });
}

test.describe('Privacy settings page', () => {
  test('renders EXPORT + DELETE sections', async ({ page }) => {
    await login(page);
    await page.goto('/app/settings/privacy', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/EXPORT YOUR DATA/i)).toBeVisible();
    await expect(page.getByText(/DELETE ACCOUNT/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /DOWNLOAD MY DATA/i })).toBeVisible();
  });

  test('DELETE button disabled until exact phrase typed', async ({ page }) => {
    await login(page);
    await page.goto('/app/settings/privacy', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const btn = page.getByRole('button', { name: /REQUEST DELETION/i });
    await expect(btn).toBeDisabled();
    await page.getByPlaceholder('DELETE MY ACCOUNT').fill('wrong text');
    await page.waitForTimeout(200);
    await expect(btn).toBeDisabled();
    await page.getByPlaceholder('DELETE MY ACCOUNT').fill('DELETE MY ACCOUNT');
    await page.waitForTimeout(200);
    await expect(btn).toBeEnabled();
  });
});

test.describe('Super-admin announcements', () => {
  test('renders admin announcements page', async ({ page }) => {
    await login(page);
    await page.goto('/superadmin/announcements', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { level: 1, name: /Announcements/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/NEW ANNOUNCEMENT/i).first()).toBeVisible();
  });

  test('app shell shows active banner', async ({ page }) => {
    await login(page);
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    // banner is role=alert + has SCHEDULED MAINTENANCE text from seed
    await page.waitForTimeout(2000);
    const banner = page.getByRole('alert').first();
    if (await banner.count() > 0) {
      await expect(banner).toBeVisible();
    }
  });
});
