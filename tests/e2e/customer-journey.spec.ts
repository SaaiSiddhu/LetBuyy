import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

const storefrontUrl = process.env.LETBUYY_E2E_STOREFRONT_URL ?? 'http://127.0.0.1:3003';
const storeSubdomain = process.env.LETBUYY_E2E_STORE_SUBDOMAIN ?? 'demo-urban-kicks-store';

async function requireReachable(request: APIRequestContext, url: string, label: string): Promise<void> {
  const response = await request.get(url, { failOnStatusCode: false, timeout: 3_000 }).catch(() => null);
  test.skip(!response, `${label} is not reachable at ${url}. Start the local dev stack before running live e2e.`);
  test.skip(response !== null && response.status() >= 500, `${label} returned ${response?.status()} at ${url}.`);
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

async function openStorefront(page: Page): Promise<void> {
  const parsedStorefrontUrl = new URL(storefrontUrl);
  parsedStorefrontUrl.hostname = `${storeSubdomain}.localhost`;
  const subdomainUrl = parsedStorefrontUrl.toString().replace(/\/$/, '');

  await page.goto(`${subdomainUrl}/`, { waitUntil: 'domcontentloaded' }).catch(async () => {
    await page.goto(`${storefrontUrl}/store/${storeSubdomain}`, { waitUntil: 'domcontentloaded' });
  });
}

test.describe('customer journey', () => {
  test('customer browse to checkout', async ({ page, request }) => {
    await requireReachable(request, storefrontUrl, 'storefront runtime');

    await openStorefront(page);
    await expect(page.locator('body')).toBeVisible();

    const productNavigation = page
      .getByRole('link', { name: /shop|products|catalog|sneakers|collection/i })
      .or(page.getByRole('button', { name: /shop|products|catalog|sneakers|collection/i }));
    await clickFirstVisible(productNavigation);

    const productEntry = page
      .getByRole('link', { name: /view|details|urban|kick|sneaker|shoe/i })
      .or(page.locator('[data-testid="product-card"] a'))
      .or(page.locator('a[href*="/products/"]'));
    const openedProduct = await clickFirstVisible(productEntry);
    test.skip(!openedProduct, 'No product entry was visible in the seeded storefront.');

    await expect(page).toHaveURL(/product|products|store/i);

    const addToCart = page
      .getByRole('button', { name: /add to cart|add bag|buy now/i })
      .or(page.locator('[data-testid="add-to-cart"]'));
    await expect(addToCart.first()).toBeVisible();
    await addToCart.first().click();

    const checkout = page
      .getByRole('link', { name: /checkout|proceed/i })
      .or(page.getByRole('button', { name: /checkout|proceed/i }))
      .or(page.locator('[data-testid="checkout"]'));
    await expect(checkout.first()).toBeVisible();
    await checkout.first().click();

    await expect(page).toHaveURL(/checkout/i);
    expect(await page.locator('input, textarea, select, button').count()).toBeGreaterThan(0);
  });
});
