import assert from 'node:assert/strict'
import test from 'node:test'
import {
    keepMarketplaceResubmissionKeyForReason,
    retainMarketplaceResubmissionKey,
} from '../src/lib/marketplace-resubmission-key'

test('a retry with the same normalized correction reuses its idempotency key', () => {
    const initial = retainMarketplaceResubmissionKey(null, ' Fix the title ', () => 'key-1')
    const retry = retainMarketplaceResubmissionKey(initial, 'Fix the title', () => 'key-2')

    assert.equal(retry, initial)
    assert.equal(retry.key, 'key-1')
})

test('editing to a different correction clears the old key and creates a new one on submit', () => {
    const initial = retainMarketplaceResubmissionKey(null, 'Fix the title', () => 'key-1')
    const afterEdit = keepMarketplaceResubmissionKeyForReason(initial, 'Add a clear size chart')

    assert.equal(afterEdit, null)
    assert.equal(retainMarketplaceResubmissionKey(afterEdit, 'Add a clear size chart', () => 'key-2').key, 'key-2')
})

test('whitespace-only edits preserve the key because the submitted reason is trimmed', () => {
    const initial = retainMarketplaceResubmissionKey(null, 'Fix the title', () => 'key-1')
    const afterEdit = keepMarketplaceResubmissionKeyForReason(initial, ' Fix the title ')

    assert.equal(afterEdit, initial)
})
