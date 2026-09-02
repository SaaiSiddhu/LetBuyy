import { expect, test } from '@playwright/test';
import {
  demo,
  expectApiSuccess,
  federationUrls,
  installMerchantSessionCookie,
  internalHeaders,
  openSurface,
  requireRealStack,
  requireSurface,
} from './real-stack';

test.describe('J1 Identity SSO federation', () => {
  test('one shared merchant session reaches every web surface and RBAC denies partner access to ops routes', async ({ page, request }, testInfo) => {
    await requireRealStack(request);

    await Promise.all([
      requireSurface(request, federationUrls.identity, 'identity-platform'),
      requireSurface(request, federationUrls.merchant, 'merchant-web'),
      requireSurface(request, federationUrls.appMarketplace, 'app-marketplace'),
      requireSurface(request, federationUrls.themeMarketplace, 'theme-marketplace'),
      requireSurface(request, federationUrls.platformConsole, 'admin-web'),
      requireSurface(request, federationUrls.operationsPortal, 'platform-operations-portal'),
    ]);

    await installMerchantSessionCookie(page);

    await openSurface(page, testInfo, `${federationUrls.identity}/lookup?return_to=${encodeURIComponent(federationUrls.appMarketplace)}`, 'j1-identity-lookup');
    await openSurface(page, testInfo, `${federationUrls.merchant}/${demo.storeSubdomain}`, 'j1-merchant-web');
    await openSurface(page, testInfo, federationUrls.appMarketplace, 'j1-app-marketplace');
    await openSurface(page, testInfo, federationUrls.themeMarketplace, 'j1-theme-marketplace');
    await openSurface(page, testInfo, federationUrls.platformConsole, 'j1-admin-web');
    await openSurface(page, testInfo, federationUrls.operationsPortal, 'j1-operations-portal');

    const partnerDenied = await request.get(`${federationUrls.gateway}/v1/operations/marketplace-reviews?limit=1`, {
      failOnStatusCode: false,
      headers: await internalHeaders('partner'),
    });
    if (partnerDenied.status() === 401) {
      test.skip(true, 'Gateway rejected staging internal auth before RBAC. Check staging secrets and rerun with LETBUYY_E2E_REQUIRE_REAL_STACK=1.');
    }
    expect(partnerDenied.status()).toBe(403);

    const opsAllowed = await request.get(`${federationUrls.gateway}/v1/operations/marketplace-reviews?limit=1`, {
      failOnStatusCode: false,
      headers: await internalHeaders('ops'),
    });
    await expectApiSuccess(opsAllowed, 'ops marketplace review list');
  });
});
