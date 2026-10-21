import { Hono } from 'hono'
import { getObservabilityRoute } from '../middleware/observability'
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
import {
    REDACTED_ALERT_SECRET,
    RUNTIME_ALERT_JOB_TYPE,
    RUNTIME_ALERT_METRIC_NAME,
    enqueueRuntimeAlert,
    planRuntimeAlert,
} from '../lib/runtime-alerting'

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

test('runtime alert planner classifies 5xx incidents and redacts secret-shaped metadata', () => {
    assert.equal(planRuntimeAlert({
        runtimeName: 'LetBuyy API',
        environment: 'production',
        runtimeQueueName: 'letbuyy-production-queue',
        requestId: 'req-alert-ignored',
        traceId: 'trace-alert-ignored',
        route: '/v1/products',
        method: 'GET',
        statusCode: 404,
        latencyMs: 12,
    }), null)

    const plan = planRuntimeAlert({
        runtimeName: 'LetBuyy API',
        environment: 'production',
        deploymentEnv: 'production',
        telemetryEnv: 'production',
        runtimeQueueName: 'letbuyy-production-queue',
        requestId: 'req-alert-1',
        traceId: 'trace-alert-1',
        route: '/v1/payments/capture?authorization=Bearer raw',
        method: 'POST',
        statusCode: 503,
        latencyMs: 88,
        errorCode: 'PROVIDER_FAILURE',
        siteId: '11111111-1111-4111-8111-111111111111',
        metadata: {
            authorization: 'Bearer raw',
            nested: {
                client_secret: 'raw-secret',
                route_hint: '/payments',
            },
        },
    })

    assert.ok(plan)
    assert.equal(plan.metric.metricName, RUNTIME_ALERT_METRIC_NAME)
    assert.equal(plan.queueMessage.queueName, 'letbuyy-production-queue')
    assert.equal(plan.queueMessage.jobType, RUNTIME_ALERT_JOB_TYPE)
    assert.equal(plan.queueMessage.payload.severity, 'sev2')
    assert.equal(plan.queueMessage.payload.target_team, 'runtime-ops')
    assert.match(String(plan.queueMessage.payload.summary), /LetBuyy API 503 POST \/v1\/payments\/capture/)
    const metadata = plan.queueMessage.payload.metadata as Record<string, unknown>
    assert.equal(metadata.authorization, REDACTED_ALERT_SECRET)
    assert.deepEqual(metadata.nested, {
        client_secret: REDACTED_ALERT_SECRET,
        route_hint: '/payments',
    })
})

test('runtime alert enqueue records a metric and fails closed when delivery binding is missing', async () => {
    const metrics: unknown[] = []
    const missing = await enqueueRuntimeAlert({
        metricRecorder: {
            async recordRuntimeMetric(metric) {
                metrics.push(metric)
            },
        },
        runtimeQueue: null,
        runtimeName: 'LetBuyy API',
        environment: 'production',
        runtimeQueueName: 'letbuyy-production-queue',
        requestId: 'req-alert-missing-binding',
        traceId: 'trace-alert-missing-binding',
        route: '/v1/orders',
        method: 'POST',
        statusCode: 500,
        latencyMs: 42,
    })

    assert.equal(missing.queued, false)
    assert.equal(missing.reason, 'missing-runtime-queue-binding')
    assert.equal(metrics.length, 1)

    const sent: unknown[] = []
    const delivered = await enqueueRuntimeAlert({
        metricRecorder: {
            async recordRuntimeMetric(metric) {
                metrics.push(metric)
            },
        },
        runtimeQueue: {
            async send(message) {
                sent.push(message)
            },
        },
        runtimeName: 'LetBuyy API',
        environment: 'production',
        runtimeQueueName: 'letbuyy-production-queue',
        requestId: 'req-alert-delivered',
        traceId: 'trace-alert-delivered',
        route: '/v1/orders',
        method: 'POST',
        statusCode: 500,
        latencyMs: 42,
    })

    assert.equal(delivered.queued, true)
    assert.equal(sent.length, 1)
    assert.match(JSON.stringify(sent[0]), /incident\.page\.dry_run/)
    assert.match(JSON.stringify(sent[0]), /CAP-C10 automated runtime alert dry-run/)
})

test('matched route telemetry never persists cart credentials or unmatched raw paths', async () => {
    const routes: string[] = []
    const app = new Hono()
    app.use('*', async (c, next) => { await next(); routes.push(getObservabilityRoute(c)) })
    app.get('/v1/storefront/:subdomain/cart/:token', c => c.json({ ok: true }))
    app.use('/v1/*', async (_c, next) => { await next() })
    const token = 'ct_' + crypto.randomUUID().replaceAll('-', '')
    await app.request('https://example.invalid/v1/storefront/tenant-a/cart/' + token)
    await app.request('https://example.invalid/v1/storefront/tenant-b/cart/' + token)
    await app.request('https://example.invalid/private/' + token)
    assert.deepEqual(routes, ['/v1/storefront/:subdomain/cart/:token', '/v1/storefront/:subdomain/cart/:token', '/unmatched'])
    assert.equal(routes.some(route => route.includes(token)), false)
})
