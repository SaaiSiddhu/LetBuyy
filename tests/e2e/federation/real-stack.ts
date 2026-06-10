import { expect, test, type APIRequestContext, type APIResponse, type Page, type TestInfo } from '@playwright/test';
import {
  LETBUYY_CUSTOMER_SESSION_COOKIE,
  LETBUYY_MERCHANT_SESSION_COOKIE,
  createCustomerSessionToken,
  createLetbuyyInternalIdentityHeaders,
} from '@letbuyy/auth-core';

export const federationUrls = {
  gateway: process.env.LETBUYY_E2E_API_URL ?? 'https://api-staging.letbuyy.com',
  marketing: process.env.LETBUYY_E2E_MARKETING_URL ?? 'https://www-staging.letbuyy.com',
  identity: process.env.LETBUYY_E2E_IDENTITY_URL ?? 'https://accounts-staging.letbuyy.com',
  merchant: process.env.LETBUYY_E2E_MERCHANT_URL ?? 'https://admin-staging.letbuyy.com',
  storefront: process.env.LETBUYY_E2E_STOREFRONT_URL ?? 'https://store-staging.letbuyy.com',
  appMarketplace: process.env.LETBUYY_E2E_APP_MARKETPLACE_URL ?? 'https://apps-staging.letbuyy.com',
  themeMarketplace: process.env.LETBUYY_E2E_THEME_MARKETPLACE_URL ?? 'https://themes-staging.letbuyy.com',
  platformConsole: process.env.LETBUYY_E2E_PLATFORM_CONSOLE_URL ?? 'https://console-staging.letbuyy.com',
  operationsPortal: process.env.LETBUYY_E2E_OPERATIONS_PORTAL_URL ?? 'https://ops-staging.letbuyy.com',
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
  seededAppRedirectUri: 'https://apps-staging.letbuyy.com/oauth/callback',
  seededProductId: '00000000-0000-4000-8000-000000000101',
};

type DemoActor = 'merchant' | 'partner' | 'ops';

const actorProfiles = {
  merchant: { userId: demo.merchantUserId, email: demo.merchantEmail, storeId: demo.storeId },
  partner: { userId: demo.partnerUserId, email: demo.partnerEmail },
  ops: { userId: demo.opsUserId, email: demo.opsEmail },
} satisfies Record<DemoActor, { userId: string; email: string; storeId?: string }>;

const stagingInternalSecret = process.env.LETBUYY_E2E_INTERNAL_API_SECRET ?? 'staging-internal-api-placeholder';
const stagingCustomerSecret = process.env.LETBUYY_E2E_CUSTOMER_SESSION_SECRET ?? 'staging-customer-session-placeholder';

function forceLive(): boolean {
  return process.env.LETBUYY_E2E_REQUIRE_REAL_STACK === '1';
}

function skipOrThrow(condition: boolean, message: string): void {
  if (!condition) return;
  if (forceLive()) throw new Error(message);
  test.skip(true, message);
}

function assertDeployedHttps(url: string, label: string): void {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  skipOrThrow(
    parsed.protocol !== 'https:' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost'),
    `${label} must point at deployed staging or an approved HTTPS preview target, got ${url}.`,
  );
}

export async function requireRealStack(request: APIRequestContext): Promise<void> {
  for (const [label, url] of Object.entries(federationUrls)) {
    assertDeployedHttps(url, label);
  }

  const health = await request.get(`${federationUrls.gateway}/health`, {
    failOnStatusCode: false,
    timeout: 3_000,
  }).catch(() => null);
  skipOrThrow(!health, `Gateway is not reachable at ${federationUrls.gateway}. Deploy staging and configure CI secrets before this suite.`);
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
    `Seeded storefront product query did not return 200. Seed staging before this suite.`,
  );
}

export async function requireSurface(request: APIRequestContext, url: string, label: string): Promise<void> {
  assertDeployedHttps(url, label);
  const response = await request.get(url, { failOnStatusCode: false, timeout: 3_000 }).catch(() => null);
  skipOrThrow(!response, `${label} is not reachable at ${url}. Deploy staging and configure CI secrets before this suite.`);
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
    secret: stagingInternalSecret,
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
    test.skip(true, `${label} rejected staging internal auth. Check staging secrets and rerun with LETBUYY_E2E_REQUIRE_REAL_STACK=1.`);
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
    sameSite: 'Lax' as const,
  })));
}

export async function installCustomerSessionCookie(page: Page): Promise<void> {
  const token = await createCustomerSessionToken({
    id: '00000000-0000-4000-8000-000000000301',
    storeId: demo.storeId,
    email: 'buyer@letbuyy.local',
    fullName: 'Demo Buyer',
  }, stagingCustomerSecret);

  await page.context().addCookies([
    federationUrls.storefront,
    `https://${demo.storeSubdomain}.staging.letbuyy.com`,
  ].map((url) => ({
    name: LETBUYY_CUSTOMER_SESSION_COOKIE,
    value: token,
    url,
    sameSite: 'Lax' as const,
  })));
}

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
