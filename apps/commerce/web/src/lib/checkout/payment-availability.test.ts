import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCheckoutPaymentAvailability } from './payment-availability';

test('storefront checkout keeps its configured online and COD methods', () => {
    assert.deepEqual(resolveCheckoutPaymentAvailability({
        hostedCheckout: false,
        onlinePaymentEnabled: true,
        codEnabled: true,
    }), {
        online: true,
        cod: true,
        hasAvailableMethod: true,
        initialMethod: 'online',
    });
});

test('hosted checkout exposes configured online and COD methods', () => {
    assert.deepEqual(resolveCheckoutPaymentAvailability({
        hostedCheckout: true,
        onlinePaymentEnabled: true,
        codEnabled: true,
    }), {
        online: true,
        cod: true,
        hasAvailableMethod: true,
        initialMethod: 'online',
    });
});

test('hosted checkout with only online enabled offers the canonical online path', () => {
    assert.deepEqual(resolveCheckoutPaymentAvailability({
        hostedCheckout: true,
        onlinePaymentEnabled: true,
        codEnabled: false,
    }), {
        online: true,
        cod: false,
        hasAvailableMethod: true,
        initialMethod: 'online',
    });
});

test('COD-only storefront and hosted checkout remain available', () => {
    assert.equal(resolveCheckoutPaymentAvailability({
        hostedCheckout: true,
        onlinePaymentEnabled: false,
        codEnabled: true,
    }).initialMethod, 'cod');
    assert.equal(resolveCheckoutPaymentAvailability({
        hostedCheckout: false,
        onlinePaymentEnabled: false,
        codEnabled: true,
    }).initialMethod, 'cod');
});
