import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function repositorySource(path: string): string {
    return readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
}

test('subscription failed-payment recovery is a real gateway and mobile contract', () => {
    const route = repositorySource('services/api-gateway/src/routes/payments.ts');
    const helper = repositorySource('services/api-gateway/src/lib/subscription-checkout.ts');
    const billingCore = repositorySource('packages/billing-core/src/index.ts');
    const sharedTypes = repositorySource('packages/shared-types/src/index.ts');
    const tsClient = repositorySource('packages/typescript/api-client/src/index.ts');
    const dartClient = repositorySource('packages/dart/api_client/lib/src/api_client.dart');
    const mobileService = repositorySource('apps/merchant_app/lib/services/subscription_service.dart');
    const billingScreen = repositorySource('apps/merchant_app/lib/screens/settings/billing_screen.dart');
    const mobileTest = repositorySource('apps/merchant_app/test/mobile_services_test.dart');

    assert.match(billingCore, /RecoverSubscriptionPaymentSchema/);
    assert.match(sharedTypes, /SubscriptionRecoveryResultSchema/);
    assert.match(route, /router\.post\('\/subscription\/recover'/);
    assert.match(route, /RecoverSubscriptionPaymentSchema/);
    assert.match(route, /\.in\('status', \['past_due', 'failed'\]\)/);
    assert.match(route, /SUBSCRIPTION_RECOVERY_UNAVAILABLE/);
    assert.match(route, /createMerchantSubscriptionCheckout\(/);
    assert.match(helper, /createRazorpaySubscription/);
    assert.match(helper, /createRazorpayOrder/);
    assert.match(helper, /activateMerchantSubscription/);
    assert.match(tsClient, /\/payments\/subscription\/recover/);
    assert.match(dartClient, /\/payments\/subscription\/recover/);
    assert.match(mobileService, /recoverFailedPayment/);
    assert.match(billingScreen, /Retry payment/);
    assert.match(billingScreen, /RazorpayCheckoutScreen/);
    assert.match(mobileTest, /BillingScreen starts failed-payment recovery/);
});
