/**
 * RecommendationService tests — every PA rule fires/does-not-fire deterministically,
 * every recommendation is advisory: true with evidence, ordering is severity-stable.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { RecommendationService, type RecommendationInput } from '../src/recommend/RecommendationService';
import type { LatencyModelEntry } from '../src/shared/types';

const svc = new RecommendationService();

function entry(entity: string, band: LatencyModelEntry['band'], hops = 5): LatencyModelEntry {
  return {
    entity,
    chain: [entity, 'rpc:x', 'table:y'],
    hops,
    band,
    note: `Structural model from topology (${hops} hops) — not a measurement`,
    evidence: [],
  };
}

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    latencyModel: [],
    fanTop: [],
    spofIds: [],
    consumerlessQueueIds: [],
    notConnectedMetricKeys: [],
    cacheObserved: true,
    ...overrides,
  };
}

// ── Empty input ───────────────────────────────────────────────────────────────

test('empty input with cacheObserved → zero recommendations', () => {
  assert.deepEqual(svc.recommend(input()), []);
});

// ── PA01: deep dependency chain ───────────────────────────────────────────────

test('PA01 fires once per deep-chain entry', () => {
  const recs = svc.recommend(input({ latencyModel: [entry('api:/a', 'deep-chain'), entry('api:/b', 'deep-chain')] }));
  assert.equal(recs.filter((r) => r.rule === 'PA01').length, 2);
});

test('PA01 does not fire for single-hop or multi-hop bands', () => {
  const recs = svc.recommend(input({ latencyModel: [entry('api:/a', 'single-hop', 1), entry('api:/b', 'multi-hop', 2)] }));
  assert.equal(recs.filter((r) => r.rule === 'PA01').length, 0);
});

test('PA01 severity is medium and cites the entity', () => {
  const recs = svc.recommend(input({ latencyModel: [entry('api:/orders', 'deep-chain')] }));
  const pa01 = recs.find((r) => r.rule === 'PA01')!;
  assert.equal(pa01.severity, 'medium');
  assert.match(pa01.rationale + pa01.action, /api:\/orders/);
});

// ── PA02: high fan-in hotspot ─────────────────────────────────────────────────

test('PA02 fires per entry with fanIn >= 5', () => {
  const recs = svc.recommend(input({ fanTop: [{ id: 'rpc:hot', fanIn: 7, fanOut: 1 }, { id: 'rpc:warm', fanIn: 5, fanOut: 0 }] }));
  assert.equal(recs.filter((r) => r.rule === 'PA02').length, 2);
});

test('PA02 does not fire below the fanIn threshold', () => {
  const recs = svc.recommend(input({ fanTop: [{ id: 'rpc:cool', fanIn: 4, fanOut: 9 }] }));
  assert.equal(recs.filter((r) => r.rule === 'PA02').length, 0);
});

// ── PA03: telemetry not connected (fires ONCE) ────────────────────────────────

test('PA03 fires exactly once regardless of how many keys are unconnected', () => {
  const recs = svc.recommend(input({ notConnectedMetricKeys: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }));
  assert.equal(recs.filter((r) => r.rule === 'PA03').length, 1);
});

test('PA03 detail lists at most 5 keys', () => {
  const recs = svc.recommend(input({ notConnectedMetricKeys: ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'] }));
  const pa03 = recs.find((r) => r.rule === 'PA03')!;
  assert.ok(!(pa03.rationale + pa03.action).includes('k6'), 'must cap the listed keys at 5');
});

test('PA03 does not fire when all metrics are connected', () => {
  assert.equal(svc.recommend(input({ notConnectedMetricKeys: [] })).filter((r) => r.rule === 'PA03').length, 0);
});

// ── PA04: queue without consumer ──────────────────────────────────────────────

test('PA04 fires per consumerless queue', () => {
  const recs = svc.recommend(input({ consumerlessQueueIds: ['queue:a', 'queue:b'] }));
  assert.equal(recs.filter((r) => r.rule === 'PA04').length, 2);
});

test('PA04 severity is high and cites the queue id', () => {
  const recs = svc.recommend(input({ consumerlessQueueIds: ['queue:order-events'] }));
  const pa04 = recs.find((r) => r.rule === 'PA04')!;
  assert.equal(pa04.severity, 'high');
  assert.match(pa04.rationale + pa04.action, /queue:order-events/);
});

// ── PA05: cache unobserved (fires ONCE) ───────────────────────────────────────

test('PA05 fires once when cacheObserved is false', () => {
  assert.equal(svc.recommend(input({ cacheObserved: false })).filter((r) => r.rule === 'PA05').length, 1);
});

test('PA05 silent when the cache is observed', () => {
  assert.equal(svc.recommend(input({ cacheObserved: true })).filter((r) => r.rule === 'PA05').length, 0);
});

// ── PA06: SPOF on a hot path ──────────────────────────────────────────────────

test('PA06 fires for a SPOF that is also in fanTop with fanIn >= 3', () => {
  const recs = svc.recommend(input({ spofIds: ['rpc:hub'], fanTop: [{ id: 'rpc:hub', fanIn: 3, fanOut: 2 }] }));
  assert.equal(recs.filter((r) => r.rule === 'PA06').length, 1);
});

test('PA06 silent for a SPOF with low fan-in', () => {
  const recs = svc.recommend(input({ spofIds: ['rpc:leaf'], fanTop: [{ id: 'rpc:leaf', fanIn: 2, fanOut: 0 }] }));
  assert.equal(recs.filter((r) => r.rule === 'PA06').length, 0);
});

test('PA06 silent for a SPOF absent from fanTop', () => {
  const recs = svc.recommend(input({ spofIds: ['rpc:ghost'], fanTop: [{ id: 'rpc:other', fanIn: 9, fanOut: 0 }] }));
  assert.equal(recs.filter((r) => r.rule === 'PA06').length, 0);
});

test('PA06 severity is critical', () => {
  const recs = svc.recommend(input({ spofIds: ['rpc:hub'], fanTop: [{ id: 'rpc:hub', fanIn: 6, fanOut: 0 }] }));
  assert.equal(recs.find((r) => r.rule === 'PA06')!.severity, 'critical');
});

// ── The advisory-only + evidence laws ─────────────────────────────────────────

function fullInput(): RecommendationInput {
  return input({
    latencyModel: [entry('api:/deep', 'deep-chain')],
    fanTop: [{ id: 'rpc:hub', fanIn: 6, fanOut: 1 }],
    spofIds: ['rpc:hub'],
    consumerlessQueueIds: ['queue:orphan'],
    notConnectedMetricKeys: ['latency.api./deep'],
    cacheObserved: false,
  });
}

test('every recommendation is advisory: true (the literal) with non-empty evidence', () => {
  const recs = svc.recommend(fullInput());
  assert.ok(recs.length >= 6);
  for (const r of recs) {
    assert.equal(r.advisory, true);
    assert.ok(r.evidence.length >= 1, `${r.id} must carry evidence`);
  }
});

test('all six rules can fire together', () => {
  const rules = new Set(svc.recommend(fullInput()).map((r) => r.rule));
  for (const rule of ['PA01', 'PA02', 'PA03', 'PA04', 'PA05', 'PA06']) {
    assert.ok(rules.has(rule), `${rule} missing`);
  }
});

test('ordering: severity critical→high→medium→low→info, then id', () => {
  const recs = svc.recommend(fullInput());
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  for (let i = 1; i < recs.length; i++) {
    const prev = order[recs[i - 1]!.severity]!;
    const cur = order[recs[i]!.severity]!;
    assert.ok(prev < cur || (prev === cur && recs[i - 1]!.id <= recs[i]!.id), `order violated at ${i}`);
  }
});

test('ids are rule-scoped and 1-based', () => {
  const recs = svc.recommend(fullInput());
  for (const r of recs) {
    assert.match(r.id, new RegExp(`^${r.rule}-\\d+$`));
  }
});

test('deterministic: identical input → identical JSON', () => {
  const a = svc.recommend(fullInput());
  const b = svc.recommend(fullInput());
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('input is not mutated', () => {
  const i = fullInput();
  const snapshot = JSON.parse(JSON.stringify(i));
  svc.recommend(i);
  assert.deepEqual(JSON.parse(JSON.stringify(i)), snapshot);
});
