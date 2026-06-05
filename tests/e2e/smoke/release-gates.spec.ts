import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

const requireRealStack = process.env.LETBUYY_E2E_REQUIRE_REAL_STACK === '1';
const mutatingSmokeEnabled = requireRealStack || process.env.LETBUYY_E2E_ENABLE_MUTATING_SMOKE === '1';

const urls = {
  gateway: normalizeGatewayUrl(process.env.API_URL || process.env.LETBUYY_E2E_API_URL || 'https://api.staging.letbuyy.store'),
  identity: trimTrailingSlash(process.env.ACCOUNTS_URL || process.env.LETBUYY_E2E_IDENTITY_URL || 'https://accounts.staging.letbuyy.store'),
  webhooks: trimTrailingSlash(process.env.LETBUYY_E2E_WEBHOOK_URL || 'https://webhooks-staging.letbuyy.store'),
};

const smoke = {
  storeSubdomain: process.env.LETBUYY_E2E_STORE_SUBDOMAIN || 'urban-kicks-demo',
  identityEmail: process.env.LETBUYY_E2E_IDENTITY_EMAIL || '',
  identityPassword: process.env.LETBUYY_E2E_IDENTITY_PASSWORD || '',
  turnstileToken: process.env.LETBUYY_E2E_TURNSTILE_TOKEN || 'dev-bypass-token',
};

type Product = {
  id?: unknown;
  name?: unknown;
  title?: unknown;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeGatewayUrl(value: string): string {
  const trimmed = trimTrailingSlash(value);
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

function skipOrFail(condition: boolean, message: string): void {
  if (!condition) return;
  if (requireRealStack) throw new Error(message);
  test.skip(true, message);
}

function requireHttps(url: string, label: string): void {
  const parsed = new URL(url);
  skipOrFail(
    parsed.protocol !== 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.endsWith('.localhost'),
    `${label} must point at deployed HTTPS staging/production, got ${url}.`,
  );
}

async function requireReachable(request: APIRequestContext, url: string, label: string): Promise<APIResponse> {
  requireHttps(url, label);
  const response = await request.get(url, { failOnStatusCode: false, timeout: 5_000 }).catch(() => null);
  skipOrFail(!response, `${label} is not reachable at ${url}. Deploy the target stack and rerun smoke.`);
  skipOrFail(Boolean(response && response.status() >= 500), `${label} returned ${response?.status()} at ${url}.`);
  return response as APIResponse;
}

async function responseJson<T>(response: APIResponse, label: string): Promise<T> {
  const body = await response.json().catch(() => null) as T | null;
  expect(body, `${label} returned a JSON body`).toBeTruthy();
  return body as T;
}

async function fetchSmokeProduct(request: APIRequestContext): Promise<Product> {
  const response = await requireReachable(
    request,
    `${urls.gateway}/storefront/${smoke.storeSubdomain}/products?limit=1`,
    'storefront product API',
  );

  if (response.status() !== 200) {
    skipOrFail(true, `Seeded storefront product read returned ${response.status()} for ${smoke.storeSubdomain}. Seed the smoke store first.`);
  }

  const body = await responseJson<{ success?: boolean; data?: Product[] }>(response, 'storefront product read');
  expect(body.success, 'storefront product read success flag').toBe(true);
  expect(Array.isArray(body.data), 'storefront product read data array').toBe(true);
  skipOrFail(!body.data?.length, `No public products are available for smoke store ${smoke.storeSubdomain}.`);

  const product = body.data?.[0] || {};
  expect(typeof product.id, 'smoke product id').toBe('string');
  return product;
}

test.describe('Release smoke - beta blocker gates', () => {
  test('identity login succeeds with the seeded smoke merchant', async ({ page }) => {
    skipOrFail(!smoke.identityEmail || !smoke.identityPassword, 'LETBUYY_E2E_IDENTITY_EMAIL and LETBUYY_E2E_IDENTITY_PASSWORD are required for identity smoke.');
    requireHttps(urls.identity, 'identity platform');

    const pageResponse = await page.goto(`${urls.identity}/lookup`, { waitUntil: 'domcontentloaded' }).catch(() => null);
    skipOrFail(!pageResponse, `identity platform is not reachable at ${urls.identity}. Deploy the target stack and rerun smoke.`);
    skipOrFail(Boolean(pageResponse && pageResponse.status() >= 500), `identity lookup returned ${pageResponse?.status()} at ${urls.identity}.`);

    const csrfCookie = (await page.context().cookies(urls.identity)).find((cookie) => cookie.name === 'letbuyy_csrf');
    skipOrFail(!csrfCookie?.value, 'Identity CSRF cookie was not set by the deployed identity platform.');

    const response = await page.request.post(`${urls.identity}/api/auth/login`, {
      failOnStatusCode: false,
      headers: {
        'X-CSRF-Token': csrfCookie?.value || '',
        Accept: 'application/json',
      },
      data: {
        email: smoke.identityEmail,
        password: smoke.identityPassword,
        turnstileToken: smoke.turnstileToken,
      },
    });

    if (response.status() === 401 || response.status() === 403) {
      skipOrFail(true, `Identity smoke login returned ${response.status()}. Check seeded credentials, CSRF, and Turnstile configuration.`);
    }

    expect(response.status(), 'identity login HTTP status').toBe(200);
    const body = await responseJson<{ success?: boolean; redirectTo?: string }>(response, 'identity login');
    expect(body.success, 'identity login success flag').toBe(true);
    expect(typeof body.redirectTo, 'identity login redirect').toBe('string');
  });

  test('storefront product read returns a seeded public product', async ({ request }) => {
    const product = await fetchSmokeProduct(request);
    expect(product.id, 'storefront smoke product id').toBeTruthy();
  });

  test('checkout create produces a COD order for the smoke store', async ({ request }) => {
    skipOrFail(!mutatingSmokeEnabled, 'Set LETBUYY_E2E_REQUIRE_REAL_STACK=1 or LETBUYY_E2E_ENABLE_MUTATING_SMOKE=1 to run checkout-create smoke.');

    const product = await fetchSmokeProduct(request);
    const response = await request.post(`${urls.gateway}/storefront/${smoke.storeSubdomain}/orders`, {
      failOnStatusCode: false,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-LetBuyy-API-Version': '2026-06-01',
      },
      data: {
        customer: {
          name: 'LetBuyy Smoke Buyer',
          email: `smoke-${Date.now()}@letbuyy.local`,
          phone: '+919999999999',
          address: {
            address: 'Smoke verification address',
            city: 'Bengaluru',
            state: 'Karnataka',
            stateCode: 'KA',
            pincode: '560001',
          },
        },
        items: [{ productId: product.id, quantity: 1 }],
        paymentMethod: 'cod',
        deliveryOption: 'standard',
        notes: 'Automated release smoke order',
        idempotencyKey: `release-smoke-${randomUUID()}`,
      },
    });

    if (response.status() !== 201) {
      skipOrFail(true, `Checkout create returned ${response.status()}. Seed a COD-enabled smoke store/product before the release gate.`);
    }

    const body = await responseJson<{ success?: boolean; data?: { order?: { id?: string; status?: string } } }>(response, 'checkout create');
    expect(body.success, 'checkout create success flag').toBe(true);
    expect(body.data?.order?.id, 'checkout create order id').toBeTruthy();
    expect(body.data?.order?.status, 'checkout create order status').toBeTruthy();
  });

  test('webhook service rejects a bad Razorpay signature before side effects', async ({ request }) => {
    await requireReachable(request, `${urls.webhooks}/health`, 'webhook service');

    const response = await request.post(`${urls.webhooks}/razorpay`, {
      failOnStatusCode: false,
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'invalid-release-smoke-signature',
      },
      data: {
        event: 'payment.captured',
        created_at: Math.floor(Date.now() / 1000),
        payload: {
          payment: {
            entity: {
              id: `pay_smoke_${Date.now()}`,
              order_id: `order_smoke_${Date.now()}`,
              amount: 100,
              currency: 'INR',
            },
          },
        },
      },
    });

    if (response.status() >= 500) {
      skipOrFail(true, `Bad-signature webhook smoke returned ${response.status()}. Configure deployed webhook secrets before the release gate.`);
    }

    expect(response.status(), 'bad-signature webhook HTTP status').toBe(400);
    const body = await responseJson<{ error?: string | { code?: string; message?: string } }>(response, 'bad-signature webhook');
    expect(JSON.stringify(body).toLowerCase(), 'bad-signature webhook body').toContain('signature');
  });

  test('gateway queue health reports all release queue bindings ready', async ({ request }) => {
    const response = await requireReachable(request, `${urls.gateway}/health/queues`, 'gateway queue health');

    if (response.status() !== 200) {
      skipOrFail(true, `Gateway queue health returned ${response.status()}. Queue bindings must be present before release smoke can pass.`);
    }

    const body = await responseJson<{
      status?: string;
      queues?: Array<{ binding?: string; name?: string; binding_configured?: boolean }>;
    }>(response, 'gateway queue health');

    expect(body.status, 'gateway queue health status').toBe('healthy');
    expect(body.queues?.map((queue) => queue.binding).sort(), 'gateway queue health bindings').toEqual([
      'ANALYTICS_QUEUE',
      'EVENT_QUEUE',
      'NOTIFICATION_QUEUE',
      'RUNTIME_QUEUE',
      'SEARCH_QUEUE',
    ]);

    for (const queue of body.queues || []) {
      expect(queue.name, `${queue.binding} queue name`).toBeTruthy();
      expect(queue.binding_configured, `${queue.binding} binding configured`).toBe(true);
    }
  });
});
