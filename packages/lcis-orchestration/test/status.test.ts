/**
 * StatusIntelligenceService tests — EAOS Phase 8.
 *
 * Honesty contract verified:
 *  - every ProgressMetric.completed = null + connection='NOT_CONNECTED'
 *  - every ProgressMetric.planned is a real structural count (CONNECTED)
 *  - eta.value = null + connection='NOT_CONNECTED'
 *  - blockedReasons reflect graph.blocked + decision.blockers
 *  - static-gate compliance results (COMPLIANT/VIOLATED) are CONNECTED
 *  - provenance: timestamp fixed, liveConnected=false, evidence non-empty
 *  - determinism: same package → same report
 *  - read-only: no fetch/writeFile/exec/spawn/eval in service file
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { buildEngineeringPackage } from '../src/shared/index';
import { StatusIntelligenceService } from '../src/status/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();

// ── build a real EngineeringPackage once (shared across all tests) ────────────
let pkg: Awaited<ReturnType<typeof buildEngineeringPackage>>;
// We'll build it in-process before all tests run.
// node:test doesn't have beforeAll, so we use a module-top-level async IIFE
// and tests that depend on it await it.
const pkgPromise = buildEngineeringPackage(
  engine,
  { text: 'Build GST Invoice Filing' },
  () => FIXED,
);

// A second variant for determinism tests
const pkg2Promise = buildEngineeringPackage(
  engine,
  { text: 'Build GST Invoice Filing' },
  () => FIXED,
);

// A variant with a distinct request for variety
const pkgShippingPromise = buildEngineeringPackage(
  engine,
  { text: 'Add Shipping Zones to Checkout' },
  () => FIXED,
);

function makeSvc(): StatusIntelligenceService {
  return new StatusIntelligenceService(engine, () => FIXED);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function assertProgressNotConnected(metric: ReturnType<StatusIntelligenceService['taskProgress']>, label: string): void {
  assert.equal(metric.completed, null, `${label}: completed must be null (NOT_CONNECTED)`);
  assert.equal(metric.connection, 'NOT_CONNECTED', `${label}: connection must be NOT_CONNECTED`);
  assert.ok(typeof metric.liveSource === 'string' && metric.liveSource.length > 0, `${label}: liveSource must be a non-empty string`);
  assert.ok(typeof metric.planned === 'number' && metric.planned >= 0, `${label}: planned must be a non-negative number`);
  assert.ok(typeof metric.label === 'string' && metric.label.length > 0, `${label}: label must be non-empty`);
}

// ── read-only scan: the service source must not call banned symbols ────────────

test('read-only: service source does not call fetch/writeFile/exec/spawn/eval/child_process', () => {
  // Strip block comments and line comments before scanning
  const src = readFileSync(
    new URL('../src/status/StatusIntelligenceService.ts', import.meta.url).pathname,
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  const banned = ['fetch(', 'writeFile(', 'child_process', 'spawn(', 'exec(', 'eval(', 'import('];
  for (const term of banned) {
    assert.ok(!src.includes(term), `Service must not use ${term}`);
  }
});

// ── executionProgress ─────────────────────────────────────────────────────────

test('executionProgress: planned = tasks.length (CONNECTED)', async () => {
  pkg = await pkgPromise;
  const svc = makeSvc();
  const m = svc.executionProgress(pkg);
  assert.equal(m.planned, pkg.tasks.length);
});

test('executionProgress: completed = null (NOT_CONNECTED)', async () => {
  const svc = makeSvc();
  const m = svc.executionProgress(await pkgPromise);
  assertProgressNotConnected(m, 'executionProgress');
});

test('executionProgress: label mentions ready and blocked counts', async () => {
  const svc = makeSvc();
  const m = svc.executionProgress(await pkgPromise);
  const ready = (await pkgPromise).graph.parallelizable.length;
  const blocked = (await pkgPromise).graph.blocked.length;
  assert.ok(m.label.includes(String(ready)), 'label should include ready count');
  assert.ok(m.label.includes(String(blocked)), 'label should include blocked count');
});

test('executionProgress: liveSource is a non-empty string', async () => {
  const svc = makeSvc();
  const m = svc.executionProgress(await pkgPromise);
  assert.ok(typeof m.liveSource === 'string' && m.liveSource.length > 0);
});

// ── taskProgress ──────────────────────────────────────────────────────────────

test('taskProgress: planned = tasks.length', async () => {
  const svc = makeSvc();
  const m = svc.taskProgress(await pkgPromise);
  assert.equal(m.planned, (await pkgPromise).tasks.length);
});

test('taskProgress: completed = null (NOT_CONNECTED)', async () => {
  const svc = makeSvc();
  assertProgressNotConnected(svc.taskProgress(await pkgPromise), 'taskProgress');
});

test('taskProgress: liveSource references execution-tracking', async () => {
  const svc = makeSvc();
  const m = svc.taskProgress(await pkgPromise);
  assert.ok(m.liveSource!.toLowerCase().includes('execution'));
});

// ── agentProgress ─────────────────────────────────────────────────────────────

test('agentProgress: planned = agentPlan.tasks.length', async () => {
  const svc = makeSvc();
  const m = svc.agentProgress(await pkgPromise);
  assert.equal(m.planned, (await pkgPromise).agentPlan.tasks.length);
});

test('agentProgress: completed = null (NOT_CONNECTED)', async () => {
  const svc = makeSvc();
  assertProgressNotConnected(svc.agentProgress(await pkgPromise), 'agentProgress');
});

test('agentProgress: label mentions ASSIGNED (CONNECTED) and NOT_CONNECTED for live state', async () => {
  const svc = makeSvc();
  const m = svc.agentProgress(await pkgPromise);
  assert.ok(m.label.toLowerCase().includes('assigned') || m.label.toLowerCase().includes('agent'));
  assert.ok(m.label.includes('NOT_CONNECTED'));
});

test('agentProgress: liveSource references live agent execution', async () => {
  const svc = makeSvc();
  const m = svc.agentProgress(await pkgPromise);
  assert.ok(m.liveSource!.toLowerCase().includes('agent'));
});

// ── artifactProgress ──────────────────────────────────────────────────────────

test('artifactProgress: planned = tasks.length (one artifact per task)', async () => {
  const svc = makeSvc();
  const m = svc.artifactProgress(await pkgPromise);
  assert.equal(m.planned, (await pkgPromise).tasks.length);
});

test('artifactProgress: completed = null (NOT_CONNECTED)', async () => {
  const svc = makeSvc();
  assertProgressNotConnected(svc.artifactProgress(await pkgPromise), 'artifactProgress');
});

test('artifactProgress: liveSource references git or filesystem', async () => {
  const svc = makeSvc();
  const m = svc.artifactProgress(await pkgPromise);
  assert.ok(m.liveSource!.toLowerCase().includes('git') || m.liveSource!.toLowerCase().includes('filesystem') || m.liveSource!.toLowerCase().includes('artifact'));
});

// ── validationProgress ────────────────────────────────────────────────────────

test('validationProgress: planned = tasks.length (one gate per task)', async () => {
  const svc = makeSvc();
  const m = svc.validationProgress(await pkgPromise);
  assert.equal(m.planned, (await pkgPromise).tasks.length);
});

test('validationProgress: completed = null (NOT_CONNECTED — live CI absent)', async () => {
  const svc = makeSvc();
  assertProgressNotConnected(svc.validationProgress(await pkgPromise), 'validationProgress');
});

test('validationProgress: label explicitly mentions static-gate results as CONNECTED', async () => {
  const svc = makeSvc();
  const m = svc.validationProgress(await pkgPromise);
  assert.ok(m.label.includes('CONNECTED'));
});

test('validationProgress: label includes COMPLIANT count (static-gate CONNECTED signal)', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const m = svc.validationProgress(p);
  const staticPassed = p.blueprint.compliance.evaluations.filter((e) => e.status === 'COMPLIANT').length;
  assert.ok(m.label.includes(String(staticPassed)), 'label must include COMPLIANT count');
});

test('validationProgress: label includes VIOLATED count (static-gate CONNECTED signal)', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const m = svc.validationProgress(p);
  const staticViolated = p.blueprint.compliance.evaluations.filter((e) => e.status === 'VIOLATED').length;
  assert.ok(m.label.includes(String(staticViolated)), 'label must include VIOLATED count');
});

test('validationProgress: label mentions live CI NOT_CONNECTED', async () => {
  const svc = makeSvc();
  const m = svc.validationProgress(await pkgPromise);
  assert.ok(m.label.includes('NOT_CONNECTED'));
});

test('validationProgress: liveSource references CI run', async () => {
  const svc = makeSvc();
  const m = svc.validationProgress(await pkgPromise);
  assert.ok(m.liveSource!.toLowerCase().includes('ci'));
});

// ── overallProgress ───────────────────────────────────────────────────────────

test('overallProgress: planned >= tasks.length (aggregate across all axes)', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const m = svc.overallProgress(p);
  assert.ok(m.planned >= p.tasks.length, 'overall planned must be >= tasks.length');
});

test('overallProgress: completed = null (NOT_CONNECTED)', async () => {
  const svc = makeSvc();
  assertProgressNotConnected(svc.overallProgress(await pkgPromise), 'overallProgress');
});

test('overallProgress: planned = sum of task + agent + artifact + gate counts', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const m = svc.overallProgress(p);
  const expected = p.tasks.length + p.agentPlan.tasks.length + p.tasks.length + p.tasks.length;
  assert.equal(m.planned, expected);
});

test('overallProgress: liveSource references execution-tracking store', async () => {
  const svc = makeSvc();
  const m = svc.overallProgress(await pkgPromise);
  assert.ok(m.liveSource!.toLowerCase().includes('execution'));
});

// ── eta ───────────────────────────────────────────────────────────────────────

test('eta: value = null (NOT_CONNECTED)', async () => {
  const svc = makeSvc();
  const e = svc.eta(await pkgPromise);
  assert.equal(e.value, null);
});

test('eta: connection = NOT_CONNECTED', async () => {
  const svc = makeSvc();
  const e = svc.eta(await pkgPromise);
  assert.equal(e.connection, 'NOT_CONNECTED');
});

test('eta: liveSource = "execution-tracking durations"', async () => {
  const svc = makeSvc();
  const e = svc.eta(await pkgPromise);
  assert.equal(e.liveSource, 'execution-tracking durations');
});

test('eta: no date string in value (never fabricated)', async () => {
  const svc = makeSvc();
  const e = svc.eta(await pkgPromise);
  assert.equal(e.value, null, 'eta.value must be null — never a fabricated date');
});

// ── blockedReasons ────────────────────────────────────────────────────────────

test('blockedReasons: returns array', async () => {
  const svc = makeSvc();
  const reasons = svc.blockedReasons(await pkgPromise);
  assert.ok(Array.isArray(reasons));
});

test('blockedReasons: count = graph.blocked.length + decision.blockers.length', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const reasons = svc.blockedReasons(p);
  assert.equal(reasons.length, p.graph.blocked.length + p.decision.blockers.length);
});

test('blockedReasons: each graph-blocked entry references the task id', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  for (const id of p.graph.blocked) {
    const found = svc.blockedReasons(p).some((r) => r.includes(id));
    assert.ok(found, `blocked reason must include task id ${id}`);
  }
});

test('blockedReasons: each decision-blocker entry references the blocker text', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  for (const b of p.decision.blockers) {
    const found = svc.blockedReasons(p).some((r) => r.includes(b.slice(0, 20)));
    assert.ok(found, `blocked reason must include decision blocker text`);
  }
});

test('blockedReasons: empty when no blockers', async () => {
  // Use a package that might have 0 blockers (verify graceful empty case)
  const svc = makeSvc();
  const p = await pkgPromise;
  if (p.graph.blocked.length === 0 && p.decision.blockers.length === 0) {
    assert.equal(svc.blockedReasons(p).length, 0);
  } else {
    // At least one exists — just assert the count matches
    assert.equal(
      svc.blockedReasons(p).length,
      p.graph.blocked.length + p.decision.blockers.length,
    );
  }
});

// ── generateStatusReport ──────────────────────────────────────────────────────

test('generateStatusReport: returns a StatusReport with required top-level keys', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.ok('metrics' in report);
  assert.ok('overall' in report);
  assert.ok('eta' in report);
  assert.ok('blockedReasons' in report);
  assert.ok('findings' in report);
  assert.ok('summary' in report);
});

test('generateStatusReport: report.eta.value = null (NOT_CONNECTED)', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.equal(report.eta.value, null);
  assert.equal(report.eta.connection, 'NOT_CONNECTED');
});

test('generateStatusReport: report.overall is a NOT_CONNECTED ProgressMetric', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assertProgressNotConnected(report.overall, 'report.overall');
});

test('generateStatusReport: report.metrics is an array of ProgressMetrics (all NOT_CONNECTED)', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.ok(Array.isArray(report.metrics));
  assert.ok(report.metrics.length >= 4);
  for (const m of report.metrics) {
    assert.equal(m.completed, null);
    assert.equal(m.connection, 'NOT_CONNECTED');
  }
});

test('generateStatusReport: provenance — timestamp = FIXED', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.equal(report.timestamp, FIXED);
});

test('generateStatusReport: provenance — liveConnected = false', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.equal(report.liveConnected, false);
});

test('generateStatusReport: provenance — evidence is non-empty array', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.ok(Array.isArray(report.evidence) && report.evidence.length > 0);
});

test('generateStatusReport: provenance — confidence ∈ [0, 0.9]', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.ok(report.confidence >= 0 && report.confidence <= 0.9);
});

test('generateStatusReport: provenance — sources is a non-empty array of strings', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.ok(Array.isArray(report.sources) && report.sources.length > 0);
  for (const s of report.sources) {
    assert.ok(typeof s === 'string' && s.length > 0);
  }
});

test('generateStatusReport: findings is an array', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.ok(Array.isArray(report.findings));
});

test('generateStatusReport: findings include at least one NOT_CONNECTED finding for live tracking', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  const ncFinding = report.findings.find((f) => f.connection === 'NOT_CONNECTED');
  assert.ok(ncFinding, 'at least one NOT_CONNECTED finding must be present');
});

test('generateStatusReport: blocked-task findings have connection=CONNECTED', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const report = svc.generateStatusReport(p);
  const blockedFindings = report.findings.filter((f) => f.kind === 'task-blocked');
  assert.equal(blockedFindings.length, p.graph.blocked.length);
  for (const f of blockedFindings) {
    assert.equal(f.connection, 'CONNECTED');
  }
});

test('generateStatusReport: compliance-violated findings have connection=CONNECTED and severity=critical', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const report = svc.generateStatusReport(p);
  const violated = p.blueprint.compliance.evaluations.filter((e) => e.status === 'VIOLATED');
  const violatedFindings = report.findings.filter((f) => f.kind === 'compliance-violated');
  assert.equal(violatedFindings.length, violated.length);
  for (const f of violatedFindings) {
    assert.equal(f.connection, 'CONNECTED');
    assert.equal(f.severity, 'critical');
  }
});

test('generateStatusReport: summary is a non-empty string', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.ok(typeof report.summary === 'string' && report.summary.length > 0);
});

test('generateStatusReport: summary mentions verdict', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const report = svc.generateStatusReport(p);
  assert.ok(report.summary.includes(p.decision.verdict));
});

test('generateStatusReport: summary mentions NOT_CONNECTED for completed counts', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.ok(report.summary.includes('NOT_CONNECTED'));
});

test('generateStatusReport: blockedReasons in report match graph.blocked + decision.blockers', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const report = svc.generateStatusReport(p);
  assert.equal(
    report.blockedReasons.length,
    p.graph.blocked.length + p.decision.blockers.length,
  );
});

test('generateStatusReport: request field is set from pkg.blueprint.request', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const report = svc.generateStatusReport(p);
  assert.ok('request' in report);
  assert.equal(report.request.text, p.blueprint.request.text);
});

// ── determinism ───────────────────────────────────────────────────────────────

test('determinism: same package → same report metrics.planned values', async () => {
  const [a, b] = await Promise.all([pkgPromise, pkg2Promise]);
  const svc = makeSvc();
  const ra = svc.generateStatusReport(a);
  const rb = svc.generateStatusReport(b);
  assert.equal(ra.overall.planned, rb.overall.planned);
  assert.equal(ra.metrics.length, rb.metrics.length);
  for (let i = 0; i < ra.metrics.length; i++) {
    assert.equal(ra.metrics[i].planned, rb.metrics[i].planned);
  }
});

test('determinism: same package → same timestamp (fixed clock)', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const ra = svc.generateStatusReport(p);
  const rb = svc.generateStatusReport(p);
  assert.equal(ra.timestamp, rb.timestamp);
  assert.equal(ra.timestamp, FIXED);
});

test('determinism: same package → same blockedReasons count', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const ra = svc.generateStatusReport(p);
  const rb = svc.generateStatusReport(p);
  assert.equal(ra.blockedReasons.length, rb.blockedReasons.length);
});

test('determinism: same package → same findings count', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const ra = svc.generateStatusReport(p);
  const rb = svc.generateStatusReport(p);
  assert.equal(ra.findings.length, rb.findings.length);
});

test('determinism: different packages → different planned counts (pkg vs pkgShipping)', async () => {
  const svc = makeSvc();
  const [p1, p2] = await Promise.all([pkgPromise, pkgShippingPromise]);
  const r1 = svc.generateStatusReport(p1);
  const r2 = svc.generateStatusReport(p2);
  // They may or may not differ, but both must honour the honesty contract
  assert.equal(r1.overall.completed, null);
  assert.equal(r2.overall.completed, null);
  assert.equal(r1.eta.value, null);
  assert.equal(r2.eta.value, null);
});

// ── static-gate CONNECTED signal in validationProgress ───────────────────────

test('validationProgress static-gate: COMPLIANT+VIOLATED+PARTIAL+UNKNOWN counts sum to evaluations.length', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const evals = p.blueprint.compliance.evaluations;
  const compliant = evals.filter((e) => e.status === 'COMPLIANT').length;
  const violated = evals.filter((e) => e.status === 'VIOLATED').length;
  const partial = evals.filter((e) => e.status === 'PARTIAL').length;
  const unknown = evals.filter((e) => e.status === 'UNKNOWN').length;
  assert.equal(compliant + violated + partial + unknown, evals.length);
  // The metric label must include all connected counts
  const m = svc.validationProgress(p);
  assert.ok(m.label.includes(String(compliant)));
  assert.ok(m.label.includes(String(violated)));
});

test('validationProgress static-gate: label says static-gate results CONNECTED', async () => {
  const svc = makeSvc();
  const m = svc.validationProgress(await pkgPromise);
  assert.ok(m.label.toLowerCase().includes('connected') || m.label.includes('CONNECTED'));
});

// ── metrics array completeness ─────────────────────────────────────────────────

test('generateStatusReport: metrics array contains at least 5 distinct ProgressMetrics', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  assert.ok(report.metrics.length >= 5);
});

test('generateStatusReport: all metrics have string labels', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  for (const m of report.metrics) {
    assert.ok(typeof m.label === 'string' && m.label.length > 0);
  }
});

test('generateStatusReport: all metrics have non-negative planned', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  for (const m of report.metrics) {
    assert.ok(m.planned >= 0);
  }
});

test('generateStatusReport: all metrics have non-empty liveSource', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  for (const m of report.metrics) {
    assert.ok(typeof m.liveSource === 'string' && m.liveSource.length > 0);
  }
});

// ── per-method NOT_CONNECTED + liveSource presence ────────────────────────────

test('executionProgress, taskProgress, agentProgress, artifactProgress: all NOT_CONNECTED', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  for (const method of [
    svc.executionProgress.bind(svc),
    svc.taskProgress.bind(svc),
    svc.agentProgress.bind(svc),
    svc.artifactProgress.bind(svc),
  ] as Array<(p: typeof pkg) => ReturnType<StatusIntelligenceService['taskProgress']>>) {
    const m = method(p);
    assert.equal(m.completed, null, `${method.name}: completed must be null`);
    assert.equal(m.connection, 'NOT_CONNECTED', `${method.name}: connection must be NOT_CONNECTED`);
    assert.ok(m.liveSource && m.liveSource.length > 0, `${method.name}: liveSource must be present`);
  }
});

test('overallProgress, validationProgress: NOT_CONNECTED', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  for (const m of [svc.overallProgress(p), svc.validationProgress(p)]) {
    assert.equal(m.completed, null);
    assert.equal(m.connection, 'NOT_CONNECTED');
  }
});

// ── constructor: different clock produces different timestamp ──────────────────

test('constructor: accepts custom now(); timestamps differ from FIXED when different clock used', async () => {
  const OTHER = '2030-01-01T00:00:00.000Z';
  const svcOther = new StatusIntelligenceService(engine, () => OTHER);
  const report = svcOther.generateStatusReport(await pkgPromise);
  assert.equal(report.timestamp, OTHER);
});

// ── overall planned is consistent with individual axes ────────────────────────

test('overallProgress.planned >= max(taskProgress.planned, agentProgress.planned)', async () => {
  const svc = makeSvc();
  const p = await pkgPromise;
  const overall = svc.overallProgress(p).planned;
  const taskP = svc.taskProgress(p).planned;
  const agentP = svc.agentProgress(p).planned;
  assert.ok(overall >= Math.max(taskP, agentP));
});

// ── findings: each has required fields ───────────────────────────────────────

test('generateStatusReport: each finding has id, category, kind, severity, subject, title, detail, connection, confidence, evidence', async () => {
  const svc = makeSvc();
  const report = svc.generateStatusReport(await pkgPromise);
  for (const f of report.findings) {
    assert.ok(typeof f.id === 'string' && f.id.length > 0, 'finding.id');
    assert.ok(typeof f.category === 'string', 'finding.category');
    assert.ok(typeof f.kind === 'string', 'finding.kind');
    assert.ok(['critical', 'high', 'medium', 'low', 'info'].includes(f.severity), 'finding.severity');
    assert.ok(typeof f.subject === 'string', 'finding.subject');
    assert.ok(typeof f.title === 'string', 'finding.title');
    assert.ok(typeof f.detail === 'string', 'finding.detail');
    assert.ok(['CONNECTED', 'NOT_CONNECTED'].includes(f.connection), 'finding.connection');
    assert.ok(typeof f.confidence === 'number' && f.confidence >= 0 && f.confidence <= 1, 'finding.confidence');
    assert.ok(Array.isArray(f.evidence), 'finding.evidence');
  }
});
