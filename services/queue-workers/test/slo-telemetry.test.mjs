import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeP95Ms, runSloTelemetryEmitter } from '../src/slo-telemetry.ts';
import { runtimeTelemetryDataPoint, writeRuntimeTelemetryDataPoint } from '@letbuyy/infrastructure/runtime-telemetry-adapter';

// Phase O1: genuine behavioral tests, not source-text scanning (TEST-R10 --
// several sibling files in this test directory read the raw .ts source and
// regex-match it; that proves a pattern exists, not that anything computes
// correctly. These tests actually invoke runSloTelemetryEmitter end to end
// against a mocked fetch, exercising the real @supabase/supabase-js query
// builder the same way production traffic would.

const REST_URL = 'https://example-project.supabase.test';

function baseEnv(overrides = {}) {
  return {
    SUPABASE_URL: REST_URL,
    SUPABASE_SERVICE_ROLE_KEY: 'fake-service-role-key',
    ENVIRONMENT: 'staging',
    RUNTIME_NAME: 'Queue Workers Test',
    ...overrides,
  };
}

function fakeTelemetryBinding() {
  const dataPoints = [];
  return {
    dataPoints,
    binding: {
      writeDataPoint(event) {
        dataPoints.push(event);
      },
    },
  };
}

/**
 * Builds a fetch mock keyed by table name. `counts[table] = {total, successful}`
 * drives HEAD count requests (distinguished by presence of an `in.` filter
 * in the query string, matching how computeSuccessRatio issues two separate
 * count queries). `outboxRows` drives the one GET data-fetch for the outbox
 * lag SLI. `failTables` makes any request touching that table reject.
 */
function mockFetch({ counts = {}, outboxRows = [], failTables = [] } = {}) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, init) => {
      const parsed = new URL(url.toString());
      const method = init?.method || 'GET';
      const table = parsed.pathname.split('/').pop();
      calls.push({ method, table, search: parsed.search });

      if (failTables.includes(table)) {
        throw new Error(`simulated network failure for ${table}`);
      }

      if (method === 'HEAD') {
        const hasSuccessFilter = /(?:^|&)(?:status|signature_valid)=in\./.test(parsed.search);
        const cfg = counts[table] || { total: 0, successful: 0 };
        const count = hasSuccessFilter ? cfg.successful : cfg.total;
        return new Response(null, { status: 200, headers: { 'content-range': `*/${count}` } });
      }

      // GET data fetch (outbox lag)
      return new Response(JSON.stringify(outboxRows), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  };
}

async function withMockedFetch(fetchImpl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

// ── computeP95Ms: pure function, no mocking needed ──────────────────────────

test('computeP95Ms: empty input is null, not zero', () => {
  assert.equal(computeP95Ms([]), null, 'an empty window must be null, never a numeric zero');
});

test('computeP95Ms: nearest-rank p95 over a seeded, sorted set', () => {
  const deltas = Array.from({ length: 100 }, (_, i) => (i + 1) * 10); // 10..1000
  // 95th percentile, nearest-rank: ceil(0.95*100)=95th value (1-indexed) = 950
  assert.equal(computeP95Ms(deltas), 950);
});

test('computeP95Ms: single value returns itself', () => {
  assert.equal(computeP95Ms([250]), 250);
});

// ── Adapter coercion trap, tested directly against the real adapter ────────

test('TRAP CONFIRMED: writeRuntimeTelemetryDataPoint silently coerces a non-finite double to 0', () => {
  // This is not testing our own code -- it directly exercises the shared
  // adapter (packages/infrastructure/runtime-telemetry-adapter) to prove
  // the documented trap is real: nothing here distinguishes "genuinely
  // zero" from "no data" once a NaN reaches this boundary. This is exactly
  // why our emitter must never let an empty-window computation reach it.
  const point = runtimeTelemetryDataPoint({
    metricName: 'letbuyy.slo.trap-demo',
    runtimeName: 'test',
    doubles: [NaN, Infinity, -Infinity, 42],
  });
  assert.deepEqual(point.doubles, [0, 0, 0, 42], 'NaN/Infinity/-Infinity must all silently become 0 -- confirming the trap, not asserting our own workaround');
});

// ── Full emitter: computes correctly against seeded fixtures ───────────────

test('emitter computes checkout-order-creation-success correctly and emits one data point', async () => {
  const telemetry = fakeTelemetryBinding();
  const mock = mockFetch({
    counts: {
      checkout_sessions: { total: 1000, successful: 950 },
      payment_transactions: { total: 0, successful: 0 },
      payment_webhook_events: { total: 0, successful: 0 },
    },
    outboxRows: [],
  });

  await withMockedFetch(mock.fetchImpl, () =>
    runSloTelemetryEmitter(baseEnv({ RUNTIME_TELEMETRY: telemetry.binding }), { requestId: 'test-req-1' }),
  );

  const checkoutPoint = telemetry.dataPoints.find((p) => p.blobs[1] === 'letbuyy.slo.checkout-order-creation-success');
  assert.ok(checkoutPoint, 'checkout-order-creation-success must have emitted a data point');
  assert.equal(checkoutPoint.doubles[0], 95, 'success rate must be exactly 950/1000 = 95%');
  assert.equal(checkoutPoint.doubles[1], 1000, 'sample size (total) must be carried as its own double');
  assert.equal(checkoutPoint.doubles[2], 950, 'successful count must be carried as its own double');
});

test('emitter computes payment-capture-confirmation-success and razorpay-webhook-signature-verification correctly', async () => {
  const telemetry = fakeTelemetryBinding();
  const mock = mockFetch({
    counts: {
      checkout_sessions: { total: 0, successful: 0 },
      payment_transactions: { total: 200, successful: 198 },
      payment_webhook_events: { total: 500, successful: 500 },
    },
    outboxRows: [],
  });

  await withMockedFetch(mock.fetchImpl, () =>
    runSloTelemetryEmitter(baseEnv({ RUNTIME_TELEMETRY: telemetry.binding }), { requestId: 'test-req-2' }),
  );

  const paymentPoint = telemetry.dataPoints.find((p) => p.blobs[1] === 'letbuyy.slo.payment-capture-confirmation-success');
  assert.ok(paymentPoint);
  assert.equal(paymentPoint.doubles[0], 99, '198/200 = 99%');

  const webhookPoint = telemetry.dataPoints.find((p) => p.blobs[1] === 'letbuyy.slo.razorpay-webhook-signature-verification');
  assert.ok(webhookPoint);
  assert.equal(webhookPoint.doubles[0], 100, '500/500 = 100%');

  // The webhook query must filter to provider=razorpay, per the SLO name --
  // confirm the actual request the mock captured, not just the result.
  const webhookCall = mock.calls.find((c) => c.table === 'payment_webhook_events' && c.search.includes('signature_valid=in'));
  assert.match(webhookCall.search, /provider=eq\.razorpay/, 'the webhook success-count query must filter provider=razorpay');
});

test('emitter computes outbox-event-processing-lag p95 correctly from seeded rows', async () => {
  const telemetry = fakeTelemetryBinding();
  const rows = Array.from({ length: 20 }, (_, i) => ({
    created_at: new Date(2026, 0, 1, 0, 0, 0).toISOString(),
    dispatched_at: new Date(2026, 0, 1, 0, 0, (i + 1)).toISOString(), // (i+1) seconds later
  }));
  const mock = mockFetch({
    counts: {
      checkout_sessions: { total: 0, successful: 0 },
      payment_transactions: { total: 0, successful: 0 },
      payment_webhook_events: { total: 0, successful: 0 },
    },
    outboxRows: rows,
  });

  await withMockedFetch(mock.fetchImpl, () =>
    runSloTelemetryEmitter(baseEnv({ RUNTIME_TELEMETRY: telemetry.binding }), { requestId: 'test-req-3' }),
  );

  const lagPoint = telemetry.dataPoints.find((p) => p.blobs[1] === 'letbuyy.slo.outbox-event-processing-lag');
  assert.ok(lagPoint, 'outbox lag must have emitted');
  // 20 rows, deltas 1000ms..20000ms, nearest-rank p95 = ceil(0.95*20)=19th value = 19000ms
  assert.equal(lagPoint.doubles[0], 19_000);
  assert.equal(lagPoint.doubles[1], 20, 'sample size must be carried');
});

// ── Empty window is skipped, not emitted as a silent zero ──────────────────

test('empty window: zero-row SLIs are skipped entirely, never emitted as a coerced zero', async () => {
  const telemetry = fakeTelemetryBinding();
  const mock = mockFetch({
    counts: {
      checkout_sessions: { total: 0, successful: 0 },
      payment_transactions: { total: 0, successful: 0 },
      payment_webhook_events: { total: 0, successful: 0 },
    },
    outboxRows: [],
  });

  const { results } = await withMockedFetch(mock.fetchImpl, () =>
    runSloTelemetryEmitter(baseEnv({ RUNTIME_TELEMETRY: telemetry.binding }), { requestId: 'test-req-4' }),
  );

  assert.equal(telemetry.dataPoints.length, 0, 'zero data points must be written for an entirely empty window');
  for (const result of results) {
    assert.equal(result.outcome, 'skipped_empty_window', `${result.slo} must be reported as skipped, not a silent zero`);
    assert.equal(result.value, null);
  }
});

// ── One query failure does not take down sibling emissions or the handler ──

test('a query failure for one table is caught and does not block sibling SLIs', async () => {
  const telemetry = fakeTelemetryBinding();
  const mock = mockFetch({
    counts: {
      payment_transactions: { total: 100, successful: 99 },
      payment_webhook_events: { total: 10, successful: 10 },
    },
    outboxRows: [],
    failTables: ['checkout_sessions'],
  });

  const { results } = await withMockedFetch(mock.fetchImpl, () =>
    runSloTelemetryEmitter(baseEnv({ RUNTIME_TELEMETRY: telemetry.binding }), { requestId: 'test-req-5' }),
  );

  const checkoutResult = results.find((r) => r.slo === 'checkout-order-creation-success');
  assert.equal(checkoutResult.outcome, 'query_failed');
  assert.match(checkoutResult.error, /simulated network failure/);

  const paymentResult = results.find((r) => r.slo === 'payment-capture-confirmation-success');
  assert.equal(paymentResult.outcome, 'emitted', 'a sibling SLI must still succeed even though checkout_sessions failed');
  assert.equal(paymentResult.value, 99);
});

// ── Read-only proof: no write method against any commerce table ────────────

test('the emitter never issues a write (POST/PATCH/PUT/DELETE) against any commerce table', async () => {
  const telemetry = fakeTelemetryBinding();
  const rows = [{ created_at: '2026-01-01T00:00:00Z', dispatched_at: '2026-01-01T00:00:05Z' }];
  const mock = mockFetch({
    counts: {
      checkout_sessions: { total: 5, successful: 5 },
      payment_transactions: { total: 5, successful: 5 },
      payment_webhook_events: { total: 5, successful: 5 },
    },
    outboxRows: rows,
  });

  await withMockedFetch(mock.fetchImpl, () =>
    runSloTelemetryEmitter(baseEnv({ RUNTIME_TELEMETRY: telemetry.binding }), { requestId: 'test-req-6' }),
  );

  assert.ok(mock.calls.length > 0, 'sanity check: requests were actually made');
  for (const call of mock.calls) {
    assert.ok(['HEAD', 'GET'].includes(call.method), `${call.table} received a ${call.method} request -- only read methods are permitted`);
  }
});

// ── Absent RUNTIME_TELEMETRY binding is a clean no-op, not a crash ─────────

test('an absent RUNTIME_TELEMETRY binding does not throw and still computes results', async () => {
  const mock = mockFetch({
    counts: {
      checkout_sessions: { total: 10, successful: 10 },
      payment_transactions: { total: 0, successful: 0 },
      payment_webhook_events: { total: 0, successful: 0 },
    },
    outboxRows: [],
  });

  const { results } = await withMockedFetch(mock.fetchImpl, () =>
    runSloTelemetryEmitter(baseEnv({ RUNTIME_TELEMETRY: undefined }), { requestId: 'test-req-7' }),
  );

  const checkoutResult = results.find((r) => r.slo === 'checkout-order-creation-success');
  assert.equal(checkoutResult.outcome, 'emitted', 'computation must still succeed even with no telemetry sink bound');
  assert.equal(checkoutResult.value, 100);
});
