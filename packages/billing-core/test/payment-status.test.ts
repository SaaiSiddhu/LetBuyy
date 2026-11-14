import assert from 'node:assert/strict';
import test from 'node:test';
import { isBillingPaymentPaid } from '../src/index';
test('invoice issuance and subscription activation never imply a paid bill', () => {
    for (const status of [
        'issued',
        'active',
        'open',
        'draft',
        'pending',
        'failed',
        'cancelled',
        'void',
        null,
        undefined,
        {},
        0,
    ])
        assert.equal(isBillingPaymentPaid(status), false, String(status));
    for (const status of ['paid', 'succeeded', ' PAID '])
        assert.equal(isBillingPaymentPaid(status), true);
    const invoices = [
        { amount: 29900, status: 'issued' },
        { amount: 99900, status: 'active' },
        { amount: 19900, status: 'paid' },
    ];
    assert.equal(
        invoices
            .filter((x) => isBillingPaymentPaid(x.status))
            .reduce((sum, x) => sum + x.amount, 0),
        19900,
    );
});
