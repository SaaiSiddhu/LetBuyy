/**
 * LCOS foundation tests — the OperationsArtifactStore + builders + registry run against the
 * REAL graphify-out artifacts (no fixtures). Verifies the read-only operational readers, the
 * honesty contract (NOT_CONNECTED → confidence 0), and the evidence/confidence/sources/
 * timestamp/liveConnected envelope.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine, evidence } from '@letbuyy/lcis-core';
import {
  LiveSignalRegistry,
  OperationalConfidenceCalculator,
  OperationalEvidenceBuilder,
  OperationalFindingBuilder,
  OperationalHealthCalculator,
  OperationalSeverityScorer,
  OperationsArtifactStore,
  SignalCorrelator,
  TelemetryNormalizer,
  operations,
  type LiveSignal,
} from '../src/index';

const FIXED = '2026-06-20T00:00:00.000Z';
const engine = createEngine();
const store = new OperationsArtifactStore(engine);

// ── artifact store reads real operational data ────────────────────────────────
test('OperationsArtifactStore reads the real runtime topology', () => {
  assert.ok(store.workers().length >= 1, 'workers present');
  assert.ok(store.queueGraph().length >= 1, 'queue graph present');
  assert.ok(store.opsCenterStatuses().length >= 1, 'ops-center statuses present');
  assert.ok(store.telemetryAdapters().length >= 1, 'telemetry adapters present');
});
test('OperationsArtifactStore raw accessors reach the intelligence artifacts', () => {
  // At least the well-known ones should be present in this repo's graphify-out.
  assert.ok(store.deploymentState() !== null, 'deployment-state present');
  assert.ok(store.has('security-intelligence-v5'), 'security intel present');
});

// ── live signal registry (the detectability matrix at runtime) ────────────────
test('LiveSignalRegistry encodes signals with exact env vars; honest counts', () => {
  const reg = new LiveSignalRegistry();
  assert.ok(reg.list().length >= 20, 'a rich signal set');
  assert.ok(reg.byArea('runtime').length >= 3);
  const counts = reg.counts();
  assert.ok(counts.CONNECTED >= 1 && counts.NOT_CONNECTED >= 1, 'both connected + not-connected exist');
  // every NOT_CONNECTED signal names the env var(s) it needs
  for (const s of reg.list()) {
    if (s.detectability === 'NOT_CONNECTED') assert.ok(s.requiresEnvVar.length >= 1, `${s.key} names env vars`);
  }
});

// ── builders ──────────────────────────────────────────────────────────────────
test('OperationalSeverityScorer: money/spof → critical, tenant/dead-letter → high', () => {
  const s = new OperationalSeverityScorer();
  assert.equal(s.forSignal({ money: true }), 'critical');
  assert.equal(s.forSignal({ spof: true }), 'critical');
  assert.equal(s.forSignal({ tenant: true }), 'high');
  assert.equal(s.forSignal({ deadLetter: true }), 'high');
  assert.equal(s.forSignal({ base: 'low' }), 'low');
});
test('OperationalConfidenceCalculator: NOT_CONNECTED → 0, structural capped at 0.9', () => {
  const c = new OperationalConfidenceCalculator();
  assert.equal(c.notConnected(), 0);
  assert.equal(c.forStatus('NOT_CONNECTED', [evidence('table', 't')]), 0);
  assert.ok(c.forStatus('CONNECTED', Array(50).fill(evidence('table', 't'))) <= 0.9);
  assert.equal(c.fromEvidence([]), 0);
});
test('OperationalFindingBuilder: deterministic id; confidence 0 for NOT_CONNECTED', () => {
  const fb = new OperationalFindingBuilder();
  const f = fb.build({
    area: 'runtime', kind: 'queue-backlog', severity: 'high', subject: 'orders-queue',
    title: 'backlog', detail: 'depth unknown', status: 'NOT_CONNECTED',
    evidence: [new OperationalEvidenceBuilder().notConnected('orders-queue', 'CF_ACCOUNT_ID')],
  });
  assert.equal(f.id, 'QUEUE-BACKLOG-orders-queue');
  assert.equal(f.confidence, 0);
});
test('OperationalEvidenceBuilder.notConnected cites the env var', () => {
  const e = new OperationalEvidenceBuilder().notConnected('gmv', 'SUPABASE_URL');
  assert.equal(e.kind, 'not-connected');
  assert.ok((e.detail ?? '').includes('SUPABASE_URL'));
});

// ── health ────────────────────────────────────────────────────────────────────
test('OperationalHealthCalculator: blind area → null/unknown; structural findings → score', () => {
  const h = new OperationalHealthCalculator();
  const blind = h.forArea('runtime', [], []);
  assert.equal(blind.score, null);
  assert.equal(blind.band, 'unknown');
  const fb = new OperationalFindingBuilder();
  const withFinding = h.forArea('runtime', [
    fb.build({ area: 'runtime', kind: 'spof', severity: 'critical', subject: 'queue-workers', title: 'SPOF', detail: 'x', status: 'CONNECTED', evidence: [evidence('worker', 'queue-workers')] }),
  ], []);
  assert.ok(typeof withFinding.score === 'number' && withFinding.score < 100);
});

// ── normalizer + correlator (reuse) ──────────────────────────────────────────
test('TelemetryNormalizer.signalToLive carries NOT_CONNECTED + env vars (never a value)', () => {
  const reg = new LiveSignalRegistry();
  const gmv = reg.get('commerce.gmv')!;
  const live: LiveSignal = new TelemetryNormalizer().signalToLive(gmv, []);
  assert.equal(live.value, null);
  assert.equal(live.status, 'NOT_CONNECTED');
  assert.ok(live.requiresEnvVar.includes('SUPABASE_URL'));
});
test('SignalCorrelator delegates to lcis-core blast for a real domain', () => {
  const di = engine.store.read<{ domains: { key: string }[] }>('domain-intel');
  const key = di.domains[0]!.key;
  const c = new SignalCorrelator(engine).correlateDomain(key);
  assert.ok(c === null || (c.subject === key && Array.isArray(c.affected)));
});

// ── envelope ──────────────────────────────────────────────────────────────────
test('operations() stamps evidence/confidence/sources/timestamp/liveConnected', () => {
  const out = operations({ ok: true }, { evidence: [evidence('worker', 'w', 'd', 'graphify-out/runtime-intel.json')], now: () => FIXED });
  assert.equal(out.timestamp, FIXED);
  assert.equal(out.liveConnected, false); // honest: no live values in this env
  assert.ok(out.confidence > 0 && out.confidence <= 0.9);
  assert.deepEqual(out.sources, ['graphify-out/runtime-intel.json']);
});
