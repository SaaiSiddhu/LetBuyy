import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createAiCreditPurchaseAdapter } from '@letbuyy/infrastructure/ai-credit-purchase-adapter';
import { createAiCapabilitySeam, createAiGenerationAdapter } from '@letbuyy/infrastructure/ai-generation-adapter';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const aiRouteSource = readFileSync(new URL('../routes/ai.ts', import.meta.url), 'utf8');
const bffSource = readFileSync(new URL('../../../mobile-bff/src/index.ts', import.meta.url), 'utf8');
const wranglerSource = readFileSync(new URL('../../wrangler.toml', import.meta.url), 'utf8');
const appEngineSource = readFileSync(new URL('../../../../packages/shared-types/src/app-platform.ts', import.meta.url), 'utf8');
const sharedTypesSource = readFileSync(new URL('../../../../packages/shared-types/src/index.ts', import.meta.url), 'utf8');
const mobileAiServiceSource = readFileSync(
    new URL('../../../../apps/merchant/mobile/lib/services/ai_studio_service.dart', import.meta.url),
    'utf8'
);
const mobileEditorSource = readFileSync(
    new URL('../../../../apps/merchant/mobile/lib/screens/editor/section_editor_screen.dart', import.meta.url),
    'utf8'
);
const tsClientSource = readFileSync(new URL('../../../../packages/typescript/api-client/src/index.ts', import.meta.url), 'utf8');
const dartClientSource = readFileSync(new URL('../../../../packages/dart/api_client/lib/src/api_client.dart', import.meta.url), 'utf8');

test('merchant AI route is mounted, mobile allowlisted, and provider-backed', () => {
    assert.match(indexSource, /import aiRouter from '\.\/routes\/ai'/);
    assert.match(indexSource, /api\.route\('\/ai', aiRouter\)/);
    assert.match(bffSource, /'\/v1\/ai'/);
    assert.match(aiRouteSource, /router\.post\('\/generate'/);
    assert.match(aiRouteSource, /createAiGenerationAdapter/);
    assert.match(aiRouteSource, /createAiCreditPurchaseAdapter/);
    assert.match(aiRouteSource, /adapter\.generate/);
    assert.match(aiRouteSource, /adapter\.available/);
    assert.match(aiRouteSource, /router\.post\('\/operator'/);
    assert.match(aiRouteSource, /router\.post\('\/homepage'/);
    assert.match(aiRouteSource, /genericAiOperatorUnavailable/);
    assert.match(aiRouteSource, /'create_product'/);
    assert.match(aiRouteSource, /'draft_discount'/);
    assert.match(aiRouteSource, /'draft_homepage_section'/);
    assert.match(aiRouteSource, /\.from\('ai_usage'\)[\s\S]*status:\s*'completed'/);
    assert.match(aiRouteSource, /feature:\s*'homepage_generator'/);
    assert.match(aiRouteSource, /AI_HOMEPAGE_GENERATOR_UNAVAILABLE/);
    assert.match(aiRouteSource, /loadAiCreditProjection/);
    assert.match(aiRouteSource, /projection_source:\s*'ai_usage'/);
    assert.match(aiRouteSource, /SKIP-B6-AI-CREDIT-DESIGN-ARB/);
    assert.doesNotMatch(aiRouteSource, /\.from\('ai_credits'\)[\s\S]{0,500}\.(?:insert|update|upsert|delete)/);
    assert.match(aiRouteSource, /purchase_available/);
    assert.match(aiRouteSource, /LETBUYY_AI_MODEL_MODE === 'live' \? 'live' : 'sandbox'/);
    assert.doesNotMatch(aiRouteSource, /LETBUYY_AI_MODEL_MODE \|\| 'mock'/);
    assert.doesNotMatch(aiRouteSource, /\.from\('products'\)[^\n]*\.insert/);
    assert.doesNotMatch(aiRouteSource, /\.from\('coupons'\)[^\n]*\.insert/);
    assert.doesNotMatch(aiRouteSource, /AI generation is not configured for this environment/);
    assert.doesNotMatch(aiRouteSource, /AI credit purchases are not configured/);
});

test('AI provider configuration is sandbox-first and live credential-gated', async () => {
    const sandboxAdapter = createAiGenerationAdapter({
        mode: 'sandbox',
        provider: 'letbuyy_sandbox',
        model: 'letbuyy-sandbox-copywriter',
    });
    const result = await sandboxAdapter.generate({
        storeId: 'store_1',
        feature: 'product_description',
        prompt: 'Write concise copy for a cotton tee',
    });

    assert.equal(sandboxAdapter.available, true);
    assert.equal(result.providerMode, 'sandbox');
    assert.equal(result.provider, 'letbuyy_sandbox');
    assert.match(result.output, /Product Description draft/);

    const liveAdapter = createAiGenerationAdapter({
        mode: 'live',
        provider: 'openai_compatible',
        model: 'SKIP_NEEDS_HUMAN_AI_PROVIDER_MODEL',
        apiKey: 'SKIP_NEEDS_HUMAN_AI_PROVIDER_API_KEY',
        environment: 'production',
    });

    assert.equal(liveAdapter.available, false);
    assert.match(liveAdapter.unavailableReason || '', /credentials and model/);

    const sandboxSeam = createAiCapabilitySeam({});
    assert.equal(sandboxSeam.mode, 'sandbox');
    assert.equal(sandboxSeam.modelCallsEnabled, false);
    assert.equal(sandboxSeam.status, 'ready_for_interface');

    const liveSeam = createAiCapabilitySeam({ mode: 'live' });
    assert.equal(liveSeam.mode, 'live');
    assert.equal(liveSeam.modelCallsEnabled, false);
    assert.equal(liveSeam.status, 'human_required');
});

test('AI credit purchase is sandbox-first and live Razorpay credential-gated', async () => {
    const sandboxAdapter = createAiCreditPurchaseAdapter({
        mode: 'sandbox',
        provider: 'letbuyy_sandbox',
        pricePerCreditMinor: '100',
    });
    const sandboxPurchase = await sandboxAdapter.purchase({
        storeId: 'store_1',
        userId: 'user_1',
        credits: 100,
        idempotencyKey: 'purchase_1',
    });

    assert.equal(sandboxAdapter.available, true);
    assert.equal(sandboxPurchase.status, 'completed');
    assert.equal(sandboxPurchase.providerMode, 'sandbox');
    assert.equal(sandboxPurchase.amountMinor, 10000);

    const requests: Array<{ url: string; body: Record<string, unknown>; authorization: string | null }> = [];
    const liveAdapter = createAiCreditPurchaseAdapter({
        mode: 'live',
        provider: 'razorpay',
        razorpayKeyId: 'configured-provider-id-fixture',
        razorpayKeySecret: 'configured-provider-auth-fixture',
        environment: 'production',
        fetch: async (url, init) => {
            requests.push({
                url: String(url),
                body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
                authorization: init?.headers instanceof Headers
                    ? init.headers.get('Authorization')
                    : (init?.headers as Record<string, string> | undefined)?.Authorization || null,
            });
            return new Response(JSON.stringify({
                id: 'plink_ai_credit_1',
                short_url: 'https://rzp.io/i/aiCredit1',
                status: 'created',
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        },
    });

    assert.equal(liveAdapter.available, true);
    assert.equal(liveAdapter.unavailableReason, null);
    const livePurchase = await liveAdapter.purchase({
        storeId: 'store_1',
        userId: 'user_1',
        credits: 100,
        idempotencyKey: 'purchase_live_1',
    });

    assert.equal(livePurchase.status, 'pending_provider_payment');
    assert.equal(livePurchase.providerMode, 'live');
    assert.equal(livePurchase.providerReference, 'plink_ai_credit_1');
    assert.equal(livePurchase.checkoutUrl, 'https://rzp.io/i/aiCredit1');
    assert.equal(livePurchase.metadata.credit_grant_deferred_until_provider_webhook, true);
    const paymentLinkUrl = new URL(requests[0].url);
    assert.equal(paymentLinkUrl.protocol, 'https:');
    assert.equal(paymentLinkUrl.pathname, '/v1/payment_links');
    assert.equal(requests[0].body.amount, 10000);
    assert.equal(requests[0].body.currency, 'INR');
    assert.equal(requests[0].body.accept_partial, false);
    assert.equal((requests[0].body.notes as Record<string, unknown>).source_type, 'ai_credit_purchase');
    assert.match(requests[0].authorization || '', /^Basic /);

    const missingCredentialAdapter = createAiCreditPurchaseAdapter({
        mode: 'live',
        provider: 'razorpay',
        razorpayKeyId: 'SKIP_NEEDS_HUMAN_AI_CREDIT_RAZORPAY_KEY_ID',
        razorpayKeySecret: 'configured-provider-auth-fixture',
        environment: 'production',
    });
    assert.equal(missingCredentialAdapter.available, false);
    assert.match(missingCredentialAdapter.unavailableReason || '', /credentials and webhook certification/);
    await assert.rejects(
        () => missingCredentialAdapter.purchase({
            storeId: 'store_1',
            userId: 'user_1',
            credits: 100,
            idempotencyKey: 'purchase_live_2',
        }),
        (error) => {
            assert.equal((error as { code?: string }).code, 'AI_CREDIT_PURCHASE_LIVE_PROVIDER_UNAVAILABLE');
            return true;
        },
    );

    assert.match(sharedTypesSource, /pending_provider_payment/);
});

test('AI schemas and mobile service accept the mobile generation contract', () => {
    assert.match(appEngineSource, /'social_copy'/);
    assert.match(appEngineSource, /'email_campaign'/);
    assert.match(appEngineSource, /AiOperatorCommandSchema/);
    assert.match(appEngineSource, /AiHomepageGenerationSchema/);
    assert.match(tsClientSource, /\/ai\/homepage/);
    assert.match(dartClientSource, /\/ai\/homepage/);
    assert.match(mobileAiServiceSource, /_api\.ai\.generate/);
    assert.match(mobileAiServiceSource, /generateHomepageDraft/);
    assert.match(mobileAiServiceSource, /_api\.ai\.homepage/);
    assert.match(mobileAiServiceSource, /runOperatorCommand/);
    assert.match(mobileAiServiceSource, /_api\.products\.create/);
    assert.match(mobileAiServiceSource, /_api\.coupons\.create/);
    assert.match(mobileAiServiceSource, /_api\.themes\.saveDraft/);
    assert.match(mobileAiServiceSource, /AiFeatureUnavailableException/);
    assert.match(mobileEditorSource, /Describe your homepage/);
    assert.match(mobileEditorSource, /_showAiHomepageSheet/);
    assert.match(mobileEditorSource, /themeService\.saveDraft/);
    assert.doesNotMatch(mobileAiServiceSource, /MOBILE_AI_GENERATION_PROVIDER/);
});

test('AI wrangler config documents sandbox defaults and production human approval', () => {
    assert.match(wranglerSource, /AI_PROVIDER_MODE = "sandbox"/);
    assert.match(wranglerSource, /AI_PROVIDER = "letbuyy_sandbox"/);
    assert.match(wranglerSource, /AI_PROVIDER_MODEL = "letbuyy-sandbox-copywriter"/);
    assert.match(wranglerSource, /AI_CREDIT_PURCHASE_MODE = "sandbox"/);
    assert.match(wranglerSource, /AI_CREDIT_PURCHASE_PROVIDER = "letbuyy_sandbox"/);
    assert.match(wranglerSource, /AI_CREDIT_RAZORPAY_KEY_ID = "SKIP_NEEDS_HUMAN_AI_CREDIT_RAZORPAY_KEY_ID"/);
    assert.doesNotMatch(wranglerSource, /AI_PROVIDER_MODE = "live"[\s\S]*SKIP_NEEDS_HUMAN_AI_PROVIDER_MODEL/);
    assert.doesNotMatch(wranglerSource, /AI_CREDIT_PURCHASE_MODE = "live"[\s\S]*SKIP_NEEDS_HUMAN_AI_CREDIT_RAZORPAY_KEY_ID/);
});
