/**
 * Phase M3-REVISED (W1) — DOC 03 row 11 "Payments": Razorpay + COD are the
 * only live money-in rails. draft_orders_payment_method_check (migration
 * 116) still permits 'stripe'/'cashfree' at the storage layer and was never
 * narrowed alongside CreateDraftOrderSchema (narrowed to razorpay/cod,
 * Phase M1), so a pre-M1 draft can still carry a retired rail. Converting
 * such a draft used to silently pass `loaded.draft.payment_method || 'cod'`
 * straight into create_checkout_order -- either reaching the RPC with a
 * retired value, or (worse) silently coercing a merchant's prepaid draft
 * into cash-on-delivery. This proves the fix: normalizeDraftOrderPaymentMethod
 * rejects anything outside razorpay/cod, and the reject happens BEFORE any
 * RPC call, not by silent coercion.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeDraftOrderPaymentMethod } from '../routes/orders.ts';

const ordersSource = readFileSync(new URL('../routes/orders.ts', import.meta.url), 'utf8');

test('normalizeDraftOrderPaymentMethod admits only razorpay/cod, rejecting every retired rail', () => {
    assert.equal(normalizeDraftOrderPaymentMethod('razorpay'), 'razorpay');
    assert.equal(normalizeDraftOrderPaymentMethod('cod'), 'cod');

    for (const retired of ['stripe', 'paypal', 'cashfree', 'adyen', 'square', 'braintree']) {
        assert.equal(normalizeDraftOrderPaymentMethod(retired), null, `'${retired}' must normalize to null`);
    }

    assert.equal(normalizeDraftOrderPaymentMethod(null), null);
    assert.equal(normalizeDraftOrderPaymentMethod(undefined), null);
    assert.equal(normalizeDraftOrderPaymentMethod(''), null);
});

test('the draft-convert handler rejects a retired payment method before ever calling the RPC, and never silently coerces it', () => {
    // The raw passthrough this replaces must be gone.
    assert.doesNotMatch(ordersSource, /payment_method:\s*loaded\.draft\.payment_method\s*\|\|\s*'cod'/);

    // The RPC call must receive the NORMALIZED value, not the raw DB column.
    assert.match(ordersSource, /payment_method:\s*draftPaymentMethod,/);

    // The reject path exists and is reachable.
    assert.match(ordersSource, /const draftPaymentMethod = normalizeDraftOrderPaymentMethod\(loaded\.draft\.payment_method\);/);
    assert.match(ordersSource, /if \(!draftPaymentMethod\) \{/);
    assert.match(ordersSource, /code:\s*'DRAFT_PAYMENT_METHOD_RETIRED'/);

    // Ordering: the reject guard must run strictly before service.createOrder(
    // is ever reached for this handler, so a retired value can never reach
    // the RPC -- not source-order-adjacent by luck, but a real early return.
    const convertHandlerStart = ordersSource.indexOf("router.post('/drafts/:id/convert'");
    assert.ok(convertHandlerStart > -1, 'the draft-convert route must still be registered');
    const handlerSource = ordersSource.slice(convertHandlerStart);
    const guardIndex = handlerSource.indexOf('DRAFT_PAYMENT_METHOD_RETIRED');
    const rpcCallIndex = handlerSource.indexOf('service.createOrder(');
    assert.ok(guardIndex > -1 && rpcCallIndex > -1, 'both the guard and the RPC call must exist in the convert handler');
    assert.ok(guardIndex < rpcCallIndex, 'the retired-payment-method guard must precede the RPC call, not follow it');
});
