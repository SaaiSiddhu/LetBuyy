import assert from 'node:assert/strict';
import test from 'node:test';
import { UpdateStoreSchema } from '@letbuyy/tenant-core';

test('India store profile accepts a matching GST registration and address', () => {
    const result = UpdateStoreSchema.safeParse({
        version: 3,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        gstin: '27ABCDE1234F1Z5',
        gst_state_code: '27',
        invoice_address: { country: 'IN', zip: '400001' },
    });
    assert.equal(result.success, true);
});

test('store profile rejects unsupported currency, country, PIN and mismatched GST state', () => {
    for (const change of [
        { currency: 'USD' },
        { timezone: 'Europe/London' },
        { invoice_address: { country: 'US', zip: '10001' } },
        { invoice_address: { country: 'IN', zip: '000001' } },
        { gstin: '27ABCDE1234F1Z5', gst_state_code: '29' },
        { gstin: null, gst_state_code: '27' },
        { business_profile: { website: 'javascript:alert(1)', public_contact_enabled: true } },
        { business_profile: { full_pan: 'ABCDE1234F' } },
        { business_profile: { bank_account_number: '123456789012' } },
        { business_profile: { legal_name: 'Stale legal copy' } },
        { business_profile: { gstin: '27ABCDE1234F1Z5' } },
        { business_profile: { gst_state_code: '27' } },
        { invoice_address: { country: 'IN', zip: '400001', full_pan: 'ABCDE1234F' } },
    ]) {
        const result = UpdateStoreSchema.safeParse(change);
        assert.equal(result.success, false, JSON.stringify(change));
    }
});
test('canonical invoice recipient attention is retained and bounded without accepting private identifiers', () => {
    const accepted = UpdateStoreSchema.safeParse({ version: 1, invoice_address: { country: 'IN', attention: 'Synthetic invoice recipient' } });
    assert.equal(accepted.success, true);
    if (accepted.success) assert.equal(accepted.data.invoice_address?.attention, 'Synthetic invoice recipient');
    assert.equal(UpdateStoreSchema.safeParse({ version: 1, invoice_address: { attention: 'x'.repeat(201) } }).success, false);
    assert.equal(UpdateStoreSchema.safeParse({ version: 1, invoice_address: { attention: 'Synthetic invoice recipient', full_pan: 'ABCDE1234F' } }).success, false);
});
