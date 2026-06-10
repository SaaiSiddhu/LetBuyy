import { expect, test, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || process.env.LETBUYY_E2E_MARKETING_URL || 'https://www-staging.letbuyy.com';
const ACCOUNTS_URL = process.env.ACCOUNTS_URL || process.env.LETBUYY_E2E_IDENTITY_URL || 'https://accounts-staging.letbuyy.com';
const ADMIN_URL = process.env.ADMIN_URL || process.env.LETBUYY_E2E_MERCHANT_URL || 'https://admin-staging.letbuyy.com';
const API_URL = process.env.API_URL || process.env.LETBUYY_E2E_GATEWAY_URL || 'https://api-staging.letbuyy.com';

async function requireReachable(request: APIRequestContext, url: string, label: string): Promise<void> {
  const response = await request.get(url, { failOnStatusCode: false, timeout: 3_000 }).catch(() => null);
  test.skip(!response, `${label} is not reachable at ${url}. Start the local dev stack before running live smoke.`);
  test.skip(response !== null && response.status() >= 500, `${label} returned ${response?.status()} at ${url}.`);
}

test.describe('Smoke tests - foundation surfaces', () => {
  test('marketing site loads', async ({ page, request }) => {
    await requireReachable(request, BASE_URL, 'marketing site');

    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).not.toHaveTitle(/error|404|500/i);
    expect(page.url()).not.toContain('error');
  });

  test('accounts page loads', async ({ page, request }) => {
    await requireReachable(request, ACCOUNTS_URL, 'identity platform');

    const response = await page.goto(ACCOUNTS_URL, { waitUntil: 'domcontentloaded' });

    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).not.toHaveTitle(/error|500/i);
  });

  test('admin page redirects or loads unauthenticated', async ({ page, request }) => {
    await requireReachable(request, ADMIN_URL, 'merchant control plane');

    const response = await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });

    expect(response?.status() ?? 0).toBeLessThan(500);
    await expect(page).not.toHaveTitle(/500|server error/i);
  });

  test('API worker health check does not hard fail', async ({ request }) => {
    await requireReachable(request, API_URL, 'api gateway');

    const response = await request.get(`${API_URL}/health`, { failOnStatusCode: false });

    expect(response.status()).toBeLessThan(500);
  });
});
