// D-PLATFORM-CHARGE — the shared provider payment verifier, exercised rather than read.
//
// payments.test.ts pins that the route delegates here and in what order. This file proves the
// verifier itself does what those contracts claim: a real signature is required, a valid signature
// is still not enough without the server-stored reference, and the two checks happen in that order.

import assert from 'node:assert/strict';
import test from 'node:test';
import { hmacSha256Hex } from '../lib/crypto';
import {
    razorpaySignaturePayload,
    verifyRazorpayPayment,
} from '../lib/provider-payment-verification';

const SECRET = 'razorpay-key-secret-for-tests-only';
const ORDER = 'order_ABC123';
const PAYMENT = 'pay_XYZ789';

const sign = (orderId: string, paymentId: string, secret = SECRET) =>
    hmacSha256Hex(secret, razorpaySignaturePayload(orderId, paymentId));

test('a real signature bound to the stored reference verifies', async () => {
    const signature = await sign(ORDER, PAYMENT);
    const result = await verifyRazorpayPayment(SECRET, {
        providerOrderId: ORDER, providerPaymentId: PAYMENT, signature, storedProviderOrderId: ORDER,
    });
    assert.deepEqual(result, { ok: true });
});

test('a valid signature is NOT enough — the binding is what ties it to this record', async () => {
    const signature = await sign(ORDER, PAYMENT);

    // No provider order was ever created for this record: any signature presented against it is
    // being replayed from a different one.
    assert.deepEqual(
        await verifyRazorpayPayment(SECRET, {
            providerOrderId: ORDER, providerPaymentId: PAYMENT, signature, storedProviderOrderId: null,
        }),
        { ok: false, reason: 'reference_mismatch' },
    );

    // A genuinely signed payment for ANOTHER record must not apply to this one. This is the case the
    // binding exists for, and it is the one a signature check alone cannot catch.
    const otherOrder = 'order_SOMEONE_ELSE';
    assert.deepEqual(
        await verifyRazorpayPayment(SECRET, {
            providerOrderId: ORDER, providerPaymentId: PAYMENT, signature, storedProviderOrderId: otherOrder,
        }),
        { ok: false, reason: 'reference_mismatch' },
    );
});

test('a forged or foreign-key signature is rejected even when the reference matches', async () => {
    assert.deepEqual(
        await verifyRazorpayPayment(SECRET, {
            providerOrderId: ORDER, providerPaymentId: PAYMENT, signature: 'deadbeef'.repeat(8), storedProviderOrderId: ORDER,
        }),
        { ok: false, reason: 'invalid_signature' },
    );

    // Signed with a different secret — i.e. not by our Razorpay account.
    const foreign = await sign(ORDER, PAYMENT, 'a-different-merchants-secret');
    assert.deepEqual(
        await verifyRazorpayPayment(SECRET, {
            providerOrderId: ORDER, providerPaymentId: PAYMENT, signature: foreign, storedProviderOrderId: ORDER,
        }),
        { ok: false, reason: 'invalid_signature' },
    );

    // The payload binds BOTH ids: a signature for a different payment id must not verify.
    const otherPayment = await sign(ORDER, 'pay_DIFFERENT');
    assert.deepEqual(
        await verifyRazorpayPayment(SECRET, {
            providerOrderId: ORDER, providerPaymentId: PAYMENT, signature: otherPayment, storedProviderOrderId: ORDER,
        }),
        { ok: false, reason: 'invalid_signature' },
    );
});

test('the signature is checked BEFORE the binding', async () => {
    // Both checks would fail here. The reason returned tells us which ran first — and it must be the
    // signature, so a caller cannot learn which records exist by presenting garbage signatures and
    // reading the difference between "bad signature" and "no such reference".
    const result = await verifyRazorpayPayment(SECRET, {
        providerOrderId: ORDER, providerPaymentId: PAYMENT, signature: 'not-a-signature', storedProviderOrderId: null,
    });
    assert.deepEqual(result, { ok: false, reason: 'invalid_signature' });
});

test('no secret fails CLOSED, before anything else is considered', async () => {
    for (const secret of [undefined, null, '']) {
        assert.deepEqual(
            await verifyRazorpayPayment(secret, {
                providerOrderId: ORDER, providerPaymentId: PAYMENT, signature: await sign(ORDER, PAYMENT), storedProviderOrderId: ORDER,
            }),
            { ok: false, reason: 'provider_not_configured' },
            'an unverifiable payment is never a verified one',
        );
    }
});

test('the signed payload is Razorpay\'s, and is built in exactly one place', () => {
    assert.equal(razorpaySignaturePayload(ORDER, PAYMENT), `${ORDER}|${PAYMENT}`);
    // Order matters in the payload: swapping the two ids must produce a different signature, so a
    // caller cannot present them transposed.
    assert.notEqual(razorpaySignaturePayload(ORDER, PAYMENT), razorpaySignaturePayload(PAYMENT, ORDER));
});
