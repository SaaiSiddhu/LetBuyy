import { expect, test } from '@playwright/test';
import { createMinimalThemeBundleFixture } from '@letbuyy/theme-engine';
import {
  demo,
  expectApiSuccess,
  federationUrls,
  installMerchantSessionCookie,
  internalHeaders,
  openSurface,
  requireRealStack,
  uniqueSlug,
  versionHeaders,
} from './real-stack';

type ThemeUploadResult = {
  package?: { id: string; slug: string; name: string };
  review_record?: { id: string } | null;
};
type ThemeDecisionResult = { review_record: { id: string; status: string }; event_type: string | null };
type ThemeInstallResult = { installation?: unknown; release?: unknown; theme?: unknown };

test.describe('J3 Theme Store lifecycle federation', () => {
  test('partner submits a portable theme, ops approves it, marketplace lists it, merchant installs it, and storefront renders without code changes', async ({ page, request }, testInfo) => {
    await requireRealStack(request);
    await installMerchantSessionCookie(page);

    await openSurface(page, testInfo, `${federationUrls.platformConsole}/themes`, 'j3-admin-web-theme-submit');
    await openSurface(page, testInfo, `${federationUrls.operationsPortal}/operations`, 'j3-ops-theme-review');
    await openSurface(page, testInfo, `${federationUrls.themeMarketplace}/themes`, 'j3-theme-marketplace-list');

    const bundle = createMinimalThemeBundleFixture();
    const slug = uniqueSlug('f8-json-theme');
    bundle.package.slug = slug;
    bundle.package.name = 'F8 JSON Theme';
    bundle.package.description = 'Portable JSON-contract theme submitted by the F8 journey.';
    bundle.templates.index.sections.hero.settings.heading = 'F8 JSON Theme';

    const uploadResponse = await request.post(`${federationUrls.gateway}/v1/themes/packages/upload`, {
      failOnStatusCode: false,
      headers: await internalHeaders('partner'),
      data: {
        submission_mode: 'marketplace',
        bundle,
      },
    });
    const upload = await expectApiSuccess<ThemeUploadResult>(uploadResponse, 'theme package upload', [201]);
    expect(upload.review_record?.id).toBeTruthy();

    const approvalResponse = await request.post(`${federationUrls.gateway}/v1/operations/marketplace-reviews/${upload.review_record?.id}/decision`, {
      failOnStatusCode: false,
      headers: await internalHeaders('ops'),
      data: {
        decision: 'approved',
        reason: 'F8 Theme Store lifecycle proof',
      },
    });
    const approval = await expectApiSuccess<ThemeDecisionResult>(approvalResponse, 'ops theme approval');
    expect(approval.review_record.status).toBe('approved');
    expect(approval.event_type).toBe('theme.approved');

    const listedResponse = await request.get(`${federationUrls.gateway}/v1/themes?search=${encodeURIComponent(slug)}&limit=10`, {
      failOnStatusCode: false,
      headers: versionHeaders(),
    });
    await expectApiSuccess(listedResponse, 'theme marketplace listing');

    const installResponse = await request.post(`${federationUrls.gateway}/v1/themes/${slug}/install`, {
      failOnStatusCode: false,
      headers: await internalHeaders('merchant'),
      data: {
        store_id: demo.storeId,
        config_overrides: {},
      },
    });
    const install = await expectApiSuccess<ThemeInstallResult>(installResponse, 'theme install into store', [201]);
    expect(install).toBeTruthy();

    const storefrontResponse = await request.get(`${federationUrls.gateway}/v1/storefront/${demo.storeSubdomain}`, {
      failOnStatusCode: false,
      headers: versionHeaders(),
    });
    await expectApiSuccess(storefrontResponse, 'storefront render payload after theme install');
  });
});
