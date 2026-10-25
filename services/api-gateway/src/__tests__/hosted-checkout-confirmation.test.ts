import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmationDecision, confirmationClaimPatch, type HostedCheckoutSession } from '../lib/hosted-checkout-session';

const scope = { siteId: 'synthetic-site', cartId: 'synthetic-cart', cartToken: 'synthetic-token', cartStatus: 'converted' };
const claim = { id: 'synthetic-claim', requestHash: 'synthetic-request-hash', intentId: 'synthetic-intent' };
function payment(): HostedCheckoutSession {
    return { id: 'synthetic-session', site_id: scope.siteId, cart_id: scope.cartId, cart_token: scope.cartToken,
        status: 'payment_intent', checkout_state: 'payment_intent', updated_at: '2026-10-24T14:00:00.123456Z',
        payment_method: 'razorpay', payment_intent: { provider: 'razorpay', payment_intent_id: claim.intentId,
            order_id: 'synthetic-order', provider_order_id: 'order_synthetic', amount_minor: 122000, currency: 'INR' } };
}

test('a converted Razorpay cart may confirm its already bound pending order', () => {
    assert.equal(confirmationDecision(payment(), scope, claim), 'claim');
    const confirming = { ...payment(), status: 'confirming', checkout_state: 'confirming' as const,
        ...confirmationClaimPatch(payment(), claim) };
    assert.equal(confirmationDecision(confirming, scope, claim), 'resume');
    assert.equal(confirmationDecision(confirming, scope, { ...claim, id: 'another-claim' }), 'deny');
    assert.equal(confirmationDecision(confirming, scope, { ...claim, requestHash: 'changed-request' }), 'deny');
});

test('converted Razorpay recovery does not reopen COD, incomplete, foreign or closed sessions', () => {
    const original = payment();
    for (const row of [
        { ...original, payment_method: 'cod', payment_intent: { provider: 'cod', payment_intent_id: claim.intentId } },
        { ...original, payment_intent: { ...original.payment_intent, order_id: null } },
        { ...original, payment_intent: { ...original.payment_intent, provider_order_id: null } },
        { ...original, payment_intent: { ...original.payment_intent, amount_minor: 0 } },
        { ...original, payment_intent: { ...original.payment_intent, currency: 'USD' } },
        { ...original, site_id: 'another-site' },
        { ...original, failed_at: '2026-10-24T14:01:00Z' },
        { ...original, confirmed_at: '2026-10-24T14:01:00Z' },
    ]) assert.equal(confirmationDecision(row, scope, claim), 'deny');
    for (const cartStatus of ['abandoned', 'expired', 'cancelled', null]) {
        assert.equal(confirmationDecision(original, { ...scope, cartStatus }, claim), 'deny');
    }
});
