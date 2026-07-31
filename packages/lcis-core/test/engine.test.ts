/**
 * Engine facade + observability tests — the Phase-2 access-layer foundation.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine, getEngine, resetEngine } from '../src/engine';
import { Timer, confidenceFor, envelope, newRequestId } from '../src/observability';

test('createEngine wires all five services + graph over one store', () => {
  const e = createEngine();
  assert.ok(e.store && e.graph && e.blast && e.memory && e.decision && e.architecture && e.verification);
});

test('getEngine returns a singleton (graph loaded once)', () => {
  resetEngine();
  const a = getEngine();
  const b = getEngine();
  assert.equal(a, b, 'same instance');
  // a blast through the singleton works and the store records a cache hit on re-read
  const r = a.blast.blast('getSupabaseAdmin');
  assert.ok(r, 'blast via engine works');
  a.store.read('graph'); // graph already resident → hit
  assert.ok(a.store.cacheStats().hits >= 1, 'cache hit recorded');
  resetEngine();
});

test('confidenceFor is deterministic and honest', () => {
  assert.equal(confidenceFor(null), 0);
  assert.equal(confidenceFor({ error: 'nope' }), 0);
  assert.equal(confidenceFor({ confidence: 0.42 }), 0.42);
  assert.equal(confidenceFor({ data: 1 }), 0.9);
});

test('envelope carries the full response contract', () => {
  const env = envelope({ data: { x: 1 }, source: 'blast-radius', executionTime: 12.5, evidence: ['graph.json'] });
  assert.equal(env.success, true);
  assert.equal(env.source, 'blast-radius');
  assert.equal(env.confidence, 0.9);
  assert.equal(env.executionTime, 12.5);
  assert.equal(env.version, '0.0.0');
  assert.match(env.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(env.evidence, ['graph.json']);
});

test('envelope reports failure for error/empty results', () => {
  assert.equal(envelope({ data: { error: 'x' }, source: 'memory', executionTime: 1 }).success, false);
  assert.equal(envelope({ data: null, source: 'memory', executionTime: 1 }).success, false);
});

test('Timer + newRequestId produce sane values', () => {
  const t = new Timer();
  assert.ok(t.ms() >= 0);
  const id = newRequestId();
  assert.match(id, /^[0-9a-f-]{36}$/);
});
