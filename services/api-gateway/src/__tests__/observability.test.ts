import assert from 'node:assert/strict'
import test from 'node:test'
import {
    normalizeRequestLogSampleRate,
    shouldRecordRequestLog,
} from '../middleware/observability'

test('request log sample rate is bounded and rollbackable', () => {
    assert.equal(normalizeRequestLogSampleRate(undefined), 0.02)
    assert.equal(normalizeRequestLogSampleRate('bad'), 0.02)
    assert.equal(normalizeRequestLogSampleRate('-1'), 0)
    assert.equal(normalizeRequestLogSampleRate('2'), 1)
    assert.equal(normalizeRequestLogSampleRate('1'), 1)
})

test('request log sampling always records protected observability paths', () => {
    for (const input of [
        { method: 'GET', path: '/v1/storefront/demo/products', statusCode: 500 },
        { method: 'POST', path: '/v1/auth/signin', statusCode: 200 },
        { method: 'GET', path: '/v1/admin/products', statusCode: 200 },
        { method: 'GET', path: '/v1/operations/request-logs', statusCode: 200 },
        { method: 'POST', path: '/v1/storefront/demo/orders', statusCode: 201 },
        { method: 'POST', path: '/v1/storefront/demo/payments/razorpay/order', statusCode: 200 },
        { method: 'GET', path: '/v1/storefront/demo/products', statusCode: 200, userId: 'user-1' },
    ]) {
        const decision = shouldRecordRequestLog({ ...input, sampleRate: 0 })
        assert.equal(decision.record, true, `${input.method} ${input.path} should be recorded`)
        assert.equal(decision.sampleRate, 1)
    }
})

test('anonymous successful storefront reads are sampled deterministically', () => {
    const decisions = Array.from({ length: 1000 }, (_, index) => shouldRecordRequestLog({
        method: 'GET',
        path: `/v1/storefront/demo/products?cursor=${index}`,
        statusCode: 200,
        requestId: `request-${index}`,
        sampleRate: 0.02,
    }))
    const recorded = decisions.filter((decision) => decision.record).length

    assert.ok(recorded >= 5, `expected at least a few sampled records, got ${recorded}`)
    assert.ok(recorded <= 50, `expected roughly two percent sampled records, got ${recorded}`)
    assert.ok(decisions.every((decision) => decision.reason === 'sampled-storefront'))
})

test('request log sampling rollback records all anonymous storefront reads', () => {
    const decisions = Array.from({ length: 100 }, (_, index) => shouldRecordRequestLog({
        method: 'GET',
        path: `/v1/storefront/demo/products?cursor=${index}`,
        statusCode: 200,
        requestId: `rollback-${index}`,
        sampleRate: 1,
    }))

    assert.equal(decisions.filter((decision) => decision.record).length, decisions.length)
})
