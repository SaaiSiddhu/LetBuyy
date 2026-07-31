/**
 * LPAS Phase 13 — foundation tests.
 *
 * Covers:
 *  (A) performance() envelope — evidence passthrough, confidenceFrom exact values,
 *      sources deduplication, timestamp === injected clock, liveConnected default.
 *      Mirrors the LDTS twin() envelope pattern exactly.
 *  (B) PERFORMANCE_RULES invariants — PA01..PA06 unique ids, severities valid,
 *      PerformanceRuleRegistry.get/list correctness.
 *  (C) Type-shape smoke tests — constructing valid MetricDescriptor / MetricSeries /
 *      Recommendation (advisory: true REQUIRED) / PerformanceReport literals.
 *  (D) No-fabrication contract spot-checks — MetricSeries NOT_CONNECTED must have
 *      values null; forecasts without a series must have forecastValues null.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// Import only from the package's own shared surface — no lcis-core in test imports.
import { performance, confidenceFrom, defaultNow } from '../src/shared/envelope';
import {
  PERFORMANCE_RULES,
  PerformanceRuleRegistry,
} from '../src/shared/rules';
import type {
  MetricDescriptor,
  MetricSeries,
  SeriesStatistics,
  LatencyModelEntry,
  PerformanceFinding,
  CapacityForecast,
  CostForecast,
  Recommendation,
  PerformanceReport,
  Connection,
  Severity,
  MetricKind,
} from '../src/shared/types';
import type { Evidence } from '@letbuyy/lcis-core';

// ── Fixed test clock (deterministic) ──────────────────────────────────────────

const FIXED_TS = '2026-07-04T00:00:00.000Z';
const fixedNow = (): string => FIXED_TS;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ev(kind: Evidence['kind'], ref: string, source?: string): Evidence {
  return source !== undefined
    ? { kind, ref, source }
    : { kind, ref };
}

function notConnectedEv(ref: string): Evidence {
  return { kind: 'not-connected', ref };
}

// ── (A) confidenceFrom ────────────────────────────────────────────────────────

test('confidenceFrom: empty evidence array returns 0', () => {
  assert.equal(confidenceFrom([]), 0);
});

test('confidenceFrom: all not-connected evidence returns 0', () => {
  const evs: Evidence[] = [notConnectedEv('VAR_A'), notConnectedEv('VAR_B')];
  assert.equal(confidenceFrom(evs), 0);
});

test('confidenceFrom: one connected evidence returns 0.6 (0.5 + 0.1 * 1)', () => {
  assert.equal(confidenceFrom([ev('file', 'a.ts')]), 0.6);
});

test('confidenceFrom: two connected evidence items returns 0.7', () => {
  assert.equal(
    confidenceFrom([ev('file', 'a.ts'), ev('graph-node', 'n1')]),
    0.7,
  );
});

test('confidenceFrom: three connected evidence items returns 0.8', () => {
  const evs = [
    ev('file', 'a.ts'),
    ev('graph-node', 'n1'),
    ev('rpc', 'create_order'),
  ];
  assert.equal(confidenceFrom(evs), 0.8);
});

test('confidenceFrom: four connected evidence items returns 0.9 (cap)', () => {
  const evs = [
    ev('file', 'a.ts'),
    ev('graph-node', 'n1'),
    ev('rpc', 'r1'),
    ev('table', 't1'),
  ];
  assert.equal(confidenceFrom(evs), 0.9);
});

test('confidenceFrom: five connected evidence items still caps at 0.9', () => {
  const evs = [
    ev('file', 'a.ts'),
    ev('graph-node', 'n1'),
    ev('rpc', 'r1'),
    ev('table', 't1'),
    ev('policy', 'p1'),
  ];
  assert.equal(confidenceFrom(evs), 0.9);
});

test('confidenceFrom: mixed connected and not-connected counts only connected', () => {
  // 1 connected + 3 not-connected => 0.5 + 0.1*1 = 0.6
  const evs: Evidence[] = [
    ev('file', 'a.ts'),
    notConnectedEv('VAR_A'),
    notConnectedEv('VAR_B'),
    notConnectedEv('VAR_C'),
  ];
  assert.equal(confidenceFrom(evs), 0.6);
});

// ── (A) performance() envelope ────────────────────────────────────────────────

test('performance: timestamp equals injected clock', () => {
  const result = performance({ value: 1 }, { evidence: [], now: fixedNow });
  assert.equal(result.timestamp, FIXED_TS);
});

test('performance: evidence is passed through exactly', () => {
  const evs: Evidence[] = [ev('file', 'src/shared/rules.ts', 'graphify-out/graph.json')];
  const result = performance({ x: 'y' }, { evidence: evs, now: fixedNow });
  assert.deepEqual(result.evidence, evs);
});

test('performance: liveConnected defaults to false when not supplied', () => {
  const result = performance({ x: 1 }, { evidence: [], now: fixedNow });
  assert.equal(result.liveConnected, false);
});

test('performance: liveConnected can be set to true', () => {
  const result = performance(
    { x: 1 },
    { evidence: [], liveConnected: true, now: fixedNow },
  );
  assert.equal(result.liveConnected, true);
});

test('performance: confidence is auto-computed from evidence when not supplied', () => {
  const evs = [ev('file', 'a.ts'), ev('graph-node', 'n1')];
  const result = performance({}, { evidence: evs, now: fixedNow });
  assert.equal(result.confidence, 0.7);
});

test('performance: explicit confidence overrides the computed value', () => {
  const result = performance(
    {},
    { evidence: [ev('file', 'f.ts')], confidence: 0.42, now: fixedNow },
  );
  assert.equal(result.confidence, 0.42);
});

test('performance: sources are auto-derived (deduped) from evidence.source fields', () => {
  const evs: Evidence[] = [
    { kind: 'file', ref: 'a.ts', source: 'graphify-out/graph.json' },
    { kind: 'graph-node', ref: 'n1', source: 'graphify-out/graph.json' }, // duplicate
    { kind: 'rpc', ref: 'rpc_x', source: 'graphify-out/db-intel.json' },
  ];
  const result = performance({}, { evidence: evs, now: fixedNow });
  assert.deepEqual([...result.sources].sort(), [
    'graphify-out/db-intel.json',
    'graphify-out/graph.json',
  ]);
});

test('performance: explicit sources override the auto-derived deduplication', () => {
  const evs: Evidence[] = [{ kind: 'file', ref: 'a.ts', source: 'auto-source' }];
  const explicit = ['explicit-source'];
  const result = performance({}, { evidence: evs, sources: explicit, now: fixedNow });
  assert.deepEqual([...result.sources], explicit);
});

test('performance: evidence with no source fields yields empty sources list', () => {
  const evs: Evidence[] = [{ kind: 'not-connected', ref: 'VAR_X' }];
  const result = performance({}, { evidence: evs, now: fixedNow });
  assert.deepEqual([...result.sources], []);
});

test('performance: body properties are merged into the result', () => {
  const result = performance(
    { alpha: 'hello', beta: 42 },
    { evidence: [], now: fixedNow },
  );
  assert.equal((result as { alpha: string }).alpha, 'hello');
  assert.equal((result as { beta: number }).beta, 42);
});

test('performance: PerformanceArtifact shape — result has all five mandatory fields', () => {
  const result = performance({}, { evidence: [], now: fixedNow });
  assert.ok('evidence' in result);
  assert.ok('confidence' in result);
  assert.ok('sources' in result);
  assert.ok('timestamp' in result);
  assert.ok('liveConnected' in result);
});

test('performance: sources array has no duplicates when evidence share the same source', () => {
  const evs: Evidence[] = Array.from({ length: 5 }, (_, i) => ({
    kind: 'file' as const,
    ref: `file${i}.ts`,
    source: 'shared-source',
  }));
  const result = performance({}, { evidence: evs, now: fixedNow });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0], 'shared-source');
});

test('performance: zero-confidence when evidence is empty', () => {
  const result = performance({}, { evidence: [], now: fixedNow });
  assert.equal(result.confidence, 0);
});

test('performance: zero-confidence when all evidence is not-connected', () => {
  const evs = [notConnectedEv('A'), notConnectedEv('B')];
  const result = performance({}, { evidence: evs, now: fixedNow });
  assert.equal(result.confidence, 0);
});

test('defaultNow: returns a valid ISO-8601 string', () => {
  const ts = defaultNow();
  assert.ok(typeof ts === 'string', 'defaultNow() must return a string');
  assert.ok(!Number.isNaN(Date.parse(ts)), `defaultNow() returned non-ISO string: ${ts}`);
});

// ── (B) PERFORMANCE_RULES invariants ─────────────────────────────────────────

test('PERFORMANCE_RULES: contains exactly 6 rules (PA01..PA06)', () => {
  assert.equal(PERFORMANCE_RULES.length, 6);
});

test('PERFORMANCE_RULES: all rule ids are unique', () => {
  const ids = PERFORMANCE_RULES.map((r) => r.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, 'duplicate rule ids found');
});

test('PERFORMANCE_RULES: ids are exactly PA01 through PA06', () => {
  const ids = PERFORMANCE_RULES.map((r) => r.id).sort();
  assert.deepEqual(ids, ['PA01', 'PA02', 'PA03', 'PA04', 'PA05', 'PA06']);
});

test('PERFORMANCE_RULES: all severities are valid Severity literals', () => {
  const valid: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  for (const rule of PERFORMANCE_RULES) {
    assert.ok(
      (valid as string[]).includes(rule.severity),
      `rule ${rule.id} has invalid severity: '${rule.severity}'`,
    );
  }
});

test('PERFORMANCE_RULES: PA06 has severity critical (SPOF on a hot path)', () => {
  const pa06 = PERFORMANCE_RULES.find((r) => r.id === 'PA06');
  assert.ok(pa06 !== undefined, 'PA06 not found');
  assert.equal(pa06!.severity, 'critical');
});

test('PERFORMANCE_RULES: PA03 has severity info (telemetry not connected)', () => {
  const pa03 = PERFORMANCE_RULES.find((r) => r.id === 'PA03');
  assert.ok(pa03 !== undefined, 'PA03 not found');
  assert.equal(pa03!.severity, 'info');
});

test('PERFORMANCE_RULES: all rules have non-empty title and description', () => {
  for (const rule of PERFORMANCE_RULES) {
    assert.ok(rule.title.length > 0, `rule ${rule.id} has empty title`);
    assert.ok(rule.description.length > 0, `rule ${rule.id} has empty description`);
  }
});

test('PerformanceRuleRegistry.list: returns all 6 rules', () => {
  const registry = new PerformanceRuleRegistry();
  const all = registry.list();
  assert.equal(all.length, 6);
});

test('PerformanceRuleRegistry.get: returns the correct rule by id', () => {
  const registry = new PerformanceRuleRegistry();
  for (const expected of PERFORMANCE_RULES) {
    const found = registry.get(expected.id);
    assert.ok(found !== undefined, `get('${expected.id}') returned undefined`);
    assert.deepEqual(found, expected);
  }
});

test('PerformanceRuleRegistry.get: returns undefined for an unknown id', () => {
  const registry = new PerformanceRuleRegistry();
  assert.equal(registry.get('PA99'), undefined);
  assert.equal(registry.get(''), undefined);
  assert.equal(registry.get('pa01'), undefined); // case-sensitive
});

test('PerformanceRuleRegistry.list: result is a readonly-safe array (does not mutate source)', () => {
  const registry = new PerformanceRuleRegistry();
  const first = registry.list();
  const second = registry.list();
  // Reference equality may differ; content must match PERFORMANCE_RULES exactly.
  assert.deepEqual([...first], [...second]);
  assert.equal(first.length, PERFORMANCE_RULES.length);
});

// ── (C) Type-shape smoke tests ────────────────────────────────────────────────

test('MetricDescriptor literal: all required fields are present', () => {
  const descriptor: MetricDescriptor = {
    key: 'latency.api./v1/orders',
    kind: 'latency',
    entity: 'api:/v1/orders',
    unit: 'ms',
    liveSource: 'Cloudflare Analytics Engine — Worker timing headers',
    requiredEnv: ['CF_ACCOUNT_ID', 'CF_API_TOKEN'],
    reachable: true,
  };
  assert.equal(descriptor.key, 'latency.api./v1/orders');
  assert.equal(descriptor.kind, 'latency');
  assert.equal(descriptor.reachable, true);
  assert.equal(descriptor.requiredEnv.length, 2);
});

test('MetricDescriptor literal: reachable can be false with unreachableReason', () => {
  const descriptor: MetricDescriptor = {
    key: 'ratio.cache.redis',
    kind: 'ratio',
    entity: 'service:redis',
    unit: '%',
    liveSource: 'Redis INFO stats via BFF',
    requiredEnv: [],
    reachable: false,
    unreachableReason: 'Redis is not in the GET boundary — requires a dedicated stats endpoint',
  };
  assert.equal(descriptor.reachable, false);
  assert.ok(descriptor.unreachableReason !== undefined);
});

test('MetricDescriptor literal: all MetricKind values are valid string literals', () => {
  const kinds: MetricKind[] = [
    'latency',
    'throughput',
    'ratio',
    'resource',
    'cold-start',
    'scaling',
  ];
  assert.equal(kinds.length, 6);
  for (const k of kinds) {
    assert.equal(typeof k, 'string');
  }
});

test('MetricSeries CONNECTED: values are a non-null array of numbers', () => {
  const descriptor: MetricDescriptor = {
    key: 'latency.api./v1/checkout',
    kind: 'latency',
    entity: 'api:/v1/checkout',
    unit: 'ms',
    liveSource: 'Cloudflare Analytics Engine',
    requiredEnv: ['CF_ACCOUNT_ID'],
    reachable: true,
  };
  const series: MetricSeries = {
    descriptor,
    connection: 'CONNECTED',
    values: [120, 145, 200, 98, 310],
    evidence: [ev('file', 'src/shared/types.ts')],
  };
  assert.equal(series.connection, 'CONNECTED');
  assert.ok(series.values !== null, 'values must not be null when CONNECTED');
  assert.equal((series.values as readonly number[]).length, 5);
});

// ── (D) No-fabrication contract spot-checks ───────────────────────────────────

test('NO FABRICATION — MetricSeries NOT_CONNECTED must have values null', () => {
  const descriptor: MetricDescriptor = {
    key: 'throughput.worker.order-worker',
    kind: 'throughput',
    entity: 'worker:order-worker',
    unit: 'req/s',
    liveSource: 'Cloudflare Workers Analytics — queue consumer metrics',
    requiredEnv: ['CF_ACCOUNT_ID', 'CF_API_TOKEN'],
    reachable: true,
  };
  // The no-fabrication law: when NOT_CONNECTED, values MUST be null — never synthesized.
  const series: MetricSeries = {
    descriptor,
    connection: 'NOT_CONNECTED',
    values: null,
    evidence: [notConnectedEv('CF_ACCOUNT_ID')],
  };
  assert.equal(series.connection, 'NOT_CONNECTED');
  assert.equal(series.values, null, 'NOT_CONNECTED MetricSeries MUST have values null (no fabrication)');
});

test('NO FABRICATION — a second NOT_CONNECTED series also has values null', () => {
  const descriptor: MetricDescriptor = {
    key: 'resource.db.connections',
    kind: 'resource',
    entity: 'database:postgres',
    unit: 'count',
    liveSource: 'Supabase pg_stat_activity via admin API',
    requiredEnv: ['SUPABASE_SERVICE_ROLE_KEY'],
    reachable: false,
    unreachableReason: 'DB admin endpoint not in the GET boundary',
  };
  const series: MetricSeries = {
    descriptor,
    connection: 'NOT_CONNECTED',
    values: null,
    evidence: [notConnectedEv('SUPABASE_SERVICE_ROLE_KEY')],
  };
  assert.equal(series.values, null);
});

test('NO FABRICATION — CapacityForecast NOT_CONNECTED has forecastValues null', () => {
  const forecast: CapacityForecast = performance(
    {
      subject: 'worker:order-worker',
      connection: 'NOT_CONNECTED' as Connection,
      forecastValues: null,
      horizon: 30,
      method: 'linear-extrapolation',
      summary: 'No series provided — forecast unavailable (NOT CONNECTED).',
    },
    {
      evidence: [notConnectedEv('CF_ACCOUNT_ID')],
      liveConnected: false,
      now: fixedNow,
    },
  );
  assert.equal(forecast.connection, 'NOT_CONNECTED');
  assert.equal(
    forecast.forecastValues,
    null,
    'CapacityForecast NOT_CONNECTED must have forecastValues null — no fabrication',
  );
});

test('NO FABRICATION — CostForecast NOT_CONNECTED has forecastValues null', () => {
  const forecast: CostForecast = performance(
    {
      connection: 'NOT_CONNECTED' as Connection,
      modeledComponents: ['cloudflare-workers', 'supabase-egress', 'razorpay-fees'],
      forecastValues: null,
      horizon: 30,
      summary: 'Cost model inputs present structurally; totals are query-bound (NOT CONNECTED).',
    },
    {
      evidence: [notConnectedEv('CF_API_TOKEN')],
      liveConnected: false,
      now: fixedNow,
    },
  );
  assert.equal(forecast.connection, 'NOT_CONNECTED');
  assert.equal(
    forecast.forecastValues,
    null,
    'CostForecast NOT_CONNECTED must have forecastValues null — no fabrication',
  );
});

// ── Recommendation must carry advisory: true ──────────────────────────────────

test('Recommendation literal: advisory must be true (literal — not just truthy)', () => {
  const rec: Recommendation = {
    id: 'rec-001',
    rule: 'PA06',
    advisory: true,
    action: 'Add a replica for the payments RPC to eliminate the SPOF on the hot path.',
    rationale: 'PA06: SPOF on a hot path — payments has no replica.',
    severity: 'critical',
    evidence: [ev('graph-node', 'rpc:create_checkout_order')],
  };
  // TypeScript enforces advisory: true at compile-time; we enforce the runtime value here.
  assert.equal(rec.advisory, true, 'Recommendation.advisory must be the literal true');
  // Explicitly confirm it is not merely truthy.
  assert.strictEqual(rec.advisory, true as const);
});

test('Recommendation literal: advisory cannot be false (type is literal true)', () => {
  // Construct via a cast to confirm the shape and then assert.
  const rec = {
    id: 'rec-002',
    rule: 'PA03',
    advisory: true as const, // TypeScript enforces this; no false allowed
    action: 'Connect Cloudflare Analytics Engine to instrument API latency.',
    rationale: 'PA03: Telemetry not connected.',
    severity: 'info' as Severity,
    evidence: [] as Evidence[],
  };
  assert.equal(rec.advisory, true);
  // The advisory field IS the literal true — verify it is not the number 1, not a string.
  assert.strictEqual(typeof rec.advisory, 'boolean');
});

// ── PerformanceReport shape ────────────────────────────────────────────────────

test('PerformanceReport literal: all required fields are present and have correct types', () => {
  const desc: MetricDescriptor = {
    key: 'latency.api./v1/health',
    kind: 'latency',
    entity: 'api:/v1/health',
    unit: 'ms',
    liveSource: 'Cloudflare Workers Analytics',
    requiredEnv: ['CF_ACCOUNT_ID'],
    reachable: true,
  };
  const finding: PerformanceFinding = {
    id: 'finding-001',
    rule: 'PA03',
    severity: 'info',
    subject: 'api:/v1/health',
    title: 'Telemetry not connected',
    detail: 'No live source connected for latency.api./v1/health',
    connection: 'NOT_CONNECTED',
    evidence: [notConnectedEv('CF_ACCOUNT_ID')],
  };
  const rec: Recommendation = {
    id: 'rec-001',
    rule: 'PA03',
    advisory: true,
    action: 'Connect Cloudflare Analytics Engine.',
    rationale: 'PA03: measure before optimizing.',
    severity: 'info',
    evidence: [],
  };
  const report: PerformanceReport = performance(
    {
      catalog: [desc],
      connectedMetrics: 0,
      notConnectedMetrics: 1,
      latencyModel: [],
      findings: [finding],
      recommendations: [rec],
      capacity: null,
      cost: null,
      summary: 'Structural-only. All metrics NOT CONNECTED.',
    },
    {
      evidence: [notConnectedEv('CF_ACCOUNT_ID')],
      liveConnected: false,
      now: fixedNow,
    },
  );

  assert.ok(Array.isArray(report.catalog));
  assert.equal(report.catalog.length, 1);
  assert.equal(report.connectedMetrics, 0);
  assert.equal(report.notConnectedMetrics, 1);
  assert.ok(Array.isArray(report.latencyModel));
  assert.ok(Array.isArray(report.findings));
  assert.ok(Array.isArray(report.recommendations));
  assert.equal(report.capacity, null);
  assert.equal(report.cost, null);
  assert.ok(typeof report.summary === 'string');
  assert.equal(report.timestamp, FIXED_TS);
  assert.equal(report.liveConnected, false);
});

test('PerformanceReport: every recommendation in the report has advisory: true', () => {
  const recs: Recommendation[] = [
    {
      id: 'r1',
      rule: 'PA01',
      advisory: true,
      action: 'Reduce hop chain depth.',
      rationale: 'PA01: Deep dependency chain.',
      severity: 'medium',
      evidence: [],
    },
    {
      id: 'r2',
      rule: 'PA04',
      advisory: true,
      action: 'Add a queue consumer for the notification queue.',
      rationale: 'PA04: Queue without consumer.',
      severity: 'high',
      evidence: [],
    },
  ];
  for (const rec of recs) {
    assert.strictEqual(rec.advisory, true, `recommendation ${rec.id} must have advisory: true`);
  }
});

// ── LatencyModelEntry shape ───────────────────────────────────────────────────

test('LatencyModelEntry literal: single-hop band, all fields present', () => {
  const entry: LatencyModelEntry = {
    entity: 'api:/v1/health',
    chain: ['edge:cloudflare', 'api:/v1/health'],
    hops: 1,
    band: 'single-hop',
    note: 'Health endpoint passes through the edge only.',
    evidence: [ev('graph-node', 'api:/v1/health')],
  };
  assert.equal(entry.hops, 1);
  assert.equal(entry.band, 'single-hop');
  assert.equal(entry.chain.length, 2);
});

test('LatencyModelEntry literal: deep-chain band for checkout', () => {
  const entry: LatencyModelEntry = {
    entity: 'api:/v1/checkout',
    chain: [
      'edge:cloudflare',
      'api:/v1/checkout',
      'rpc:create_checkout_order',
      'table:orders',
      'table:order_items',
      'table:inventory',
    ],
    hops: 5,
    band: 'deep-chain',
    note: 'Checkout touches 5+ hops including inventory checks.',
    evidence: [ev('graph-node', 'api:/v1/checkout'), ev('rpc', 'create_checkout_order')],
  };
  assert.equal(entry.band, 'deep-chain');
  assert.ok(entry.hops >= 4, 'deep-chain should have >= 4 hops');
});

// ── PerformanceFinding shape ───────────────────────────────────────────────────

test('PerformanceFinding literal: all fields present, CONNECTED and NOT_CONNECTED both valid', () => {
  const connected: PerformanceFinding = {
    id: 'f-001',
    rule: 'PA02',
    severity: 'high',
    subject: 'rpc:create_checkout_order',
    title: 'High fan-in hotspot',
    detail: '8 API routes call create_checkout_order — single mutation RPC concentrates load.',
    connection: 'CONNECTED',
    evidence: [ev('graph-node', 'rpc:create_checkout_order', 'graphify-out/graph.json')],
  };
  assert.equal(connected.connection, 'CONNECTED');
  assert.equal(connected.rule, 'PA02');

  const notConn: PerformanceFinding = {
    id: 'f-002',
    rule: 'PA05',
    severity: 'medium',
    subject: 'service:redis',
    title: 'Cache layer unobserved',
    detail: 'Redis exists but hit ratio is unobservable — CF_ACCOUNT_ID not connected.',
    connection: 'NOT_CONNECTED',
    evidence: [notConnectedEv('CF_ACCOUNT_ID')],
  };
  assert.equal(notConn.connection, 'NOT_CONNECTED');
});

// ── Connection type exhaustiveness ────────────────────────────────────────────

test('Connection type: CONNECTED and NOT_CONNECTED are the only two values', () => {
  const values: Connection[] = ['CONNECTED', 'NOT_CONNECTED'];
  assert.equal(values.length, 2);
  for (const v of values) {
    assert.equal(typeof v, 'string');
  }
});

// ── SeriesStatistics shape ────────────────────────────────────────────────────

test('SeriesStatistics literal: all 8 statistical fields present', () => {
  // SeriesStatistics is a pure shape — no constructor; verify the type holds at runtime.
  const stats: SeriesStatistics = {
    count: 5,
    mean: 174.6,
    min: 98,
    max: 310,
    p50: 145,
    p95: 295,
    p99: 308,
    stddev: 70.2,
  };
  assert.equal(stats.count, 5);
  assert.ok(stats.mean > 0);
  assert.ok(stats.min <= stats.p50);
  assert.ok(stats.p50 <= stats.p95);
  assert.ok(stats.p95 <= stats.p99);
  assert.ok(stats.p99 <= stats.max);
});

test('SeriesStatistics: min <= p50 <= p95 <= p99 <= max is a structural invariant', () => {
  const stats: SeriesStatistics = {
    count: 10,
    mean: 200,
    min: 50,
    max: 900,
    p50: 190,
    p95: 750,
    p99: 860,
    stddev: 120,
  };
  assert.ok(stats.min <= stats.p50);
  assert.ok(stats.p50 <= stats.p95);
  assert.ok(stats.p95 <= stats.p99);
  assert.ok(stats.p99 <= stats.max);
});
