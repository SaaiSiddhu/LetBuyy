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

async function openVisibleProduct(page: Page): Promise<void> {
  const productEntry = page.locator('a[href*="/product/"]').first();

  if (!(await productEntry.isVisible().catch(() => false))) {
    const productNavigation = page
      .getByRole('link', { name: /shop|products|catalog|sneakers|collection/i })
      .or(page.getByRole('button', { name: /shop|products|catalog|sneakers|collection/i }));
    await clickFirstVisible(productNavigation);
  }

  await expect(productEntry).toBeVisible();
  await productEntry.click({ position: { x: 16, y: 16 } });
  await expect(page).toHaveURL(/\/product\//);
}

async function openCart(page: Page): Promise<void> {
  const currentUrl = new URL(page.url());
  const storeBasePath = currentUrl.pathname.match(/^(.*\/store\/[^/]+)/)?.[1];
  test.skip(!storeBasePath, 'Could not resolve the storefront cart URL.');

  await page.goto(`${currentUrl.origin}${storeBasePath}/cart`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/cart/i);
}

async function addProductToCart(page: Page, addToCart: Locator): Promise<void> {
  const cartWithItems = page.getByRole('button', { name: /open cart with [1-9]/i });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await addToCart.first().click();
    if (await cartWithItems.first().isVisible({ timeout: 1_500 }).catch(() => false)) return;
    await page.getByRole('button', { name: /close cart/i }).first().click().catch(() => undefined);
  }

  await expect(cartWithItems.first()).toBeVisible();
}

test.describe('customer journey', () => {
  test('customer browse to checkout', async ({ page, request }) => {
    await requireReachable(request, storefrontUrl, 'storefront runtime');

    await openStorefront(page);
    await expect(page.locator('body')).toBeVisible();

    await openVisibleProduct(page);

    const addToCart = page
      .getByRole('button', { name: /add to cart|add bag/i })
      .or(page.locator('[data-testid="add-to-cart"]'));

    await expect(addToCart.first()).toBeVisible();
    await addProductToCart(page, addToCart);
    await openCart(page);

    const checkout = page
      .getByRole('link', { name: /checkout|proceed/i })
      .or(page.getByRole('button', { name: /checkout|proceed/i }))
      .or(page.locator('[data-testid="checkout"]'));

    const checkoutAction = checkout.first();
    await expect(checkoutAction).toBeVisible();
    const checkoutHref = await checkoutAction.getAttribute('href');
    await checkoutAction.click();

    if (!/checkout/i.test(page.url()) && checkoutHref) {
      await page.goto(new URL(checkoutHref, page.url()).toString(), { waitUntil: 'domcontentloaded' });
    }

    await expect(page).toHaveURL(/checkout/i);
    expect(await page.locator('input, textarea, select, button').count()).toBeGreaterThan(0);
  });
});
