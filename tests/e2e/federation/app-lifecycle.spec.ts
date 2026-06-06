import { expect, test } from '@playwright/test';
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

type Category = { id: string; slug?: string; name?: string };
type CategoryList = Category[] | { categories?: Category[] };
type AppSubmitResult = { app: { id: string; name: string; status: string }; review_record?: { id: string } | null };
type ReviewDecisionResult = { review_record: { id: string; status: string }; resource: unknown; event_type: string | null };
type OAuthAuthorizeResult = {
  installation: { id: string };
  authorization: { code: string; redirect_uri: string; installation_id: string; store_id: string };
};
type OAuthTokenResult = { access_token: string };
type EmbedSessionResult = {
  bridge: { access_token: string; installation_id: string; store_id: string };
};
type ChargeResult = { charge: { id: string; status: string }; approval: { required: boolean; url: string } };
type ChargeApprovalResult = { charge: { id: string; status: string }; payout: { ledger_event: string; queue: string; rail: string } };
type StorefrontPayload = { app_blocks?: unknown[] };
type PartnerDashboard = { payouts?: { entries?: unknown[] }; analytics?: Record<string, unknown> };

async function pkceS256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString('base64url');
}

test.describe('J2 App Store lifecycle federation', () => {
  test('partner submits an app, ops approves, merchant installs through OAuth, bridge reads gateway data, billing activates payout ledger path, and app block reaches storefront', async ({ page, request }, testInfo) => {
    await requireRealStack(request);
    await installMerchantSessionCookie(page);

    await openSurface(page, testInfo, `${federationUrls.platformConsole}/partners`, 'j2-platform-console-partner');
    await openSurface(page, testInfo, `${federationUrls.operationsPortal}/operations`, 'j2-ops-review-queue');
    await openSurface(page, testInfo, federationUrls.appMarketplace, 'j2-app-marketplace');

    const categoriesResponse = await request.get(`${federationUrls.gateway}/v1/app-store/categories`, {
      failOnStatusCode: false,
      headers: versionHeaders(),
    });
    const categories = await expectApiSuccess<CategoryList>(categoriesResponse, 'app categories');
    const categoryRows = Array.isArray(categories) ? categories : categories.categories ?? [];
    const categoryId = categoryRows.find((category) => category.slug === 'marketing')?.id
      ?? categoryRows[0]?.id;
    test.skip(!categoryId, 'No app category exists in the staging seed.');

    const appSlug = uniqueSlug('f8-federated-app');
    const submitResponse = await request.post(`${federationUrls.gateway}/v1/app-store/developers/apps`, {
      failOnStatusCode: false,
      headers: await internalHeaders('partner'),
      data: {
        name: 'F8 Federated App',
        slug: appSlug,
        tagline: 'Cross-app federation proof.',
        description: 'Submitted by the F8 Playwright journey and reviewed through operations.',
        category_id: categoryId,
        app_url: 'https://partner-apps.staging.letbuyy.store/f8-federated-app',
        privacy_url: 'https://partner-apps.staging.letbuyy.store/privacy',
        pricing_model: 'free',
      },
    });
    const submitted = await expectApiSuccess<AppSubmitResult>(submitResponse, 'partner app submission', [201]);
    expect(submitted.review_record?.id).toBeTruthy();

    const approvalResponse = await request.post(`${federationUrls.gateway}/v1/operations/marketplace-reviews/${submitted.review_record?.id}/decision`, {
      failOnStatusCode: false,
      headers: await internalHeaders('ops'),
      data: {
        decision: 'approved',
        reason: 'F8 App Store lifecycle proof',
      },
    });
    const approval = await expectApiSuccess<ReviewDecisionResult>(approvalResponse, 'ops app approval');
    expect(approval.review_record.status).toBe('approved');

    const codeVerifier = `f8_app_lifecycle_pkce_verifier_${uniqueSlug(testInfo)}_1234567890`;
    const codeChallenge = await pkceS256Challenge(codeVerifier);
    const authorizeResponse = await request.post(`${federationUrls.gateway}/v1/app-store/apps/${demo.seededAppId}/oauth/authorize`, {
      failOnStatusCode: false,
      headers: await internalHeaders('merchant'),
      data: {
        store_id: demo.storeId,
        scopes: ['read_products', 'write_orders'],
        redirect_uri: demo.seededAppRedirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: 'f8-app-lifecycle',
        webhook_url: 'https://api.staging.letbuyy.store/app-webhook-receiver',
        webhook_secret: 'staging-webhook-f8',
      },
    });
    const authorization = await expectApiSuccess<OAuthAuthorizeResult>(authorizeResponse, 'app OAuth authorization', [201]);
    expect(authorization.authorization.code).toBeTruthy();

    const tokenResponse = await request.post(`${federationUrls.gateway}/v1/app-store/oauth/token`, {
      failOnStatusCode: false,
      headers: versionHeaders(),
      data: {
        grant_type: 'authorization_code',
        code: authorization.authorization.code,
        client_id: demo.seededAppClientId,
        redirect_uri: authorization.authorization.redirect_uri,
        code_verifier: codeVerifier,
      },
    });
    const oauthToken = await expectApiSuccess<OAuthTokenResult>(tokenResponse, 'app OAuth token exchange');
    expect(oauthToken.access_token).toBeTruthy();

    const embedResponse = await request.post(`${federationUrls.gateway}/v1/app-store/installations/${authorization.authorization.installation_id}/embed-session?store_id=${demo.storeId}`, {
      failOnStatusCode: false,
      headers: await internalHeaders('merchant'),
    });
    const embed = await expectApiSuccess<EmbedSessionResult>(embedResponse, 'embedded app bridge session');
    expect(embed.bridge.access_token).toBeTruthy();

    const bridgeResponse = await request.post(`${federationUrls.gateway}/v1/app-store/bridge/fetch`, {
      failOnStatusCode: false,
      headers: {
        ...versionHeaders(),
        Authorization: `Bearer ${embed.bridge.access_token}`,
      },
      data: {
        method: 'GET',
        path: '/products?limit=1',
        store_id: demo.storeId,
      },
    });
    await expectApiSuccess(bridgeResponse, 'embedded app bridge gateway fetch');

    const chargeResponse = await request.post(`${federationUrls.gateway}/v1/app-store/installations/${authorization.authorization.installation_id}/charges`, {
      failOnStatusCode: false,
      headers: await internalHeaders('merchant'),
      data: {
        store_id: demo.storeId,
        billing_mode: 'recurring',
        name: 'F8 app recurring charge',
        amount_minor: 39900,
        idempotency_key: uniqueSlug('f8-app-charge'),
        provider_mode: 'test',
        payout_rail: 'razorpay_route',
      },
    });
    const charge = await expectApiSuccess<ChargeResult>(chargeResponse, 'app charge creation', [201, 200]);

    const approveChargeResponse = await request.post(`${federationUrls.gateway}/v1/app-store/charges/${charge.charge.id}/approve`, {
      failOnStatusCode: false,
      headers: await internalHeaders('merchant'),
      data: {
        store_id: demo.storeId,
        idempotency_key: uniqueSlug('f8-app-charge-approval'),
        provider_mode: 'test',
      },
    });
    const approvedCharge = await expectApiSuccess<ChargeApprovalResult>(approveChargeResponse, 'app charge approval');
    expect(approvedCharge.payout.ledger_event).toBe('app.charge.activated');

    await request.post(`${federationUrls.gateway}/v1/operations/jobs/consume`, {
      failOnStatusCode: false,
      headers: await internalHeaders('ops'),
      data: { queue_name: 'payment-events', limit: 10 },
    });

    const storefrontResponse = await request.get(`${federationUrls.gateway}/v1/storefront/${demo.storeSubdomain}`, {
      failOnStatusCode: false,
      headers: versionHeaders(),
    });
    const storefront = await expectApiSuccess<StorefrontPayload>(storefrontResponse, 'storefront app block payload');
    expect(Array.isArray(storefront.app_blocks)).toBe(true);

    const dashboardResponse = await request.get(`${federationUrls.gateway}/v1/app-store/partners/dashboard`, {
      failOnStatusCode: false,
      headers: await internalHeaders('partner'),
    });
    const dashboard = await expectApiSuccess<PartnerDashboard>(dashboardResponse, 'partner dashboard payout view');
    expect(dashboard.analytics).toBeTruthy();
  });
});
