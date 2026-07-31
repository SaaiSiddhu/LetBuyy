/**
 * ExecutionOrchestrationEngine (EAOS facade) tests — Phase 8.
 *
 * Verifies:
 * - create/get/reset lifecycle and singleton identity
 * - resolvePackage: request → EINS build; pre-built package → identity pass-through
 * - All eight generate* methods return correctly-shaped, provenance-stamped reports
 * - generateFullExecutionPackage composes all seven sections over ONE package build
 * - mergeHealth: averaging, signal summing, band boundaries, honest null
 * - Determinism under a fixed clock; liveConnected:false everywhere (honesty)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import {
  ExecutionOrchestrationEngine,
  buildEngineeringPackage,
  createOrchestrationEngine,
  getOrchestrationEngine,
  mergeHealth,
  resetOrchestrationEngine,
  type ExecutionHealth,
} from '../src/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();

function eaos() {
  return createOrchestrationEngine({ core: engine, now: () => FIXED });
}

const REQ = { text: 'Build GST Filing' };

let _pkg: Awaited<ReturnType<typeof buildEngineeringPackage>> | null = null;
async function sharedPkg() {
  if (!_pkg) _pkg = await buildEngineeringPackage(engine, REQ, () => FIXED);
  return _pkg;
}

function health(area: ExecutionHealth['area'], score: number | null, c = 1, nc = 1): ExecutionHealth {
  const band = score === null ? 'unknown' : score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'failing';
  return { area, score, band, connectedSignals: c, notConnectedSignals: nc };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

test('createOrchestrationEngine returns an ExecutionOrchestrationEngine', () => {
  assert.ok(eaos() instanceof ExecutionOrchestrationEngine);
});

test('engine exposes all seven services + core', () => {
  const e = eaos();
  assert.ok(e.core);
  for (const svc of ['execution', 'agent', 'artifact', 'validation', 'status', 'rollout', 'timeline'] as const) {
    assert.ok(e[svc], `service ${svc} missing`);
  }
});

test('getOrchestrationEngine returns a process-wide singleton', () => {
  resetOrchestrationEngine();
  const a = getOrchestrationEngine({ core: engine, now: () => FIXED });
  const b = getOrchestrationEngine();
  assert.equal(a, b);
});

test('resetOrchestrationEngine clears the singleton', () => {
  resetOrchestrationEngine();
  const a = getOrchestrationEngine({ core: engine, now: () => FIXED });
  resetOrchestrationEngine();
  const b = getOrchestrationEngine({ core: engine, now: () => FIXED });
  assert.notEqual(a, b);
});

test('engine constructs with zero options (defaults core + clock)', () => {
  const e = new ExecutionOrchestrationEngine();
  assert.ok(e instanceof ExecutionOrchestrationEngine);
});

// ── resolvePackage ────────────────────────────────────────────────────────────

test('resolvePackage builds an EngineeringPackage from a FeatureRequest', async () => {
  const pkg = await eaos().resolvePackage(REQ);
  assert.ok(pkg.blueprint);
  assert.ok(Array.isArray(pkg.tasks));
  assert.ok(pkg.graph);
  assert.ok(pkg.agentPlan);
  assert.ok(pkg.decision);
});

test('resolvePackage passes a pre-built EngineeringPackage through by identity', async () => {
  const pkg = await sharedPkg();
  const resolved = await eaos().resolvePackage(pkg);
  assert.equal(resolved, pkg);
});

// ── Per-service report methods ────────────────────────────────────────────────

test('generateExecutionReport returns an ExecutionReport with graph + health', async () => {
  const r = await eaos().generateExecutionReport(await sharedPkg());
  assert.equal(r.request.text, REQ.text);
  assert.ok(r.graph.nodes.length > 0);
  assert.equal(r.health.area, 'execution');
  assert.equal(r.liveConnected, false);
});

test('generateAgentReport returns an AgentReport with assignments', async () => {
  const r = await eaos().generateAgentReport(await sharedPkg());
  assert.ok(Array.isArray(r.agents));
  assert.equal(r.health.area, 'agent');
  assert.equal(r.liveConnected, false);
});

test('generateArtifactReport returns an ArtifactReport with planned artifacts + coverage', async () => {
  const r = await eaos().generateArtifactReport(await sharedPkg());
  assert.ok(Array.isArray(r.artifacts));
  assert.equal(r.coverage.connection, 'NOT_CONNECTED');
  assert.equal(r.liveConnected, false);
});

test('generateValidationReport returns a ValidationReport', async () => {
  const r = await eaos().generateValidationReport(await sharedPkg());
  assert.ok(Array.isArray(r.validations));
  assert.equal(r.health.area, 'validation');
  assert.equal(r.liveConnected, false);
});

test('generateStatusReport returns a StatusReport with honest NOT_CONNECTED ETA', async () => {
  const r = await eaos().generateStatusReport(await sharedPkg());
  assert.ok(Array.isArray(r.metrics));
  assert.equal(r.eta.connection, 'NOT_CONNECTED');
  assert.equal(r.eta.value, null);
  assert.equal(r.liveConnected, false);
});

test('generateRolloutReport returns a RolloutReport with launch + rollback verdicts', async () => {
  const r = await eaos().generateRolloutReport(await sharedPkg());
  assert.ok(['GO', 'CONDITIONAL_GO', 'NO_GO'].includes(r.launchVerdict));
  assert.ok(['READY', 'CONDITIONAL', 'NOT_READY'].includes(r.rollbackReadiness));
  assert.equal(r.liveConnected, false);
});

test('generateTimelineReport returns a TimelineReport with milestones', async () => {
  const r = await eaos().generateTimelineReport(await sharedPkg());
  assert.ok(Array.isArray(r.milestones));
  assert.ok(Array.isArray(r.stateTransitions));
  assert.equal(r.liveConnected, false);
});

test('report methods also accept a raw FeatureRequest', async () => {
  const r = await eaos().generateExecutionReport(REQ);
  assert.equal(r.request.text, REQ.text);
});

// ── generateFullExecutionPackage ──────────────────────────────────────────────

test('generateFullExecutionPackage composes all seven sections', async () => {
  const p = await eaos().generateFullExecutionPackage(await sharedPkg());
  for (const key of ['execution', 'agent', 'artifact', 'validation', 'status', 'rollout', 'timeline'] as const) {
    assert.ok(p[key], `section ${key} missing`);
  }
  assert.equal(p.request.text, REQ.text);
});

test('full package sections agree on the request (single package build)', async () => {
  const p = await eaos().generateFullExecutionPackage(await sharedPkg());
  assert.equal(p.execution.request.text, p.agent.request.text);
  assert.equal(p.rollout.request.text, p.timeline.request.text);
  assert.equal(p.status.request.text, REQ.text);
});

test('full package health has area overall and a valid band', async () => {
  const p = await eaos().generateFullExecutionPackage(await sharedPkg());
  assert.equal(p.health.area, 'overall');
  assert.ok(['healthy', 'degraded', 'failing', 'unknown'].includes(p.health.band));
});

test('full package carries provenance: evidence, sources, timestamp, confidence 0..1', async () => {
  const p = await eaos().generateFullExecutionPackage(await sharedPkg());
  assert.ok(p.evidence.length >= 3);
  assert.ok(p.sources.length > 0);
  assert.equal(p.timestamp, FIXED);
  assert.ok(p.confidence >= 0 && p.confidence <= 1);
});

test('full package is honest: liveConnected false, summary names NOT_CONNECTED', async () => {
  const p = await eaos().generateFullExecutionPackage(await sharedPkg());
  assert.equal(p.liveConnected, false);
  assert.match(p.summary, /NOT_CONNECTED/);
});

test('full package summary states EAOS tracks and humans/agents execute', async () => {
  const p = await eaos().generateFullExecutionPackage(await sharedPkg());
  assert.match(p.summary, /EAOS tracks; humans\/agents execute/);
});

test('generateFullExecutionPackage is deterministic under a fixed clock', async () => {
  const pkg = await sharedPkg();
  const a = await eaos().generateFullExecutionPackage(pkg);
  const b = await eaos().generateFullExecutionPackage(pkg);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('generateFullExecutionPackage accepts a raw FeatureRequest end-to-end', async () => {
  const p = await eaos().generateFullExecutionPackage(REQ);
  assert.equal(p.request.text, REQ.text);
  assert.ok(p.execution.graph.nodes.length > 0);
});

// ── Composition helpers (blockers / health) ──────────────────────────────────

test('generateBlockersReport composes blocked tasks + launch blockers + reasons', async () => {
  const r = await eaos().generateBlockersReport(await sharedPkg());
  assert.ok(Array.isArray(r.blockedTasks));
  assert.ok(Array.isArray(r.launchBlockers));
  assert.ok(Array.isArray(r.reasons));
  assert.equal(r.liveConnected, false);
  assert.match(r.summary, /NOT_CONNECTED/);
});

test('generateBlockersReport blocked tasks all carry rule EO02', async () => {
  const r = await eaos().generateBlockersReport(await sharedPkg());
  for (const f of r.blockedTasks) assert.equal(f.rule, 'EO02');
});

test('generateHealthReport returns four areas + merged overall', async () => {
  const r = await eaos().generateHealthReport(await sharedPkg());
  assert.equal(r.areas.length, 4);
  assert.deepEqual(
    r.areas.map((a) => a.area),
    ['execution', 'agent', 'validation', 'rollout'],
  );
  assert.equal(r.overall.area, 'overall');
  assert.equal(r.liveConnected, false);
});

test('generateHealthReport overall equals mergeHealth of its areas', async () => {
  const r = await eaos().generateHealthReport(await sharedPkg());
  assert.deepEqual(r.overall, mergeHealth([...r.areas]));
});

// ── mergeHealth ───────────────────────────────────────────────────────────────

test('mergeHealth averages non-null scores and sums signals', () => {
  const m = mergeHealth([health('execution', 100, 2, 3), health('agent', 50, 1, 1)]);
  assert.equal(m.area, 'overall');
  assert.equal(m.score, 75);
  assert.equal(m.connectedSignals, 3);
  assert.equal(m.notConnectedSignals, 4);
});

test('mergeHealth ignores null scores when averaging', () => {
  const m = mergeHealth([health('execution', 90), health('agent', null)]);
  assert.equal(m.score, 90);
  assert.equal(m.band, 'healthy');
});

test('mergeHealth returns honest null + unknown when every area is null', () => {
  const m = mergeHealth([health('execution', null), health('agent', null)]);
  assert.equal(m.score, null);
  assert.equal(m.band, 'unknown');
});

test('mergeHealth band boundaries: 80 healthy, 50 degraded, 49 failing', () => {
  assert.equal(mergeHealth([health('execution', 80)]).band, 'healthy');
  assert.equal(mergeHealth([health('execution', 50)]).band, 'degraded');
  assert.equal(mergeHealth([health('execution', 49)]).band, 'failing');
});

test('mergeHealth of an empty list is null/unknown with zero signals', () => {
  const m = mergeHealth([]);
  assert.equal(m.score, null);
  assert.equal(m.band, 'unknown');
  assert.equal(m.connectedSignals, 0);
  assert.equal(m.notConnectedSignals, 0);
});
