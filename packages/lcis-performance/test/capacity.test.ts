/**
 * CapacityService tests — the OLS delegation (CONNECTED) and the no-fabrication
 * NOT_CONNECTED path. Exact expected values from the lcis-operations linearTrend.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore, createEngine } from '@letbuyy/lcis-core';
import { CapacityService } from '../src/capacity/index';

const FIXED = '2026-07-04T00:00:00.000Z';

function svc() {
  const store = {
    has: () => false,
    tryRead: () => null,
    read: (n: string) => {
      throw new Error('missing ' + n);
    },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
  const core = createEngine({ store, repoRoot: '/stub' });
  return new CapacityService(core, () => FIXED);
}

// ── CONNECTED path (exact OLS values) ─────────────────────────────────────────

test('linear series [1,2,3] horizon 2 → exact OLS projection [4,5]', () => {
  const f = svc().forecastCapacity('queue-throughput', [1, 2, 3], 2);
  assert.equal(f.connection, 'CONNECTED');
  assert.deepEqual(f.forecastValues, [4, 5]);
  assert.equal(f.horizon, 2);
});

test('series [10,20,30] default horizon 6 → [40,50,60,70,80,90]', () => {
  const f = svc().forecastCapacity('requests', [10, 20, 30]);
  assert.deepEqual(f.forecastValues, [40, 50, 60, 70, 80, 90]);
});

test('flat series projects flat', () => {
  const f = svc().forecastCapacity('flat', [7, 7, 7, 7], 3);
  assert.deepEqual(f.forecastValues, [7, 7, 7]);
});

test('single-point series projects that constant', () => {
  const f = svc().forecastCapacity('single', [42], 2);
  assert.deepEqual(f.forecastValues, [42, 42]);
});

test('declining series projects the decline', () => {
  const f = svc().forecastCapacity('declining', [30, 20, 10], 1);
  assert.deepEqual(f.forecastValues, [0]);
});

test('CONNECTED forecast: liveConnected true, method names lcis-operations', () => {
  const f = svc().forecastCapacity('x', [1, 2], 1);
  assert.equal(f.liveConnected, true);
  assert.match(f.method, /lcis-operations/);
});

test('CONNECTED evidence cites the caller-provided series and the delegation source', () => {
  const f = svc().forecastCapacity('x', [1, 2, 3], 1);
  assert.ok(f.evidence.some((e) => e.source === 'caller-provided'));
  assert.ok(f.evidence.some((e) => (e.source ?? '').includes('lcis-operations')));
});

test('input series is not mutated', () => {
  const series = [3, 1, 2];
  svc().forecastCapacity('x', series, 1);
  assert.deepEqual(series, [3, 1, 2]);
});

test('subject is preserved verbatim', () => {
  assert.equal(svc().forecastCapacity('cloudflare-workers-requests', [1], 1).subject, 'cloudflare-workers-requests');
});

test('summary reports the input length and slope', () => {
  const f = svc().forecastCapacity('x', [2, 4, 6], 1);
  assert.match(f.summary, /3 caller-provided observations/);
  assert.match(f.summary, /Slope 2\.0000/);
});

// ── NOT_CONNECTED path (no fabrication) ───────────────────────────────────────

test('null series → NOT_CONNECTED, forecastValues null', () => {
  const f = svc().forecastCapacity('unmeasured', null, 6);
  assert.equal(f.connection, 'NOT_CONNECTED');
  assert.equal(f.forecastValues, null);
  assert.equal(f.liveConnected, false);
});

test('empty series → NOT_CONNECTED (never a forecast from nothing)', () => {
  const f = svc().forecastCapacity('empty', [], 6);
  assert.equal(f.connection, 'NOT_CONNECTED');
  assert.equal(f.forecastValues, null);
});

test('NOT_CONNECTED evidence names the exact missing live source', () => {
  const f = svc().forecastCapacity('unmeasured', null);
  assert.ok(f.evidence.some((e) => e.kind === 'not-connected' && (e.source ?? '').includes('telemetry adapters')));
});

test('NOT_CONNECTED summary states nothing is fabricated', () => {
  assert.match(svc().forecastCapacity('unmeasured', null).summary, /No values are fabricated/);
});

test('NOT_CONNECTED confidence is 0 (all evidence not-connected)', () => {
  assert.equal(svc().forecastCapacity('unmeasured', null).confidence, 0);
});

// ── Provenance + determinism ──────────────────────────────────────────────────

test('timestamp comes from the injected clock', () => {
  assert.equal(svc().forecastCapacity('x', [1], 1).timestamp, FIXED);
  assert.equal(svc().forecastCapacity('x', null).timestamp, FIXED);
});

test('deterministic: identical calls → identical JSON (both paths)', () => {
  const a = svc().forecastCapacity('x', [1, 2, 3], 4);
  const b = svc().forecastCapacity('x', [1, 2, 3], 4);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  const c = svc().forecastCapacity('x', null);
  const d = svc().forecastCapacity('x', null);
  assert.deepEqual(JSON.parse(JSON.stringify(c)), JSON.parse(JSON.stringify(d)));
});

test('horizon 0 with a series → empty forecastValues (CONNECTED, no invented points)', () => {
  const f = svc().forecastCapacity('x', [1, 2], 0);
  assert.equal(f.connection, 'CONNECTED');
  assert.deepEqual(f.forecastValues, []);
});

test('constructor accepts defaultNow (no second arg)', () => {
  const store = { has: () => false, tryRead: () => null, read: () => { throw new Error('x'); }, pathOf: () => '' } as unknown as ArtifactStore;
  const core = createEngine({ store, repoRoot: '/stub' });
  const s = new CapacityService(core);
  assert.equal(s.forecastCapacity('x', [1], 1).connection, 'CONNECTED');
});

test('negative values are projected faithfully (no clamping fabrication)', () => {
  const f = svc().forecastCapacity('x', [-1, -2, -3], 2);
  assert.deepEqual(f.forecastValues, [-4, -5]);
});
