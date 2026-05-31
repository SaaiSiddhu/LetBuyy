import { expect, test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://letbuyy.store';
const ACCOUNTS_URL = process.env.ACCOUNTS_URL || 'https://accounts.letbuyy.store';
const ADMIN_URL = process.env.ADMIN_URL || 'https://admin.letbuyy.store';
const API_URL = process.env.API_URL || 'https://api.letbuyy.store';

test.describe('Smoke tests - foundation surfaces', () => {
  test('marketing site loads', async ({ page }) => {
    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).not.toHaveTitle(/error|404|500/i);
    expect(page.url()).not.toContain('error');
  });

  test('accounts page loads', async ({ page }) => {
    const response = await page.goto(ACCOUNTS_URL, { waitUntil: 'domcontentloaded' });

    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).not.toHaveTitle(/error|500/i);
  });

  test('admin page redirects or loads unauthenticated', async ({ page }) => {
    const response = await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });

    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).not.toHaveTitle(/500|server error/i);
  });

  test('API worker health check does not hard fail', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`, { failOnStatusCode: false });

    expect(response.status()).toBeLessThan(500);
  });
});
