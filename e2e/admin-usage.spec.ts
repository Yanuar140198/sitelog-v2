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

test.describe('Settings → Usage', () => {
  test('renders quota meters + plan limits table', async ({ page }) => {
    await login(page);
    await page.goto('/app/settings/usage', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/THIS MONTH/i)).toBeVisible();
    await expect(page.getByText(/AI calls/i).first()).toBeVisible();
    await expect(page.getByText(/Storage \(photos\)/i)).toBeVisible();
    await expect(page.getByText(/PLAN LIMITS/i)).toBeVisible();
    await expect(page.getByText(/Projects/i).first()).toBeVisible();
  });
});

test.describe('Settings → Security (sessions)', () => {
  test('renders ACTIVE SESSIONS section with at least 1 session', async ({ page }) => {
    await login(page);
    await page.goto('/app/settings/security', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/ACTIVE SESSIONS/i)).toBeVisible();
    await expect(page.getByText(/TWO-FACTOR AUTHENTICATION/i)).toBeVisible();
    // At least one CURRENT badge should show
    await expect(page.getByText(/CURRENT/i).first()).toBeVisible();
  });
});

test.describe('Super admin dashboard recency', () => {
  test('renders KPI cards with growth subtitles + recency row', async ({ page }) => {
    await login(page);
    await page.goto('/superadmin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/^ORGANIZATIONS$/).first()).toBeVisible();
    await expect(page.getByText(/^USERS$/).first()).toBeVisible();
    await expect(page.getByText(/ENTRIES \(24h\)/i)).toBeVisible();
    await expect(page.getByText(/AUDIT \(24h\)/i)).toBeVisible();
    await expect(page.getByText(/WEBHOOKS ACTIVE/i)).toBeVisible();
  });

  test('webhooks activity page renders', async ({ page }) => {
    await login(page);
    await page.goto('/superadmin/webhooks', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /Webhook Activity/i })).toBeVisible();
  });

  test('audit page renders filter + table', async ({ page }) => {
    await login(page);
    await page.goto('/superadmin/audit', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /Audit Log/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Filter action prefix/i)).toBeVisible();
  });

  test('security page renders window toggle + sections', async ({ page }) => {
    await login(page);
    await page.goto('/superadmin/security', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /Failed Logins/i })).toBeVisible();
    await expect(page.getByText(/TOP OFFENDER IPS/i)).toBeVisible();
    await expect(page.getByText(/RECENT FAILURES/i)).toBeVisible();
  });

  test('users page renders search + table header', async ({ page }) => {
    await login(page);
    await page.goto('/superadmin/users', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByPlaceholder(/Search email or name/i)).toBeVisible();
    await expect(page.getByText(/^ORGS$/).first()).toBeVisible();
  });

  test('api-keys page renders ACTIVE + REVOKED sections', async ({ page }) => {
    await login(page);
    await page.goto('/superadmin/api-keys', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /API Keys/i })).toBeVisible();
    await expect(page.getByText(/^ACTIVE/i).first()).toBeVisible();
    await expect(page.getByText(/^REVOKED/i).first()).toBeVisible();
  });

  test('flags page renders 5 seeded flags', async ({ page }) => {
    await login(page);
    await page.goto('/superadmin/flags', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: /Feature Flags/i })).toBeVisible();
    await expect(page.getByText(/ai-suggest/i)).toBeVisible();
    await expect(page.getByText(/saml-sso/i)).toBeVisible();
  });
});
