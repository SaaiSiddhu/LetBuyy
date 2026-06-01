import { expect, test } from '@playwright/test';
import {
  createCustomerFederationToken,
  redeemCustomerFederationToken,
} from '@letbuyy/auth-core';
import {
  demo,
  expectApiSuccess,
  federationUrls,
  installCustomerSessionCookie,
  openSurface,
  requireRealStack,
  versionHeaders,
} from './real-stack';

const customerSecret = process.env.LETBUYY_E2E_CUSTOMER_SESSION_SECRET ?? 'local-customer-session-placeholder';

test.describe('J5 Customer SSO federation', () => {
  test('passwordless customer federation token mints, redeems once, and opens the storefront customer surface', async ({ page, request }, testInfo) => {
    await requireRealStack(request);

    const federationToken = await createCustomerFederationToken({
      id: '00000000-0000-4000-8000-000000000301',
      storeId: demo.storeId,
      email: 'buyer@letbuyy.local',
      fullName: 'Demo Buyer',
      origin: federationUrls.identity,
      returnTo: `${federationUrls.storefront}/store/${demo.storeSubdomain}/account`,
    }, customerSecret, {
      tokenId: `f8-customer-sso-${Date.now()}`,
    });

    const consumed = new Set<string>();
    const firstRedeem = await redeemCustomerFederationToken(federationToken, customerSecret, {
      consume(tokenId) {
        if (consumed.has(tokenId)) return false;
        consumed.add(tokenId);
        return true;
      },
      });
    expect(firstRedeem.accepted).toBe(true);

    const storefrontStatus = await request.get(`${federationUrls.gateway}/v1/storefront/${demo.storeSubdomain}/status`, {
      failOnStatusCode: false,
      headers: versionHeaders(),
    });
    await expectApiSuccess(storefrontStatus, 'customer SSO storefront status');

    const replay = await redeemCustomerFederationToken(federationToken, customerSecret, {
      consume(tokenId) {
        if (consumed.has(tokenId)) return false;
        consumed.add(tokenId);
        return true;
      },
    });
    expect(replay.accepted).toBe(false);
    expect(replay.status).toBe('replayed');

    await installCustomerSessionCookie(page);
    await openSurface(page, testInfo, `${federationUrls.storefront}/store/${demo.storeSubdomain}/account`, 'j5-storefront-customer-account');
  });
});
