import assert from 'node:assert/strict'
import test from 'node:test'
import { businessProfileForStorePatch } from '../src/lib/store-profile-business'

test('merchant profile saves preserve contact and trade facts without reviving legacy legal or GST copies', () => {
    const patch = businessProfileForStorePatch({
        trade_name: 'Current trade name',
        entity_type: 'proprietorship',
        pan_last4: '1234',
        email: 'merchant@example.invalid',
        phone: '+919876543210',
        website: 'https://merchant.example.invalid',
        public_contact_enabled: false,
        legal_name: 'Old legal name',
        gstin: '29AAAAA0000A1Z5',
        gst_state_code: '29',
        bank_account_number: '123456789012',
    })
    assert.deepEqual(patch, {
        trade_name: 'Current trade name', entity_type: 'proprietorship', pan_last4: '1234',
        email: 'merchant@example.invalid', phone: '+919876543210',
        website: 'https://merchant.example.invalid', public_contact_enabled: false,
    })
})
