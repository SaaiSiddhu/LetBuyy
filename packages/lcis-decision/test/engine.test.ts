/**
 * DecisionSupportEngine (LDSS facade) tests — the decide() pipeline for all six decision
 * kinds, the safety law (recommend-only), the required decision anatomy (alternatives,
 * tradeoffs, affected surface, comparisons, composition), determinism, and provenance.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import {
  createDecisionSupportEngine,
  getDecisionSupportEngine,
  resetDecisionSupportEngine,
} from '../src/index';
import type { DecisionKind } from '../src/index';

const FIXED = '2026-07-04T00:00:00.000Z';
const KINDS: DecisionKind[] = ['deploy', 'migration', 'rollback', 'scaling', 'business', 'architecture'];

function stubStore(a: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in a,
    tryRead: (n: string) => a[n] ?? null,
    read: (n: string) => { if (!(n in a)) throw new Error('missing ' + n); return a[n]; },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

const FIXTURES = {
  graph: { nodes: [], links: [] },
  'domain-intel.json': { domains: [{ key: 'payments', dependsOn: ['orders'], tables: ['payment_transactions'], rpcs: ['confirm_order_payment_with_ledger'], owners: ['@pay'] }, { key: 'orders', dependsOn: [], tables: ['orders'], rpcs: ['create_checkout_order'], owners: ['@ord'] }] },
  'db-intel.json': { tables: [{ name: 'orders' }, { name: 'payment_transactions' }], rpcs: [{ name: 'create_checkout_order' }], policies: [], triggers: [] },
  'infra-intel.json': { workers: [{ name: 'queue-worker' }], queues: [{ name: 'order-events' }], routes: [{ path: '/v1/orders' }] },
};

function engine(a: Record<string, unknown> = FIXTURES) {
  return createDecisionSupportEngine({ core: createEngine({ store: stubStore(a), repoRoot: '/stub' }), now: () => FIXED });
}

test('engine exposes the six services; singleton get/reset works', () => {
  const e = engine();
  for (const svc of ['alternative', 'tradeoff', 'comparison', 'affected', 'graph', 'decisionEngine'] as const) {
    assert.ok(e[svc], `service ${svc} missing`);
  }
  resetDecisionSupportEngine();
  const a = getDecisionSupportEngine({ core: createEngine({ store: stubStore({}), repoRoot: '/stub' }), now: () => FIXED });
  assert.equal(getDecisionSupportEngine(), a);
  resetDecisionSupportEngine();
});

test('decide: every decision kind yields a complete decision anatomy', () => {
  const e = engine();
  for (const kind of KINDS) {
    const d = e.decide({ kind, subject: 'domain:payments' });
    assert.ok(['RECOMMENDED', 'CONDITIONAL', 'UNKNOWN'].includes(d.verdict), kind);
    assert.ok(d.alternatives.length >= 3, `${kind} alternatives`);
    assert.equal(d.tradeoffs.length, 4, `${kind} tradeoffs`);
    assert.ok(d.riskComparison.rows.length >= 3, `${kind} risk`);
    assert.ok(d.costComparison.rows.length >= 3, `${kind} cost`);
    assert.ok(d.composedFrom.length >= 2, `${kind} composedFrom`);
    assert.ok(d.recommended !== null, `${kind} recommended`);
  }
});

test('decide: recommended is the top-ranked alternative', () => {
  const d = engine().decide({ kind: 'deploy', subject: 'domain:payments' });
  assert.equal(d.recommended, d.alternatives[0]!.id);
});

test('decide: affected surface resolved from the twin for a known subject', () => {
  const d = engine().decide({ kind: 'migration', subject: 'table:orders' });
  assert.equal(d.affected.connection, 'CONNECTED');
  assert.ok(d.affected.systems.length >= 1);
});

test('decide: unknown subject → affected surface NOT_CONNECTED, decision still formed', () => {
  const d = engine().decide({ kind: 'deploy', subject: 'zzz-unknown' });
  assert.equal(d.affected.connection, 'NOT_CONNECTED');
  assert.ok(d.recommended !== null);
});

test('safety law: rationale + summary state recommendation-only, no execution', () => {
  const d = engine().decide({ kind: 'rollback', subject: 'domain:payments' });
  assert.match(d.rationale, /Advisory only|recommends/i);
  assert.match(d.summary, /no execution|Recommendation only/i);
});

test('decide: context is incorporated into evidence', () => {
  const d = engine().decide({ kind: 'scaling', subject: 'worker:queue-worker', context: 'p95 latency rising during peak' });
  assert.ok(d.evidence.some((e) => e.detail?.includes('p95 latency')));
});

test('decide: provenance — fixed timestamp, evidence, liveConnected false', () => {
  const d = engine().decide({ kind: 'architecture', subject: 'domain:orders' });
  assert.equal(d.timestamp, FIXED);
  assert.equal(d.liveConnected, false);
  assert.ok(d.evidence.length > 0);
});

test('generateDecisionReport wraps a decision with its own provenance', () => {
  const r = engine().generateDecisionReport({ kind: 'deploy', subject: 'domain:payments' });
  assert.ok(r.decision);
  assert.equal(r.timestamp, FIXED);
  assert.match(r.summary, /Decision report/);
});

test('deterministic replay: same request + fixtures → byte-identical decision', () => {
  const a = engine().decide({ kind: 'deploy', subject: 'domain:payments', context: 'ctx' });
  const b = engine().decide({ kind: 'deploy', subject: 'domain:payments', context: 'ctx' });
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('money/deploy decision favors a safe strategy (canary leads full-rollout)', () => {
  const d = engine().decide({ kind: 'deploy', subject: 'domain:payments' });
  const canary = d.alternatives.find((a) => a.id === 'canary')!;
  const full = d.alternatives.find((a) => a.id === 'full-rollout')!;
  assert.ok(canary.compositeScore > full.compositeScore, 'canary should outrank full rollout on the risk-weighted composite');
});
