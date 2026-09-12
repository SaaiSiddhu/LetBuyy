import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ApproveAppBillingChargeSchema } from '@letbuyy/billing-core';
import { AppBillingChargeApproveSchema } from '@letbuyy/shared-types';

const testDir = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(join(testDir, '../../services/api-gateway/src/routes/app-store/billing-oauth-routes.ts'), 'utf8');
const sharedRouteSource = readFileSync(join(testDir, '../../services/api-gateway/src/routes/app-store/shared.ts'), 'utf8');
// F-ROUTELEN-5: billing-oauth-routes.ts was 22 lines under the route-file line limit, so
// activateExpiredTrialCharge moved to billing-trial.ts. The `app.charge.activated` literal below is
// the trial path's — measured at the phase base, it appeared EXACTLY ONCE in the route file, at the
// line inside that helper. The approve route emits via a computed `trialWindow.activation_event_type`
// and never carried the literal. So this one marker is asserted against the billing surface (route +
// trial helper); every provider-proof marker below stays pinned to the route file alone, which is
// what this contract is actually named for.
const trialSource = readFileSync(join(testDir, '../../services/api-gateway/src/routes/app-store/billing-trial.ts'), 'utf8');
const billingSurfaceSource = `${routeSource}\n${trialSource}`;
const queueSource = readFileSync(join(testDir, '../../services/queue-workers/src/platform-queue-consumer.ts'), 'utf8');

const approvalPayload = {
    store_id: '11111111-1111-4111-8111-111111111111',
    charge_id: '22222222-2222-4222-8222-222222222222',
    idempotency_key: 'app-charge-approval-001',
    provider_reference: 'order_app_charge_001',
    provider_payment_id: 'pay_app_charge_001',
    provider_signature: 'provider-signature',
    provider_mode: 'sandbox',
};

test('app billing approval contracts carry provider proof for activation', () => {
    assert.equal(ApproveAppBillingChargeSchema.safeParse(approvalPayload).success, true);
    assert.equal(AppBillingChargeApproveSchema.safeParse(approvalPayload).success, true);

    const merchantApprovalOnly = {
        store_id: approvalPayload.store_id,
        charge_id: approvalPayload.charge_id,
        idempotency_key: approvalPayload.idempotency_key,
        provider_mode: 'sandbox',
    };
    assert.equal(ApproveAppBillingChargeSchema.safeParse(merchantApprovalOnly).success, true);
    assert.equal(AppBillingChargeApproveSchema.safeParse(merchantApprovalOnly).success, true);
});

test('gateway activates app billing only after provider verification', () => {
    assert.doesNotMatch(routeSource, /rzp_route_test_/);
    assert.match(routeSource, /hasCompleteProviderProof/);
    assert.match(routeSource, /APP_BILLING_PROVIDER_PROOF_REQUIRED/);
    assert.match(routeSource, /APP_BILLING_PROVIDER_UNCONFIGURED/);
    assert.match(routeSource, /APP_BILLING_PROVIDER_SIGNATURE_INVALID/);
    assert.match(routeSource, /hmacSha256Hex\(/);
    assert.match(routeSource, /getRazorpayOrderNotes\(/);
    assert.match(billingSurfaceSource, /eventType: 'app\.charge\.activated'/);
    assert.match(sharedRouteSource, /provider_reference: stringOrNull\(input\.charge\.provider_reference\) \|\| undefined/);
    assert.match(sharedRouteSource, /provider_mode: input\.charge\.provider_mode === 'live' \? 'live' : 'sandbox'/);
    assert.match(queueSource, /provider_reference: payload\.provider_reference \|\| null/);
    assert.match(queueSource, /payout_provider_mode: providerMode/);
    assert.match(queueSource, /planSandboxAppPayoutTransfer/);
    assert.match(queueSource, /eventType: 'payout\.released'/);
});
