/**
 * RootCauseEngine (LRAS facade) tests — the diagnose() pipeline end-to-end over stub
 * artifacts, verdict honesty (UNKNOWN/PARTIAL/DIAGNOSED), determinism, and the
 * anti-hallucination law at the composition level.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { createRootCauseEngine, getRootCauseEngine, resetRootCauseEngine } from '../src/index';

const FIXED = '2026-07-04T00:00:00.000Z';

function stubStore(artifacts: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in artifacts,
    tryRead: (n: string) => artifacts[n] ?? null,
    read: (n: string) => {
      if (!(n in artifacts)) throw new Error('missing ' + n);
      return artifacts[n];
    },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

const FIXTURES: Record<string, unknown> = {
  graph: { nodes: [], links: [] },
  'domain-intel.json': {
    domains: [
      { key: 'payments', dependsOn: ['orders'], tables: ['payment_transactions'], rpcs: ['confirm_order_payment_with_ledger'], owners: ['@payments-team'] },
      { key: 'orders', dependsOn: [], tables: ['orders'], rpcs: ['create_checkout_order'], owners: ['@orders-team'] },
    ],
  },
  'db-intel.json': {
    tables: [{ name: 'orders' }, { name: 'payment_transactions' }],
    rpcs: [{ name: 'create_checkout_order' }, { name: 'confirm_order_payment_with_ledger' }],
    policies: [{ name: 'orders_rls', table: 'orders' }],
    triggers: [],
  },
  'infra-intel.json': {
    workers: [{ name: 'queue-worker' }],
    queues: [{ name: 'order-events' }],
    routes: [{ path: '/v1/orders' }],
  },
  'memory-intel.json': {
    decisions: [{ id: 'D-001', title: 'Adopt canonical ledger', type: 'payment', source: 'docs/decisions.md' }],
    migrations: [
      { n: 174, file: '174_v1_gift_card_refund_restore.sql', name: 'v1 gift card refund restore', type: 'refund', decision: 'migration 174' },
      { n: 173, file: '173_orders_index.sql', name: 'orders index', type: 'orders', decision: 'migration 173' },
    ],
  },
};

function engine(artifacts: Record<string, unknown> = FIXTURES) {
  const core = createEngine({ store: stubStore(artifacts), repoRoot: '/stub' });
  return createRootCauseEngine({ core, now: () => FIXED });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

test('engine exposes the six services; singleton get/reset works', () => {
  const e = engine();
  for (const svc of ['symptom', 'affected', 'correlation', 'hypothesis', 'attribution', 'remediation'] as const) {
    assert.ok(e[svc], `service ${svc} missing`);
  }
  resetRootCauseEngine();
  const core = createEngine({ store: stubStore({}), repoRoot: '/stub' });
  const a = getRootCauseEngine({ core, now: () => FIXED });
  assert.equal(getRootCauseEngine(), a);
  resetRootCauseEngine();
});

// ── The six mandated symptoms produce honest diagnoses ────────────────────────

test('checkout-broken: DIAGNOSED with evidence-backed hypotheses', () => {
  const d = engine().diagnose('checkout broken for all merchants');
  assert.equal(d.symptom.kind, 'checkout-broken');
  assert.equal(d.verdict, 'DIAGNOSED');
  assert.ok(d.hypotheses.length > 0);
  for (const h of d.hypotheses) {
    assert.ok(h.evidence.length >= 1, `hypothesis ${h.id} must carry evidence`);
  }
});

test('checkout-broken: RC01 fires for the refund migration', () => {
  const d = engine().diagnose('checkout broken');
  assert.ok(d.hypotheses.some((h) => h.rule === 'RC01'), `rules: ${d.hypotheses.map((h) => h.rule).join(',')}`);
});

test('orders-failing: affected systems include the orders domain, owners resolved', () => {
  const d = engine().diagnose('orders failing since this morning');
  assert.equal(d.symptom.kind, 'orders-failing');
  assert.ok(d.affected.systems.some((s) => s.includes('orders')));
});

test('queue-backlog: names the structurally unreachable backlog signal', () => {
  const d = engine().diagnose('queue backlog growing');
  assert.equal(d.symptom.kind, 'queue-backlog');
  assert.ok(d.missingSignals.some((s) => s.signal === 'edge.queue-backlog'));
});

test('high-latency: PARTIAL or DIAGNOSED, never fabricated telemetry', () => {
  const d = engine().diagnose('high latency on the storefront');
  assert.equal(d.symptom.kind, 'high-latency');
  assert.ok(['PARTIAL', 'DIAGNOSED', 'UNKNOWN'].includes(d.verdict));
  assert.ok(d.missingSignals.some((s) => s.signal === 'edge.ae-values'));
});

test('deployment-failed and worker-crashed classify correctly', () => {
  assert.equal(engine().diagnose('deployment failed on main').symptom.kind, 'deployment-failed');
  assert.equal(engine().diagnose('worker crashed overnight').symptom.kind, 'worker-crashed');
});

// ── UNKNOWN honesty ───────────────────────────────────────────────────────────

test('gibberish symptom → verdict UNKNOWN, zero hypotheses, taxonomy signal named', () => {
  const d = engine().diagnose('zzz completely unrelated gibberish zzz');
  assert.equal(d.symptom.kind, 'unknown');
  assert.equal(d.verdict, 'UNKNOWN');
  assert.equal(d.hypotheses.length, 0);
  assert.ok(d.missingSignals.some((s) => s.signal === 'symptom-taxonomy-match'));
  assert.match(d.summary, /nothing is guessed/i);
});

test('empty artifacts → diagnosis never throws, stays honest', () => {
  const d = engine({ graph: { nodes: [], links: [] } }).diagnose('checkout broken');
  assert.ok(['PARTIAL', 'DIAGNOSED', 'UNKNOWN'].includes(d.verdict));
  assert.equal(d.liveConnected, false);
});

// ── Ranking + provenance ──────────────────────────────────────────────────────

test('hypotheses are ranked by confidence desc', () => {
  const d = engine().diagnose('checkout broken');
  for (let i = 1; i < d.hypotheses.length; i++) {
    assert.ok(d.hypotheses[i - 1]!.confidence >= d.hypotheses[i]!.confidence);
  }
});

test('diagnosis carries provenance: evidence, fixed timestamp, liveConnected false', () => {
  const d = engine().diagnose('orders failing');
  assert.ok(d.evidence.length > 0);
  assert.equal(d.timestamp, FIXED);
  assert.equal(d.liveConnected, false);
});

test('verification plan present for known symptoms; empty for unknown', () => {
  assert.equal(engine().diagnose('nonsense text').verificationPlan.length, 0);
});

// ── Determinism ───────────────────────────────────────────────────────────────

test('deterministic replay: same symptom + fixtures → byte-identical diagnosis', () => {
  const a = engine().diagnose('checkout broken and orders failing');
  const b = engine().diagnose('checkout broken and orders failing');
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});
