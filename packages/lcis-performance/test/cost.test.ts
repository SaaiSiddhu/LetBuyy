/**
 * CostService tests — pricing-component extraction from cost-intelligence (present /
 * absent / malformed), the OLS delegation, and the no-fabrication NOT_CONNECTED path.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { CostService } from '../src/cost/index';

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

const COST_INTEL = {
  pricing: [
    { service: 'cloudflare-workers', unit: 'per-million-requests' },
    { service: 'supabase-db', unit: 'per-gb' },
    { service: 'vercel-bandwidth', unit: 'per-gb' },
    { service: 'resend-email', unit: 'per-thousand' },
  ],
  generatedAt: '2026-07-01',
};

function svc(artifacts: Record<string, unknown> = { 'cost-intelligence': COST_INTEL }) {
  const core = createEngine({ store: stubStore(artifacts), repoRoot: '/stub' });
  return new CostService(core, () => FIXED);
}

// ── Component extraction ──────────────────────────────────────────────────────

test('pricing components extracted from the artifact', () => {
  const f = svc().forecastCost(null);
  assert.deepEqual(f.modeledComponents, ['cloudflare-workers', 'supabase-db', 'vercel-bandwidth', 'resend-email']);
});

test('absent artifact → empty components + not-connected artifact evidence', () => {
  const f = svc({}).forecastCost(null);
  assert.deepEqual(f.modeledComponents, []);
  assert.ok(f.evidence.some((e) => e.kind === 'not-connected' && (e.source ?? '').includes('cost-intelligence.json')));
});

test('malformed artifact (pricing not an array) → empty components, no throw', () => {
  const f = svc({ 'cost-intelligence': { pricing: 'oops' } }).forecastCost(null);
  assert.deepEqual(f.modeledComponents, []);
});

test('malformed pricing items (missing service) → empty components, no throw', () => {
  const f = svc({ 'cost-intelligence': { pricing: [{ price: 3 }] } }).forecastCost(null);
  assert.deepEqual(f.modeledComponents, []);
});

test('extra unknown fields on the artifact are tolerated (zod-loose)', () => {
  const f = svc({ 'cost-intelligence': { ...COST_INTEL, totallyUnknown: { nested: true } } }).forecastCost(null);
  assert.equal(f.modeledComponents.length, 4);
});

test('present-artifact evidence cites the pricing field and component count', () => {
  const f = svc().forecastCost(null);
  assert.ok(f.evidence.some((e) => e.ref === 'cost-intelligence.json:pricing' && (e.detail ?? '').includes('4 pricing components')));
});

// ── Forecast paths ────────────────────────────────────────────────────────────

test('series [100,110,120] horizon 2 → exact OLS [130,140], CONNECTED', () => {
  const f = svc().forecastCost([100, 110, 120], 2);
  assert.equal(f.connection, 'CONNECTED');
  assert.deepEqual(f.forecastValues, [130, 140]);
  assert.equal(f.liveConnected, true);
});

test('null series → NOT_CONNECTED, forecastValues null, liveConnected false', () => {
  const f = svc().forecastCost(null);
  assert.equal(f.connection, 'NOT_CONNECTED');
  assert.equal(f.forecastValues, null);
  assert.equal(f.liveConnected, false);
});

test('empty series → NOT_CONNECTED (never a forecast from nothing)', () => {
  const f = svc().forecastCost([], 6);
  assert.equal(f.connection, 'NOT_CONNECTED');
  assert.equal(f.forecastValues, null);
});

test('components still extracted on the NOT_CONNECTED path (structure vs values)', () => {
  const f = svc().forecastCost(null);
  assert.equal(f.modeledComponents.length, 4);
  assert.equal(f.forecastValues, null);
});

test('CONNECTED evidence cites caller-provided series + the delegation source', () => {
  const f = svc().forecastCost([1, 2], 1);
  assert.ok(f.evidence.some((e) => e.source === 'caller-provided'));
  assert.ok(f.evidence.some((e) => (e.source ?? '').includes('lcis-operations')));
});

test('input series is not mutated', () => {
  const series = [5, 3, 4];
  svc().forecastCost(series, 1);
  assert.deepEqual(series, [5, 3, 4]);
});

test('horizon preserved on both paths', () => {
  assert.equal(svc().forecastCost([1, 2], 4).horizon, 4);
  assert.equal(svc().forecastCost(null, 9).horizon, 9);
});

test('flat cost series projects flat', () => {
  const f = svc().forecastCost([50, 50, 50], 3);
  assert.deepEqual(f.forecastValues, [50, 50, 50]);
});

// ── Provenance + determinism ──────────────────────────────────────────────────

test('timestamp comes from the injected clock on both paths', () => {
  assert.equal(svc().forecastCost([1], 1).timestamp, FIXED);
  assert.equal(svc().forecastCost(null).timestamp, FIXED);
});

test('summary is honest about NOT_CONNECTED values', () => {
  const f = svc().forecastCost(null);
  assert.match(f.summary, /NOT_CONNECTED|no series/i);
});

test('deterministic: identical calls → identical JSON (both paths)', () => {
  const a = svc().forecastCost([1, 2, 3], 4);
  const b = svc().forecastCost([1, 2, 3], 4);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  const c = svc().forecastCost(null);
  const d = svc().forecastCost(null);
  assert.deepEqual(JSON.parse(JSON.stringify(c)), JSON.parse(JSON.stringify(d)));
});

test('constructor accepts defaultNow (no second arg)', () => {
  const core = createEngine({ store: stubStore({}), repoRoot: '/stub' });
  const s = new CostService(core);
  assert.equal(s.forecastCost(null).connection, 'NOT_CONNECTED');
});
