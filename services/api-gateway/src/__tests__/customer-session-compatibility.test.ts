import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptsCustomerSessionFormat } from '../lib/customer-session-compatibility';

test('missing compatibility policy preserves both transitional token formats', () => {
    assert.equal(acceptsCustomerSessionFormat(undefined, 'gateway_hs256_v1'), true);
    assert.equal(acceptsCustomerSessionFormat(undefined, 'shopper_hs256_legacy'), true);
});

test('format-specific policy accepts exactly one format', () => {
    assert.equal(acceptsCustomerSessionFormat('gateway_hs256_v1', 'gateway_hs256_v1'), true);
    assert.equal(acceptsCustomerSessionFormat('gateway_hs256_v1', 'shopper_hs256_legacy'), false);
    assert.equal(acceptsCustomerSessionFormat('shopper_hs256_legacy', 'shopper_hs256_legacy'), true);
    assert.equal(acceptsCustomerSessionFormat('shopper_hs256_legacy', 'gateway_hs256_v1'), false);
});

test('disabled and invalid policies fail closed', () => {
    for (const format of ['gateway_hs256_v1', 'shopper_hs256_legacy'] as const) {
        assert.equal(acceptsCustomerSessionFormat('disabled', format), false);
        assert.equal(acceptsCustomerSessionFormat('typo', format), false);
    }
});
