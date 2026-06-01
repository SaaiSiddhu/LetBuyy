import { expect, test, type APIRequestContext, type APIResponse, type Page, type TestInfo } from '@playwright/test';
import {
  LETBUYY_CUSTOMER_SESSION_COOKIE,
  LETBUYY_MERCHANT_SESSION_COOKIE,
  createCustomerSessionToken,
  createLetbuyyInternalIdentityHeaders,
} from '@letbuyy/auth-core';

export const federationUrls = {
  gateway: process.env.LETBUYY_E2E_API_URL ?? 'http://127.0.0.1:8787',
  marketing: process.env.LETBUYY_E2E_MARKETING_URL ?? 'http://127.0.0.1:3000',
  identity: process.env.LETBUYY_E2E_IDENTITY_URL ?? 'http://127.0.0.1:3001',
  merchant: process.env.LETBUYY_E2E_MERCHANT_URL ?? 'http://127.0.0.1:3002',
  storefront: process.env.LETBUYY_E2E_STOREFRONT_URL ?? 'http://127.0.0.1:3003',
  appMarketplace: process.env.LETBUYY_E2E_APP_MARKETPLACE_URL ?? 'http://127.0.0.1:3004',
  themeMarketplace: process.env.LETBUYY_E2E_THEME_MARKETPLACE_URL ?? 'http://127.0.0.1:3005',
  platformConsole: process.env.LETBUYY_E2E_PLATFORM_CONSOLE_URL ?? 'http://127.0.0.1:3010',
  operationsPortal: process.env.LETBUYY_E2E_OPERATIONS_PORTAL_URL ?? 'http://127.0.0.1:3011',
};

export const demo = {
  merchantUserId: '00000000-0000-4000-8000-000000000001',
  merchantEmail: 'merchant@letbuyy.local',
  partnerUserId: '00000000-0000-4000-8000-000000000002',
  partnerEmail: 'partner@letbuyy.local',
  opsUserId: '00000000-0000-4000-8000-000000000003',
  opsEmail: 'ops@letbuyy.local',
  storeId: '00000000-0000-4000-8000-000000000010',
  storeSubdomain: process.env.LETBUYY_E2E_STORE_SUBDOMAIN ?? 'urban-kicks-demo',
  seededAppId: '00000000-0000-4000-8000-000000000202',
  seededAppClientId: 'demo-loyalty-rewards-client',
  seededAppRedirectUri: 'http://127.0.0.1:3004/oauth/callback',
  seededProductId: '00000000-0000-4000-8000-000000000101',
};

type DemoActor = 'merchant' | 'partner' | 'ops';

const actorProfiles = {
  merchant: { userId: demo.merchantUserId, email: demo.merchantEmail, storeId: demo.storeId },
  partner: { userId: demo.partnerUserId, email: demo.partnerEmail },
  ops: { userId: demo.opsUserId, email: demo.opsEmail },
} satisfies Record<DemoActor, { userId: string; email: string; storeId?: string }>;

const localInternalSecret = process.env.LETBUYY_E2E_INTERNAL_API_SECRET ?? 'local-internal-api-placeholder';
const localCustomerSecret = process.env.LETBUYY_E2E_CUSTOMER_SESSION_SECRET ?? 'local-customer-session-placeholder';

function forceLive(): boolean {
  return process.env.LETBUYY_E2E_REQUIRE_REAL_STACK === '1';
}

function skipOrThrow(condition: boolean, message: string): void {
  if (!condition) return;
  if (forceLive()) throw new Error(message);
  test.skip(true, message);
}

function assertLoopback(url: string, label: string): void {
  const hostname = new URL(url).hostname;
  skipOrThrow(
    hostname !== '127.0.0.1' && hostname !== 'localhost' && !hostname.endsWith('.localhost'),
    `${label} must point at the real local stack, got ${url}. Set LETBUYY_E2E_ALLOW_NON_LOCAL=1 only for an approved non-local execution.`,
  );
}

export async function requireRealStack(request: APIRequestContext): Promise<void> {
  for (const [label, url] of Object.entries(federationUrls)) {
    assertLoopback(url, label);
  }

  const health = await request.get(`${federationUrls.gateway}/health`, {
    failOnStatusCode: false,
    timeout: 3_000,
  }).catch(() => null);
  skipOrThrow(!health, `Gateway is not reachable at ${federationUrls.gateway}. Run pnpm run federation:local:up first.`);
  skipOrThrow(Boolean(health && health.status() >= 500), `Gateway health returned ${health?.status()}.`);

  const productProbe = await request.get(
    `${federationUrls.gateway}/v1/storefront/${demo.storeSubdomain}/products?limit=1`,
    {
      failOnStatusCode: false,
      timeout: 5_000,
      headers: versionHeaders(),
    },
  ).catch(() => null);
  skipOrThrow(
    !productProbe || productProbe.status() !== 200,
    `Seeded storefront product query did not return 200. Run the real Supabase local stack seed before this suite.`,
  );
}

export async function requireSurface(request: APIRequestContext, url: string, label: string): Promise<void> {
  assertLoopback(url, label);
  const response = await request.get(url, { failOnStatusCode: false, timeout: 3_000 }).catch(() => null);
  skipOrThrow(!response, `${label} is not reachable at ${url}. Run pnpm run federation:local:up first.`);
  skipOrThrow(Boolean(response && response.status() >= 500), `${label} returned ${response?.status()} at ${url}.`);
}

export function versionHeaders(): Record<string, string> {
  return {
    'X-LetBuyy-API-Version': '2026-06-01',
  };
}

export async function internalHeaders(actor: DemoActor): Promise<Record<string, string>> {
  const profile = actorProfiles[actor];
  const signed = await createLetbuyyInternalIdentityHeaders({
    userId: profile.userId,
    email: profile.email,
    storeId: profile.storeId,
    secret: localInternalSecret,
  });

  if (!signed.ok || !signed.headers) {
    throw new Error(signed.reason || `Could not sign ${actor} internal identity headers`);
  }

  return {
    ...versionHeaders(),
    ...signed.headers,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function expectApiSuccess<T = unknown>(
  response: APIResponse,
  label: string,
  statuses: number[] = [200],
): Promise<T> {
  if (response.status() === 401 && !forceLive()) {
    test.skip(true, `${label} rejected local internal auth. Check local stack secrets and rerun with LETBUYY_E2E_REQUIRE_REAL_STACK=1.`);
  }

  expect(statuses, `${label} returned ${response.status()}`).toContain(response.status());
  const body = await response.json().catch(() => null) as { success?: boolean; data?: T } | T | null;
  expect(body, `${label} returned an empty JSON body`).toBeTruthy();
  if (body && typeof body === 'object' && 'success' in body) {
    expect((body as { success?: boolean }).success, `${label} success flag`).not.toBe(false);
    return (body as { data?: T }).data as T;
  }
  return body as T;
}

export async function openSurface(page: Page, testInfo: TestInfo, url: string, name: string): Promise<void> {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response?.status() ?? 0, `${name} HTTP status`).toBeLessThan(500);
  await expect(page.locator('body')).toBeVisible();
  await recordJourneyEvidence(page, testInfo, name);
}

export async function recordJourneyEvidence(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await testInfo.attach(`${safeName}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

export async function installMerchantSessionCookie(page: Page): Promise<void> {
  const sessionValue = 's'.repeat(48);
  await page.context().addCookies([
    federationUrls.identity,
    federationUrls.merchant,
    federationUrls.appMarketplace,
    federationUrls.themeMarketplace,
    federationUrls.platformConsole,
    federationUrls.operationsPortal,
  ].map((url) => ({
    name: LETBUYY_MERCHANT_SESSION_COOKIE,
    value: sessionValue,
    url,
    path: '/',
    sameSite: 'Lax' as const,
  })));
}

export async function installCustomerSessionCookie(page: Page): Promise<void> {
  const token = await createCustomerSessionToken({
    id: '00000000-0000-4000-8000-000000000301',
    storeId: demo.storeId,
    email: 'buyer@letbuyy.local',
    fullName: 'Demo Buyer',
  }, localCustomerSecret);

  await page.context().addCookies([
    federationUrls.storefront,
    `http://${demo.storeSubdomain}.localhost:${new URL(federationUrls.storefront).port || '3003'}`,
  ].map((url) => ({
    name: LETBUYY_CUSTOMER_SESSION_COOKIE,
    value: token,
    url,
    path: '/',
    sameSite: 'Lax' as const,
  })));
}

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
