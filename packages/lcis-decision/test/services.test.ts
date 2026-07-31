/**
 * LDSS per-service tests — alternative / tradeoff / comparison / graph / decision-engine
 * (pure) and affected-surface (twin-composing). Deterministic, exact expected outputs.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { AlternativeService } from '../src/alternative/index';
import { TradeoffService } from '../src/tradeoff/index';
import { ComparisonService } from '../src/comparison/index';
import { DecisionGraphService } from '../src/graph/index';
import { DecisionEngineService, CONDITIONAL_MARGIN } from '../src/decision-engine/index';
import { AffectedSurfaceService } from '../src/affected/index';
import { AXES, composite } from '../src/shared/index';
import type { Alternative, DecisionKind } from '../src/shared/index';

const KINDS: DecisionKind[] = ['deploy', 'migration', 'rollback', 'scaling', 'business', 'architecture'];
const FIXED = '2026-07-04T00:00:00.000Z';
const now = () => FIXED;

// ── AlternativeService ──────────────────────────────────────────────────────────

test('alternativesFor: every kind yields >= 3 ranked alternatives', () => {
  const svc = new AlternativeService();
  for (const k of KINDS) {
    const alts = svc.alternativesFor(k, 'subject-x');
    assert.ok(alts.length >= 3, `${k}`);
  }
});

test('alternativesFor: ranked by composite desc', () => {
  const alts = new AlternativeService().alternativesFor('deploy', 's');
  for (let i = 1; i < alts.length; i++) assert.ok(alts[i - 1]!.compositeScore >= alts[i]!.compositeScore);
});

test('alternativesFor: composite matches the shared formula exactly', () => {
  for (const a of new AlternativeService().alternativesFor('migration', 's')) {
    assert.equal(a.compositeScore, composite(a.scores));
  }
});

test('alternativesFor: deterministic + every alternative carries evidence', () => {
  const a = new AlternativeService().alternativesFor('scaling', 's');
  const b = new AlternativeService().alternativesFor('scaling', 's');
  assert.deepEqual(a, b);
  for (const alt of a) assert.ok(alt.evidence.length >= 1);
});

// ── TradeoffService ─────────────────────────────────────────────────────────────

test('tradeoffs: one winner per axis; winner truly maxes that axis', () => {
  const alts = new AlternativeService().alternativesFor('deploy', 's');
  const tradeoffs = new TradeoffService().tradeoffs(alts);
  assert.equal(tradeoffs.length, AXES.length);
  for (const t of tradeoffs) {
    const winner = alts.find((a) => a.id === t.winner)!;
    const maxScore = Math.max(...alts.map((a) => a.scores[t.axis]));
    assert.equal(winner.scores[t.axis], maxScore, `axis ${t.axis}`);
  }
});

test('tradeoffs: empty input → []', () => {
  assert.deepEqual(new TradeoffService().tradeoffs([]), []);
});

// ── ComparisonService ───────────────────────────────────────────────────────────

test('risk/cost comparisons: rows sorted desc, best is the top', () => {
  const alts = new AlternativeService().alternativesFor('rollback', 's');
  const svc = new ComparisonService();
  for (const cmp of [svc.riskComparison(alts), svc.costComparison(alts)]) {
    for (let i = 1; i < cmp.rows.length; i++) assert.ok(cmp.rows[i - 1]!.score >= cmp.rows[i]!.score);
    assert.equal(cmp.best, cmp.rows[0]!.alternative);
  }
});

// ── DecisionGraphService ────────────────────────────────────────────────────────

test('composedFrom: every kind names >= 2 prior systems', () => {
  const svc = new DecisionGraphService();
  for (const k of KINDS) assert.ok(svc.composedFrom(k).length >= 2, `${k}`);
});

// ── DecisionEngineService ───────────────────────────────────────────────────────

test('rank: empty → UNKNOWN, null recommended', () => {
  const r = new DecisionEngineService().rank([]);
  assert.equal(r.verdict, 'UNKNOWN');
  assert.equal(r.recommended, null);
});

test('rank: clear leader → RECOMMENDED', () => {
  const alts: Alternative[] = [
    { id: 'a', strategy: 'A', description: '', scores: { risk: 0.9, cost: 0.9, readiness: 0.9, 'blast-radius': 0.9 }, compositeScore: 0.9, evidence: [] },
    { id: 'b', strategy: 'B', description: '', scores: { risk: 0.2, cost: 0.2, readiness: 0.2, 'blast-radius': 0.2 }, compositeScore: 0.2, evidence: [] },
  ];
  const r = new DecisionEngineService().rank(alts);
  assert.equal(r.verdict, 'RECOMMENDED');
  assert.equal(r.recommended, 'a');
  assert.ok(r.margin >= CONDITIONAL_MARGIN);
});

test('rank: near-tie → CONDITIONAL', () => {
  const alts: Alternative[] = [
    { id: 'a', strategy: 'A', description: '', scores: { risk: 0.8, cost: 0.8, readiness: 0.8, 'blast-radius': 0.8 }, compositeScore: 0.8, evidence: [] },
    { id: 'b', strategy: 'B', description: '', scores: { risk: 0.79, cost: 0.79, readiness: 0.79, 'blast-radius': 0.79 }, compositeScore: 0.79, evidence: [] },
  ];
  const r = new DecisionEngineService().rank(alts);
  assert.equal(r.verdict, 'CONDITIONAL');
});

test('rank: single alternative → RECOMMENDED', () => {
  const alts: Alternative[] = [
    { id: 'only', strategy: 'Only', description: '', scores: { risk: 0.5, cost: 0.5, readiness: 0.5, 'blast-radius': 0.5 }, compositeScore: 0.5, evidence: [] },
  ];
  assert.equal(new DecisionEngineService().rank(alts).verdict, 'RECOMMENDED');
});

// ── AffectedSurfaceService (twin-composing) ─────────────────────────────────────

function stubStore(a: Record<string, unknown>): ArtifactStore {
  return {
    has: (n: string) => n in a,
    tryRead: (n: string) => a[n] ?? null,
    read: (n: string) => { if (!(n in a)) throw new Error('missing ' + n); return a[n]; },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

const TWIN_FIXTURES = {
  graph: { nodes: [], links: [] },
  'domain-intel.json': { domains: [{ key: 'orders', dependsOn: [], tables: ['orders'], rpcs: ['create_checkout_order'], owners: ['@t'] }] },
  'db-intel.json': { tables: [{ name: 'orders' }], rpcs: [{ name: 'create_checkout_order' }], policies: [], triggers: [] },
  'infra-intel.json': { workers: [{ name: 'queue-worker' }], queues: [{ name: 'q' }], routes: [{ path: '/v1/orders' }] },
};

function affectedSvc(a: Record<string, unknown> = TWIN_FIXTURES) {
  return new AffectedSurfaceService(createEngine({ store: stubStore(a), repoRoot: '/stub' }), now);
}

test('affectedFor: resolves a known domain subject to a structural surface', () => {
  const s = affectedSvc().affectedFor('domain:orders');
  assert.equal(s.connection, 'CONNECTED');
  assert.ok(s.systems.length >= 1);
});

test('affectedFor: unknown subject → empty NOT_CONNECTED surface, no throw', () => {
  const s = affectedSvc().affectedFor('nonexistent-zzz');
  assert.equal(s.connection, 'NOT_CONNECTED');
  assert.equal(s.systems.length, 0);
});

test('affectedFor: empty twin → empty surface, never throws', () => {
  const s = affectedSvc({ graph: { nodes: [], links: [] } }).affectedFor('domain:orders');
  assert.equal(s.connection, 'NOT_CONNECTED');
});

test('affectedFor: deterministic', () => {
  const a = affectedSvc().affectedFor('domain:orders');
  const b = affectedSvc().affectedFor('domain:orders');
  assert.deepEqual(a, b);
});
