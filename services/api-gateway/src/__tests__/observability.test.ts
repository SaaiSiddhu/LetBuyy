import assert from 'node:assert/strict'
import test from 'node:test'
import {
    normalizeRequestLogSampleRate,
    shouldRecordRequestLog,
} from '../middleware/observability'
import {
    appendAuditRelayEnvelope,
    createFoundationTraceContext,
    createMetricsRegistry,
    foundationStructuredLog,
} from '../lib/foundation-observability'

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

test('foundation trace and audit envelopes carry tenant/channel context with redacted secrets', () => {
    const trace = createFoundationTraceContext({
        requestId: 'req-foundation-1',
        traceId: 'trace-foundation-1',
        siteId: '11111111-1111-4111-8111-111111111111',
        channel: 'whatsapp',
        actorId: '22222222-2222-4222-8222-222222222222',
    })

    const log = foundationStructuredLog({
        ...trace,
        access_token: 'raw-token',
        nested: { signing_secret: 'raw-signing-secret' },
    })
    const audit = appendAuditRelayEnvelope({
        trace,
        action: 'order.created',
        resourceType: 'orders',
        resourceId: '33333333-3333-4333-8333-333333333333',
        metadata: { client_secret: 'raw-client-secret' },
    })

    assert.equal(log.request_id, 'req-foundation-1')
    assert.equal(log.channel, 'whatsapp')
    assert.equal(log.access_token, '[REDACTED_REPLAY_SECRET]')
    assert.deepEqual(log.nested, { signing_secret: '[REDACTED_REPLAY_SECRET]' })
    assert.equal(audit.store_id, '11111111-1111-4111-8111-111111111111')
    assert.equal((audit.metadata as Record<string, unknown>).channel, 'whatsapp')
    assert.equal((audit.metadata as Record<string, unknown>).client_secret, '[REDACTED_REPLAY_SECRET]')
})

test('foundation metrics registry accumulates counters and observations', () => {
    const metrics = createMetricsRegistry()

    metrics.increment('outbox.published', { event: 'order.created.v1' })
    metrics.increment('outbox.published', { event: 'order.created.v1' }, 2)
    metrics.observe('relay.latency', 27, 'ms', { event: 'order.created.v1' })

    const snapshot = metrics.snapshot()
    assert.equal(snapshot.length, 2)
    assert.equal(snapshot.find((metric) => metric.name === 'outbox.published')?.value, 3)
    assert.equal(snapshot.find((metric) => metric.name === 'relay.latency')?.unit, 'ms')
})
