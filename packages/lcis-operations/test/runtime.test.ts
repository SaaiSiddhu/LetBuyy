/**
 * RuntimeOperationsService tests — Phase 6 LCOS runtime detection.
 *
 * Uses the REAL graphify-out artifacts (no fixtures). Fixed `now` for determinism.
 * Verifies:
 *  - SPOF finding is CONNECTED + critical
 *  - DLQ gap finding is CONNECTED + high
 *  - Live signals are NOT_CONNECTED + value null + env vars named
 *  - Report has full provenance (evidence/confidence/sources/timestamp/liveConnected)
 *  - Confidence is 0 for any NOT_CONNECTED finding
 *  - Determinism: two calls produce identical JSON
 *  - Read-only source scan: no fetch/exec/spawn/writeFile/child_process
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { RuntimeOperationsService } from '../src/runtime/index';
import type { OperationalFinding, LiveSignal, RuntimeReport } from '../src/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();
const now = () => FIXED;
const svc = new RuntimeOperationsService(engine, now);

// ── read-only source scan ─────────────────────────────────────────────────────
test('source code is read-only: no fetch/exec/spawn/writeFile/child_process', () => {
  const src = readFileSync(
    new URL('../src/runtime/RuntimeOperationsService.ts', import.meta.url),
  ).toString();
  // strip single-line and block comments before scanning
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
  const forbidden = ['fetch(', 'child_process', 'spawn(', 'exec(', 'eval(', 'writeFile'];
  for (const f of forbidden) {
    assert.ok(!stripped.includes(f), `Source must not contain "${f}"`);
  }
});

// ── constructor / basic availability ─────────────────────────────────────────
test('RuntimeOperationsService constructs without throwing', () => {
  assert.ok(svc instanceof RuntimeOperationsService);
});

// ── detectWorkerFailures ──────────────────────────────────────────────────────
test('detectWorkerFailures returns an array', () => {
  const findings = svc.detectWorkerFailures();
  assert.ok(Array.isArray(findings));
});

test('detectWorkerFailures: mobile-bff under-mapped finding is CONNECTED', () => {
  const findings = svc.detectWorkerFailures();
  const mobileBffFindings = findings.filter(
    (f) => f.subject === 'letbuyy-mobile-bff' && f.status === 'CONNECTED',
  );
  assert.ok(mobileBffFindings.length >= 1, 'mobile-bff structural finding present');
  const f = mobileBffFindings[0]!;
  assert.equal(f.area, 'runtime');
  assert.ok(f.confidence > 0, 'CONNECTED finding has non-zero confidence');
});

test('detectWorkerFailures: NOT_CONNECTED live error-rate findings have confidence 0', () => {
  const findings = svc.detectWorkerFailures();
  const notConn = findings.filter(
    (f) => f.kind === 'worker-error-rate' && f.status === 'NOT_CONNECTED',
  );
  assert.ok(notConn.length >= 1, 'at least one NOT_CONNECTED error-rate finding');
  for (const f of notConn) {
    assert.equal(f.confidence, 0, `"${f.id}" must have confidence 0`);
  }
});

test('detectWorkerFailures: NOT_CONNECTED findings name CF_ANALYTICS_API_TOKEN', () => {
  const findings = svc.detectWorkerFailures();
  const notConn = findings.filter(
    (f) => f.kind === 'worker-error-rate' && f.status === 'NOT_CONNECTED',
  );
  for (const f of notConn) {
    const envVarMentioned = f.evidence.some(
      (e) => e.kind === 'not-connected' && (e.detail ?? '').includes('CF_ANALYTICS_API_TOKEN'),
    );
    assert.ok(envVarMentioned, `${f.id}: must mention CF_ANALYTICS_API_TOKEN in evidence`);
  }
});

test('detectWorkerFailures: all findings have non-empty id, title, detail, area=runtime', () => {
  const findings = svc.detectWorkerFailures();
  for (const f of findings) {
    assert.ok(f.id.length > 0, 'id non-empty');
    assert.ok(f.title.length > 0, 'title non-empty');
    assert.ok(f.detail.length > 0, 'detail non-empty');
    assert.equal(f.area, 'runtime');
  }
});

// ── detectQueueBacklog ────────────────────────────────────────────────────────
test('detectQueueBacklog returns an array', () => {
  const findings = svc.detectQueueBacklog();
  assert.ok(Array.isArray(findings));
});

test('detectQueueBacklog: SPOF finding is CONNECTED + critical', () => {
  const findings = svc.detectQueueBacklog();
  const spof = findings.find(
    (f) => f.kind === 'queue-spof' && f.status === 'CONNECTED',
  );
  assert.ok(spof, 'SPOF finding present and CONNECTED');
  assert.equal(spof!.severity, 'critical', 'SPOF must be critical severity');
  assert.equal(spof!.area, 'runtime');
  assert.ok(spof!.confidence > 0);
});

test('detectQueueBacklog: SPOF finding subject is letbuyy-queue-workers', () => {
  const findings = svc.detectQueueBacklog();
  const spof = findings.find((f) => f.kind === 'queue-spof');
  assert.equal(spof?.subject, 'letbuyy-queue-workers');
});

test('detectQueueBacklog: SPOF finding references all 5 business queues in detail', () => {
  const findings = svc.detectQueueBacklog();
  const spof = findings.find((f) => f.kind === 'queue-spof');
  assert.ok(spof, 'SPOF finding present');
  const queues = ['EVENT_QUEUE', 'ANALYTICS_QUEUE', 'SEARCH_QUEUE', 'NOTIFICATION_QUEUE', 'RUNTIME_QUEUE'];
  for (const q of queues) {
    assert.ok(spof!.detail.includes(q), `SPOF detail must mention ${q}`);
  }
});

test('detectQueueBacklog: live backlog NOT_CONNECTED findings have confidence 0', () => {
  const findings = svc.detectQueueBacklog();
  const notConn = findings.filter(
    (f) => f.kind === 'queue-backlog-depth' && f.status === 'NOT_CONNECTED',
  );
  assert.ok(notConn.length >= 1, 'at least one NOT_CONNECTED backlog finding');
  for (const f of notConn) {
    assert.equal(f.confidence, 0);
  }
});

test('detectQueueBacklog: NOT_CONNECTED findings name CLOUDFLARE_API_TOKEN', () => {
  const findings = svc.detectQueueBacklog();
  const notConn = findings.filter(
    (f) => f.kind === 'queue-backlog-depth' && f.status === 'NOT_CONNECTED',
  );
  for (const f of notConn) {
    const mentioned = f.evidence.some(
      (e) => e.kind === 'not-connected' && (e.detail ?? '').includes('CLOUDFLARE_API_TOKEN'),
    );
    assert.ok(mentioned, `${f.id}: must mention CLOUDFLARE_API_TOKEN`);
  }
});

// ── detectDeadLetters ─────────────────────────────────────────────────────────
test('detectDeadLetters returns an array', () => {
  const findings = svc.detectDeadLetters();
  assert.ok(Array.isArray(findings));
});

test('detectDeadLetters: DLQ-drain-gap finding is CONNECTED + high', () => {
  const findings = svc.detectDeadLetters();
  const gap = findings.find(
    (f) => f.kind === 'dlq-monitoring-gap' && f.status === 'CONNECTED',
  );
  assert.ok(gap, 'DLQ drain gap finding present and CONNECTED');
  assert.equal(gap!.severity, 'high', 'DLQ gap must be high severity');
  assert.ok(gap!.confidence > 0);
});

test('detectDeadLetters: DLQ gap finding mentions the 6-hour cron window', () => {
  const findings = svc.detectDeadLetters();
  const gap = findings.find((f) => f.kind === 'dlq-monitoring-gap');
  assert.ok(gap, 'DLQ gap finding present');
  assert.ok(
    gap!.detail.includes('6') || gap!.detail.toLowerCase().includes('6 hour') || gap!.detail.includes('*/6'),
    'DLQ gap detail must reference the 6-hour window',
  );
});

test('detectDeadLetters: live DLQ depth findings are NOT_CONNECTED + confidence 0', () => {
  const findings = svc.detectDeadLetters();
  const notConn = findings.filter(
    (f) => f.kind === 'dlq-depth' && f.status === 'NOT_CONNECTED',
  );
  assert.ok(notConn.length >= 1, 'at least one NOT_CONNECTED DLQ depth finding');
  for (const f of notConn) {
    assert.equal(f.confidence, 0);
  }
});

test('detectDeadLetters: NOT_CONNECTED DLQ findings name CLOUDFLARE_API_TOKEN', () => {
  const findings = svc.detectDeadLetters();
  const notConn = findings.filter(
    (f) => f.kind === 'dlq-depth' && f.status === 'NOT_CONNECTED',
  );
  for (const f of notConn) {
    const mentioned = f.evidence.some(
      (e) => e.kind === 'not-connected' && (e.detail ?? '').includes('CLOUDFLARE_API_TOKEN'),
    );
    assert.ok(mentioned, `${f.id}: must mention CLOUDFLARE_API_TOKEN`);
  }
});

// ── detectStuckJobs ───────────────────────────────────────────────────────────
test('detectStuckJobs returns an array', () => {
  const findings = svc.detectStuckJobs();
  assert.ok(Array.isArray(findings));
});

test('detectStuckJobs: live detection finding is NOT_CONNECTED + confidence 0', () => {
  const findings = svc.detectStuckJobs();
  const notConn = findings.find(
    (f) => f.kind === 'stuck-job-detection' && f.status === 'NOT_CONNECTED',
  );
  assert.ok(notConn, 'NOT_CONNECTED stuck-job finding present');
  assert.equal(notConn!.confidence, 0);
});

test('detectStuckJobs: NOT_CONNECTED finding names CF credentials in evidence', () => {
  const findings = svc.detectStuckJobs();
  const notConn = findings.find((f) => f.kind === 'stuck-job-detection');
  assert.ok(notConn);
  const hasCF = notConn!.evidence.some(
    (e) => e.kind === 'not-connected' &&
      ((e.detail ?? '').includes('CLOUDFLARE_API_TOKEN') || (e.detail ?? '').includes('CF_ACCOUNT_ID')),
  );
  assert.ok(hasCF, 'stuck-job NOT_CONNECTED must name CF credentials');
});

test('detectStuckJobs: all findings have area=runtime', () => {
  const findings = svc.detectStuckJobs();
  for (const f of findings) {
    assert.equal(f.area, 'runtime');
  }
});

// ── detectCronFailures ────────────────────────────────────────────────────────
test('detectCronFailures returns an array', () => {
  const findings = svc.detectCronFailures();
  assert.ok(Array.isArray(findings));
});

test('detectCronFailures: cron declarations are CONNECTED', () => {
  const findings = svc.detectCronFailures();
  const declared = findings.filter(
    (f) => f.kind === 'cron-declared' && f.status === 'CONNECTED',
  );
  assert.ok(declared.length >= 1, 'at least one CONNECTED cron-declared finding');
  for (const f of declared) {
    assert.ok(f.confidence > 0);
  }
});

test('detectCronFailures: cron last-run findings are NOT_CONNECTED + confidence 0', () => {
  const findings = svc.detectCronFailures();
  const lastRun = findings.filter(
    (f) => f.kind === 'cron-last-run' && f.status === 'NOT_CONNECTED',
  );
  assert.ok(lastRun.length >= 1, 'at least one NOT_CONNECTED cron-last-run finding');
  for (const f of lastRun) {
    assert.equal(f.confidence, 0);
  }
});

test('detectCronFailures: production-env-only gap finding is CONNECTED', () => {
  const findings = svc.detectCronFailures();
  const gap = findings.find(
    (f) => f.kind === 'cron-env-gap' && f.subject === 'letbuyy-api' && f.status === 'CONNECTED',
  );
  assert.ok(gap, 'Cron env-gap finding present and CONNECTED');
});

test('detectCronFailures: NOT_CONNECTED cron findings name CF_ANALYTICS_API_TOKEN', () => {
  const findings = svc.detectCronFailures();
  const notConn = findings.filter((f) => f.kind === 'cron-last-run');
  for (const f of notConn) {
    const mentioned = f.evidence.some(
      (e) => e.kind === 'not-connected' && (e.detail ?? '').includes('CF_ANALYTICS_API_TOKEN'),
    );
    assert.ok(mentioned, `${f.id}: must mention CF_ANALYTICS_API_TOKEN`);
  }
});

// ── generateRuntimeReport ─────────────────────────────────────────────────────
test('generateRuntimeReport returns a RuntimeReport with area=runtime', () => {
  const report = svc.generateRuntimeReport();
  assert.equal(report.area, 'runtime');
});

test('generateRuntimeReport: provenance is complete (evidence/confidence/sources/timestamp/liveConnected)', () => {
  const report = svc.generateRuntimeReport();
  assert.ok(Array.isArray(report.evidence) && report.evidence.length > 0, 'evidence array populated');
  assert.ok(typeof report.confidence === 'number', 'confidence is a number');
  assert.ok(Array.isArray(report.sources) && report.sources.length > 0, 'sources populated');
  assert.equal(report.timestamp, FIXED, 'timestamp uses fixed now');
  assert.equal(report.liveConnected, false, 'liveConnected is false (honest)');
});

test('generateRuntimeReport: confidence is between 0 and 0.9 (structural cap)', () => {
  const report = svc.generateRuntimeReport();
  assert.ok(report.confidence >= 0 && report.confidence <= 0.9);
});

test('generateRuntimeReport: facts array is non-empty with area=runtime items', () => {
  const report = svc.generateRuntimeReport();
  assert.ok(Array.isArray(report.facts) && report.facts.length > 0);
  for (const f of report.facts) {
    assert.equal(f.area, 'runtime');
  }
});

test('generateRuntimeReport: findings array is non-empty', () => {
  const report = svc.generateRuntimeReport();
  assert.ok(Array.isArray(report.findings) && report.findings.length > 0);
});

test('generateRuntimeReport: signals array has runtime-area entries from registry', () => {
  const report = svc.generateRuntimeReport();
  assert.ok(Array.isArray(report.signals) && report.signals.length >= 3);
  for (const s of report.signals) {
    assert.equal(s.area, 'runtime');
  }
});

test('generateRuntimeReport: all NOT_CONNECTED signals have value=null', () => {
  const report = svc.generateRuntimeReport();
  const notConn = report.signals.filter((s) => s.status === 'NOT_CONNECTED');
  for (const s of notConn) {
    assert.equal(s.value, null, `Signal "${s.key}" value must be null when NOT_CONNECTED`);
  }
});

test('generateRuntimeReport: NOT_CONNECTED signals have non-empty requiresEnvVar', () => {
  const report = svc.generateRuntimeReport();
  const notConn = report.signals.filter((s) => s.status === 'NOT_CONNECTED');
  assert.ok(notConn.length >= 1, 'At least one NOT_CONNECTED signal');
  for (const s of notConn) {
    assert.ok(s.requiresEnvVar.length >= 1, `Signal "${s.key}" must name env vars`);
  }
});

test('generateRuntimeReport: health is an OperationalHealth for runtime area', () => {
  const report = svc.generateRuntimeReport();
  assert.ok(report.health, 'health present');
  assert.equal(report.health.area, 'runtime');
  assert.ok(typeof report.health.connectedSignals === 'number');
  assert.ok(typeof report.health.notConnectedSignals === 'number');
  assert.ok(['healthy', 'degraded', 'failing', 'unknown'].includes(report.health.band));
});

test('generateRuntimeReport: health.score is null or 0..100', () => {
  const report = svc.generateRuntimeReport();
  const score = report.health.score;
  assert.ok(score === null || (typeof score === 'number' && score >= 0 && score <= 100));
});

test('generateRuntimeReport: summary is a non-empty string', () => {
  const report = svc.generateRuntimeReport();
  assert.ok(typeof report.summary === 'string' && report.summary.length > 0);
});

test('generateRuntimeReport: summary mentions SPOF and NOT_CONNECTED', () => {
  const report = svc.generateRuntimeReport();
  assert.ok(
    report.summary.toLowerCase().includes('spof') ||
    report.summary.toLowerCase().includes('single') ||
    report.summary.toLowerCase().includes('letbuyy-queue-workers'),
    'summary must mention the SPOF or letbuyy-queue-workers',
  );
  assert.ok(
    report.summary.includes('NOT_CONNECTED'),
    'summary must mention NOT_CONNECTED signals',
  );
});

// ── SPOF + DLQ structural assertions (the key Phase-6 claims) ────────────────
test('SPOF: queue-workers SPOF finding is real, CONNECTED, critical — not fabricated', () => {
  const report = svc.generateRuntimeReport();
  const spof = report.findings.find(
    (f) => f.kind === 'queue-spof' && f.status === 'CONNECTED',
  );
  assert.ok(spof, 'SPOF finding must be present in the report');
  assert.equal(spof!.severity, 'critical');
  assert.ok(spof!.evidence.length > 0, 'SPOF finding must have evidence');
  // Evidence must cite the real artifact (runtime-intel.json)
  const artifactEvidence = spof!.evidence.filter((e) => e.kind !== 'not-connected');
  assert.ok(artifactEvidence.length > 0, 'SPOF finding must have at least one artifact-backed evidence');
});

test('DLQ gap: drain-gap finding is real, CONNECTED, high — not fabricated', () => {
  const report = svc.generateRuntimeReport();
  const gap = report.findings.find(
    (f) => f.kind === 'dlq-monitoring-gap' && f.status === 'CONNECTED',
  );
  assert.ok(gap, 'DLQ drain gap finding must be present in the report');
  assert.equal(gap!.severity, 'high');
  assert.ok(gap!.evidence.length > 0, 'DLQ gap must have evidence');
  const artifactEvidence = gap!.evidence.filter((e) => e.kind !== 'not-connected');
  assert.ok(artifactEvidence.length > 0, 'DLQ gap must have artifact-backed evidence');
});

// ── live signal honesty assertions ───────────────────────────────────────────
test('all live signals in report: NOT_CONNECTED signals carry env vars + null value', () => {
  const report = svc.generateRuntimeReport();
  for (const s of report.signals) {
    if (s.status === 'NOT_CONNECTED') {
      assert.equal(s.value, null, `${s.key} must have value=null`);
      assert.ok(s.requiresEnvVar.length >= 1, `${s.key} must name required env vars`);
    }
  }
});

test('runtime.worker-errors signal is NOT_CONNECTED + value null + CF env vars', () => {
  const report = svc.generateRuntimeReport();
  const sig = report.signals.find((s) => s.key === 'runtime.worker-errors');
  assert.ok(sig, 'runtime.worker-errors signal present');
  assert.equal(sig!.status, 'NOT_CONNECTED');
  assert.equal(sig!.value, null);
  assert.ok(
    sig!.requiresEnvVar.includes('CF_ANALYTICS_API_TOKEN') ||
    sig!.requiresEnvVar.includes('CF_ACCOUNT_ID'),
    'runtime.worker-errors must name CF env vars',
  );
});

test('runtime.queue-backlog signal is NOT_CONNECTED + value null + CF env vars', () => {
  const report = svc.generateRuntimeReport();
  const sig = report.signals.find((s) => s.key === 'runtime.queue-backlog');
  assert.ok(sig, 'runtime.queue-backlog signal present');
  assert.equal(sig!.status, 'NOT_CONNECTED');
  assert.equal(sig!.value, null);
  assert.ok(
    sig!.requiresEnvVar.includes('CLOUDFLARE_API_TOKEN') ||
    sig!.requiresEnvVar.includes('CF_ACCOUNT_ID'),
    'runtime.queue-backlog must name CF env vars',
  );
});

test('runtime.dead-letter-depth signal is NOT_CONNECTED + value null', () => {
  const report = svc.generateRuntimeReport();
  const sig = report.signals.find((s) => s.key === 'runtime.dead-letter-depth');
  assert.ok(sig, 'runtime.dead-letter-depth signal present');
  assert.equal(sig!.status, 'NOT_CONNECTED');
  assert.equal(sig!.value, null);
});

test('runtime.cron-last-run signal is NOT_CONNECTED + value null', () => {
  const report = svc.generateRuntimeReport();
  const sig = report.signals.find((s) => s.key === 'runtime.cron-last-run');
  assert.ok(sig, 'runtime.cron-last-run signal present');
  assert.equal(sig!.status, 'NOT_CONNECTED');
  assert.equal(sig!.value, null);
});

test('runtime.worker-topology signal is CONNECTED', () => {
  const report = svc.generateRuntimeReport();
  const sig = report.signals.find((s) => s.key === 'runtime.worker-topology');
  assert.ok(sig, 'runtime.worker-topology signal present');
  assert.equal(sig!.status, 'CONNECTED');
});

// ── confidence 0 for NOT_CONNECTED findings (across all detectors) ────────────
test('all NOT_CONNECTED findings in the report have confidence 0', () => {
  const report = svc.generateRuntimeReport();
  const notConn = report.findings.filter((f) => f.status === 'NOT_CONNECTED');
  assert.ok(notConn.length >= 1, 'at least one NOT_CONNECTED finding in report');
  for (const f of notConn) {
    assert.equal(f.confidence, 0, `Finding "${f.id}" must have confidence 0`);
  }
});

// ── CONNECTED findings have positive confidence ────────────────────────────────
test('CONNECTED findings in the report have confidence > 0', () => {
  const report = svc.generateRuntimeReport();
  const conn = report.findings.filter((f) => f.status === 'CONNECTED');
  for (const f of conn) {
    assert.ok(f.confidence > 0, `Finding "${f.id}" (CONNECTED) must have positive confidence`);
  }
});

// ── determinism ───────────────────────────────────────────────────────────────
test('generateRuntimeReport is deterministic: two calls produce identical JSON', () => {
  const r1 = svc.generateRuntimeReport();
  const r2 = svc.generateRuntimeReport();
  assert.deepEqual(JSON.parse(JSON.stringify(r1)), JSON.parse(JSON.stringify(r2)));
});

// ── finding ids are stable and non-empty ─────────────────────────────────────
test('all findings have stable, non-empty ids', () => {
  const report = svc.generateRuntimeReport();
  const ids = report.findings.map((f) => f.id);
  assert.ok(ids.every((id) => id.length > 0), 'all ids non-empty');
  // Stable IDs: calling again produces same IDs
  const r2 = svc.generateRuntimeReport();
  const ids2 = r2.findings.map((f) => f.id);
  assert.deepEqual(ids, ids2, 'finding IDs are stable across calls');
});

// ── facts: structural values are non-null; live values are null ───────────────
test('report facts: worker-count and queue-count are CONNECTED with non-null value', () => {
  const report = svc.generateRuntimeReport();
  const workerCount = report.facts.find((f) => f.kind === 'worker-count');
  const queueCount = report.facts.find((f) => f.kind === 'queue-count');
  assert.ok(workerCount, 'worker-count fact present');
  assert.ok(queueCount, 'queue-count fact present');
  assert.equal(workerCount!.status, 'CONNECTED');
  assert.ok(workerCount!.value !== null, 'worker-count value must be non-null');
  assert.ok(typeof workerCount!.value === 'number' && (workerCount!.value as number) >= 1);
  assert.equal(queueCount!.status, 'CONNECTED');
  assert.ok(queueCount!.value !== null);
});

test('report facts: live facts (worker-error-rate, queue-backlog) are NOT_CONNECTED + null', () => {
  const report = svc.generateRuntimeReport();
  const errorRate = report.facts.find((f) => f.kind === 'worker-error-rate');
  const backlog = report.facts.find((f) => f.kind === 'queue-backlog');
  assert.ok(errorRate, 'worker-error-rate fact present');
  assert.ok(backlog, 'queue-backlog fact present');
  assert.equal(errorRate!.status, 'NOT_CONNECTED');
  assert.equal(errorRate!.value, null);
  assert.equal(backlog!.status, 'NOT_CONNECTED');
  assert.equal(backlog!.value, null);
});

// ── report sources cite real artifact paths ────────────────────────────────────
test('report sources include the real artifact path graphify-out/runtime-intel.json', () => {
  const report = svc.generateRuntimeReport();
  assert.ok(
    report.sources.some((s) => s.includes('runtime-intel')),
    'sources must include runtime-intel.json',
  );
});
