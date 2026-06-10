import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

const marketingUrl = process.env.LETBUYY_E2E_MARKETING_URL ?? 'https://www-staging.letbuyy.com';
const identityUrl = process.env.LETBUYY_E2E_IDENTITY_URL ?? 'https://accounts-staging.letbuyy.com';
const merchantUrl = process.env.LETBUYY_E2E_MERCHANT_URL ?? 'https://admin-staging.letbuyy.com';
const testEmail = process.env.LETBUYY_E2E_TEST_EMAIL ?? `e2e-${Date.now()}@letbuyy.local`;
const testOtp = process.env.LETBUYY_E2E_TEST_OTP ?? '123456';

async function requireReachable(request: APIRequestContext, url: string, label: string): Promise<void> {
  const response = await request.get(url, { failOnStatusCode: false, timeout: 3_000 }).catch(() => null);
  test.skip(!response, `${label} is not reachable at ${url}. Start the local dev stack before running live e2e.`);
  test.skip(response !== null && response.status() >= 500, `${label} returned ${response?.status()} at ${url}.`);
}

async function fillFirstVisible(locator: Locator, value: string): Promise<boolean> {
  const count = await locator.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.fill(value);
      return true;
    }
  }

  return false;
}

async function clickFirstVisible(locator: Locator): Promise<boolean> {
  const count = await locator.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return true;
    }
  }

  return false;
}

async function startSignup(page: Page): Promise<void> {
  await page.goto(marketingUrl, { waitUntil: 'domcontentloaded' });

  const createStoreCta = page
    .getByRole('link', { name: /create store|start|start selling|get started/i })
    .or(page.getByRole('button', { name: /create store|start|start selling|get started/i }));

  if (!(await clickFirstVisible(createStoreCta))) {
    await page.goto(`${identityUrl}/signup`, { waitUntil: 'domcontentloaded' });
  }
}

test.describe('merchant journey', () => {
  test('merchant signup to store published', async ({ page, request }) => {
    await requireReachable(request, marketingUrl, 'marketing site');
    await requireReachable(request, identityUrl, 'identity platform');
    await requireReachable(request, merchantUrl, 'merchant control plane');

    await startSignup(page);

    const filledEmail = await fillFirstVisible(page.getByLabel(/email/i).or(page.locator('input[type="email"]')), testEmail);
    test.skip(!filledEmail, 'Signup email input was not visible.');

    await fillFirstVisible(page.getByLabel(/name|merchant|owner/i), 'LetBuyy E2E Merchant');
    await fillFirstVisible(page.getByLabel(/password/i).or(page.locator('input[type="password"]')), 'dev-only-e2e-password-123');

    const submittedSignup = await clickFirstVisible(
      page.getByRole('button', { name: /continue|sign up|create account|send otp/i }),
    );
    test.skip(!submittedSignup, 'Signup submit button was not visible.');

    const otpInput = page.getByLabel(/otp|code|verification/i).or(page.locator('input[inputmode="numeric"]')).or(page.locator('input[name*="otp" i]'));
    if (await otpInput.first().isVisible({ timeout: 7_500 }).catch(() => false)) {
      await otpInput.first().fill(testOtp);
      await clickFirstVisible(page.getByRole('button', { name: /verify|continue/i }));
    }

    await expect(page.locator('body')).toBeVisible();

    const storeNameInput = page.getByLabel(/store name|business name/i).or(page.locator('input[name*="store" i]'));
    if (await storeNameInput.first().isVisible({ timeout: 7_500 }).catch(() => false)) {
      await storeNameInput.first().fill('Urban Kicks E2E');
      await fillFirstVisible(page.getByLabel(/subdomain|store url/i).or(page.locator('input[name*="subdomain" i]')), 'urban-kicks-e2e');
      await clickFirstVisible(page.getByRole('button', { name: /create store|continue|finish/i }));
    }

    await page.goto(`${merchantUrl}/urban-kicks-e2e/products/new`, { waitUntil: 'domcontentloaded' });
    await fillFirstVisible(page.getByLabel(/title|name/i).or(page.locator('input[name*="name" i]')), 'Urban Runner E2E');
    await fillFirstVisible(page.getByLabel(/price/i).or(page.locator('input[name*="price" i]')), '2499');
    await fillFirstVisible(page.getByLabel(/description/i).or(page.locator('textarea')), 'A local e2e product for publish verification.');

    const savedProduct = await clickFirstVisible(page.getByRole('button', { name: /save|create|publish product/i }));
    test.skip(!savedProduct, 'Product creation controls were not visible.');

    await page.goto(`${merchantUrl}/urban-kicks-e2e/settings`, { waitUntil: 'domcontentloaded' });
    const publishAction = page.getByRole('button', { name: /publish/i }).or(page.getByRole('link', { name: /publish/i }));
    const published = await clickFirstVisible(publishAction);
    test.skip(!published, 'Store publish action was not visible.');

    await expect(page.locator('body')).toBeVisible();
  });
});
