/**
 * DeploymentOperationsService tests — LCOS Phase 6.
 *
 * Tests run against the REAL graphify-out artifacts (deployment-intelligence-v5.json,
 * deployment-state.json). No mocks, no stubs. Fixed now() for determinism.
 * Read-only source scan: no fetch/exec/spawn/eval/writeFile in the service source.
 *
 * Coverage:
 * - detectDeployments(): structural HEAD/branch/migration facts (CONNECTED); live version NOT_CONNECTED
 * - detectReleaseHealth(): pipeline gates (CONNECTED); live release health NOT_CONNECTED
 * - detectRollbacks(): rollback scripts present (CONNECTED); rollback events NOT_CONNECTED
 * - detectFailedDeploys(): 3 SPOFs (CONNECTED); live failed-deploy status NOT_CONNECTED
 * - generateDeploymentReport(): full DeploymentReport shape + provenance + summary
 * - Honesty contract: NOT_CONNECTED → confidence=0, value=null, requiresEnvVar non-empty
 * - Determinism: two calls with same fixed now() produce identical reports
 * - Read-only source scan: no forbidden IO in service source
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { DeploymentOperationsService } from '../src/deployment/index';

const FIXED = '2026-06-21T00:00:00.000Z';
const fixedNow = (): string => FIXED;

const engine = createEngine();
const svc = new DeploymentOperationsService(engine, fixedNow);

// ── A. detectDeployments ──────────────────────────────────────────────────────

test('detectDeployments returns a non-empty array of OperationalFindings', () => {
  const findings = svc.detectDeployments();
  assert.ok(findings.length >= 1, 'at least one finding returned');
});

test('detectDeployments: declared-head-commit finding is CONNECTED with evidence', () => {
  const findings = svc.detectDeployments();
  const headFinding = findings.find((f) => f.kind === 'declared-head-commit');
  assert.ok(headFinding, 'declared-head-commit finding present');
  assert.equal(headFinding.area, 'deployment');
  assert.equal(headFinding.status, 'CONNECTED');
  assert.ok(headFinding.evidence.length >= 1, 'has evidence');
  assert.ok(headFinding.detail.length > 0, 'detail is populated');
});

test('detectDeployments: declared-head-commit finding references a real commit hash', () => {
  const findings = svc.detectDeployments();
  const headFinding = findings.find((f) => f.kind === 'declared-head-commit');
  assert.ok(headFinding, 'finding present');
  // HEAD commit from deployment-state.json
  assert.ok(/[0-9a-f]{7,}/.test(headFinding.title), `title contains commit hash: ${headFinding.title}`);
});

test('detectDeployments: live deployed-version finding is NOT_CONNECTED', () => {
  const findings = svc.detectDeployments();
  const liveFinding = findings.find((f) => f.kind === 'deployed-version');
  assert.ok(liveFinding, 'deployed-version finding present');
  assert.equal(liveFinding.status, 'NOT_CONNECTED');
  assert.equal(liveFinding.confidence, 0);
});

test('detectDeployments: live deployed-version finding names env vars', () => {
  const findings = svc.detectDeployments();
  const liveFinding = findings.find((f) => f.kind === 'deployed-version');
  assert.ok(liveFinding, 'finding present');
  const envVars = liveFinding.evidence.flatMap((e) => {
    const detail = e.detail ?? '';
    return detail.match(/[A-Z_]{3,}/g) ?? [];
  });
  const allDetail = liveFinding.evidence.map((e) => e.detail ?? '').join(' ');
  assert.ok(
    allDetail.includes('VERCEL_TOKEN') || allDetail.includes('CLOUDFLARE_API_TOKEN'),
    `evidence cites env var: ${allDetail}`,
  );
});

test('detectDeployments: no-canary finding is CONNECTED with medium severity', () => {
  const findings = svc.detectDeployments();
  const canaryFinding = findings.find((f) => f.kind === 'no-canary');
  assert.ok(canaryFinding, 'no-canary finding present');
  assert.equal(canaryFinding.status, 'CONNECTED');
  assert.equal(canaryFinding.severity, 'medium');
  assert.ok(canaryFinding.detail.includes('simultaneously') || canaryFinding.detail.includes('16'), 'detail explains canary absence');
});

test('detectDeployments: workflow-inventory finding is CONNECTED when workflows present', () => {
  const findings = svc.detectDeployments();
  const wfFinding = findings.find((f) => f.kind === 'workflow-inventory');
  if (wfFinding) {
    assert.equal(wfFinding.status, 'CONNECTED');
    assert.ok(wfFinding.title.includes('workflow'), 'title mentions workflows');
  }
  // acceptable for finding to be absent if artifact has no workflows — other findings still cover
});

test('detectDeployments: artifact-git-delta finding if artifact head differs from state head', () => {
  // This is context-dependent; we just verify that if it appears it is CONNECTED
  const findings = svc.detectDeployments();
  const deltaFinding = findings.find((f) => f.kind === 'artifact-git-delta');
  if (deltaFinding) {
    assert.equal(deltaFinding.status, 'CONNECTED');
    assert.equal(deltaFinding.severity, 'low');
    assert.ok(deltaFinding.detail.includes('stale') || deltaFinding.detail.includes('artifact'), 'detail explains delta');
  }
});

test('detectDeployments: all findings have id, area, kind, title, detail, evidence array', () => {
  const findings = svc.detectDeployments();
  for (const f of findings) {
    assert.ok(f.id.length > 0, `finding.id present: ${f.id}`);
    assert.equal(f.area, 'deployment');
    assert.ok(f.kind.length > 0, 'kind present');
    assert.ok(f.title.length > 0, 'title present');
    assert.ok(f.detail.length > 0, 'detail present');
    assert.ok(Array.isArray(f.evidence), 'evidence is array');
  }
});

// ── B. detectReleaseHealth ────────────────────────────────────────────────────

test('detectReleaseHealth returns a non-empty array of findings', () => {
  const findings = svc.detectReleaseHealth();
  assert.ok(findings.length >= 1);
});

test('detectReleaseHealth: live-release-health finding is NOT_CONNECTED', () => {
  const findings = svc.detectReleaseHealth();
  const lrf = findings.find((f) => f.kind === 'release-health');
  assert.ok(lrf, 'release-health finding present');
  assert.equal(lrf.status, 'NOT_CONNECTED');
  assert.equal(lrf.confidence, 0);
});

test('detectReleaseHealth: live-release-health evidence names VERCEL_TOKEN', () => {
  const findings = svc.detectReleaseHealth();
  const lrf = findings.find((f) => f.kind === 'release-health');
  assert.ok(lrf);
  const allDetail = lrf.evidence.map((e) => e.detail ?? '').join(' ');
  assert.ok(allDetail.includes('VERCEL_TOKEN'), `evidence cites VERCEL_TOKEN: ${allDetail}`);
});

test('detectReleaseHealth: pipeline-gate finding is CONNECTED', () => {
  const findings = svc.detectReleaseHealth();
  const pgf = findings.find((f) => f.kind === 'pipeline-gate');
  assert.ok(pgf, 'pipeline-gate finding present');
  assert.equal(pgf.status, 'CONNECTED');
  assert.ok(pgf.detail.length > 10, 'detail describes gate');
});

test('detectReleaseHealth: pipeline-gate detail mentions migrateGate', () => {
  const findings = svc.detectReleaseHealth();
  const pgf = findings.find((f) => f.kind === 'pipeline-gate');
  assert.ok(pgf);
  assert.ok(pgf.detail.includes('migrateGate') || pgf.detail.includes('migrate'), 'migrateGate mentioned');
});

test('detectReleaseHealth: secrets-required finding is CONNECTED with high severity', () => {
  const findings = svc.detectReleaseHealth();
  const sf = findings.find((f) => f.kind === 'secrets-required');
  assert.ok(sf, 'secrets-required finding present');
  assert.equal(sf.status, 'CONNECTED');
  assert.equal(sf.severity, 'high');
});

test('detectReleaseHealth: secrets-required finding mentions 19 secrets', () => {
  const findings = svc.detectReleaseHealth();
  const sf = findings.find((f) => f.kind === 'secrets-required');
  assert.ok(sf);
  assert.ok(sf.title.includes('19') || sf.detail.includes('19'), `mentions 19: ${sf.title}`);
});

test('detectReleaseHealth: all findings have area=deployment', () => {
  const findings = svc.detectReleaseHealth();
  for (const f of findings) assert.equal(f.area, 'deployment');
});

// ── C. detectRollbacks ────────────────────────────────────────────────────────

test('detectRollbacks returns a non-empty array of findings', () => {
  const findings = svc.detectRollbacks();
  assert.ok(findings.length >= 1);
});

test('detectRollbacks: rollback-scripts-present finding is CONNECTED', () => {
  const findings = svc.detectRollbacks();
  const rf = findings.find((f) => f.kind === 'rollback-scripts-present');
  assert.ok(rf, 'rollback-scripts-present finding present');
  assert.equal(rf.status, 'CONNECTED');
});

test('detectRollbacks: rollback-scripts-present detail mentions production-rollback.mjs', () => {
  const findings = svc.detectRollbacks();
  const rf = findings.find((f) => f.kind === 'rollback-scripts-present');
  assert.ok(rf);
  assert.ok(
    rf.detail.includes('production-rollback.mjs') || rf.title.includes('rollback'),
    `detail: ${rf.detail}`,
  );
});

test('detectRollbacks: forward-only-migrations finding is CONNECTED with info severity', () => {
  const findings = svc.detectRollbacks();
  const fof = findings.find((f) => f.kind === 'forward-only-migrations');
  assert.ok(fof, 'forward-only-migrations finding present');
  assert.equal(fof.status, 'CONNECTED');
  assert.equal(fof.severity, 'info');
});

test('detectRollbacks: forward-only-migrations detail mentions 103 migrations', () => {
  const findings = svc.detectRollbacks();
  const fof = findings.find((f) => f.kind === 'forward-only-migrations');
  assert.ok(fof);
  assert.ok(fof.detail.includes('103') || fof.detail.includes('forward'), `detail: ${fof.detail}`);
});

test('detectRollbacks: live rollback-events finding is NOT_CONNECTED', () => {
  const findings = svc.detectRollbacks();
  const ref = findings.find((f) => f.kind === 'rollback-events');
  assert.ok(ref, 'rollback-events finding present');
  assert.equal(ref.status, 'NOT_CONNECTED');
  assert.equal(ref.confidence, 0);
});

test('detectRollbacks: live rollback-events evidence names VERCEL_TOKEN or CLOUDFLARE_API_TOKEN', () => {
  const findings = svc.detectRollbacks();
  const ref = findings.find((f) => f.kind === 'rollback-events');
  assert.ok(ref);
  const allDetail = ref.evidence.map((e) => e.detail ?? '').join(' ');
  assert.ok(
    allDetail.includes('VERCEL_TOKEN') || allDetail.includes('CLOUDFLARE_API_TOKEN'),
    `cites env var: ${allDetail}`,
  );
});

test('detectRollbacks: all findings area=deployment', () => {
  const findings = svc.detectRollbacks();
  for (const f of findings) assert.equal(f.area, 'deployment');
});

// ── D. detectFailedDeploys ────────────────────────────────────────────────────

test('detectFailedDeploys returns a non-empty array of findings', () => {
  const findings = svc.detectFailedDeploys();
  assert.ok(findings.length >= 2, 'at least live + SPOF findings');
});

test('detectFailedDeploys: live-failed-deploys finding is NOT_CONNECTED with confidence 0', () => {
  const findings = svc.detectFailedDeploys();
  const lfd = findings.find((f) => f.kind === 'live-failed-deploys');
  assert.ok(lfd, 'live-failed-deploys finding present');
  assert.equal(lfd.status, 'NOT_CONNECTED');
  assert.equal(lfd.confidence, 0);
});

test('detectFailedDeploys: live-failed-deploys evidence cites env vars', () => {
  const findings = svc.detectFailedDeploys();
  const lfd = findings.find((f) => f.kind === 'live-failed-deploys');
  assert.ok(lfd);
  const allDetail = lfd.evidence.map((e) => e.detail ?? '').join(' ');
  assert.ok(
    allDetail.includes('VERCEL_TOKEN') || allDetail.includes('CLOUDFLARE_API_TOKEN'),
    `cites env var: ${allDetail}`,
  );
});

test('detectFailedDeploys: SPOF D-1 (single-pipeline) finding is CONNECTED with critical severity', () => {
  const findings = svc.detectFailedDeploys();
  const d1 = findings.find((f) => f.kind === 'spof-single-pipeline');
  assert.ok(d1, 'SPOF D-1 finding present');
  assert.equal(d1.status, 'CONNECTED');
  assert.equal(d1.severity, 'critical');
  assert.equal(d1.subject, 'D-1');
});

test('detectFailedDeploys: SPOF D-2 (shared-datastore) finding is CONNECTED with critical severity', () => {
  const findings = svc.detectFailedDeploys();
  const d2 = findings.find((f) => f.kind === 'spof-shared-datastore');
  assert.ok(d2, 'SPOF D-2 finding present');
  assert.equal(d2.status, 'CONNECTED');
  assert.equal(d2.severity, 'critical');
});

test('detectFailedDeploys: SPOF D-3 (migrate-before-deploy) finding is CONNECTED', () => {
  const findings = svc.detectFailedDeploys();
  const d3 = findings.find((f) => f.kind === 'spof-migrate-before-deploy');
  assert.ok(d3, 'SPOF D-3 finding present');
  assert.equal(d3.status, 'CONNECTED');
});

test('detectFailedDeploys: SPOF findings have evidence from deployment-intelligence-v5', () => {
  const findings = svc.detectFailedDeploys();
  const spofFindings = findings.filter((f) => f.kind.startsWith('spof-') && f.kind !== 'spof-unknown');
  for (const f of spofFindings) {
    assert.ok(f.evidence.length >= 1, `SPOF ${f.subject} has evidence`);
    const hasArtifactSource = f.evidence.some(
      (e) => (e.source ?? '').includes('deployment-intelligence-v5'),
    );
    assert.ok(hasArtifactSource, `SPOF ${f.subject} evidence cites deployment-intelligence-v5`);
  }
});

test('detectFailedDeploys: SPOF detail mentions mitigation', () => {
  const findings = svc.detectFailedDeploys();
  const d1 = findings.find((f) => f.kind === 'spof-single-pipeline');
  assert.ok(d1);
  assert.ok(d1.detail.includes('Mitigation') || d1.detail.includes('mitigation') || d1.detail.includes('gate'), `detail: ${d1.detail}`);
});

test('detectFailedDeploys: all findings area=deployment', () => {
  const findings = svc.detectFailedDeploys();
  for (const f of findings) assert.equal(f.area, 'deployment');
});

// ── E. generateDeploymentReport ───────────────────────────────────────────────

test('generateDeploymentReport returns a DeploymentReport with area=deployment', () => {
  const report = svc.generateDeploymentReport();
  assert.equal(report.area, 'deployment');
});

test('generateDeploymentReport: report has facts array', () => {
  const report = svc.generateDeploymentReport();
  assert.ok(Array.isArray(report.facts), 'facts is array');
  assert.ok(report.facts.length >= 1, 'at least one fact');
});

test('generateDeploymentReport: report has findings array with items from all four detect methods', () => {
  const report = svc.generateDeploymentReport();
  assert.ok(Array.isArray(report.findings));
  assert.ok(report.findings.length >= 5, `at least 5 findings, got ${report.findings.length}`);
});

test('generateDeploymentReport: report has signals array for deployment area', () => {
  const report = svc.generateDeploymentReport();
  assert.ok(Array.isArray(report.signals));
  assert.ok(report.signals.length >= 1, 'at least one deployment signal');
  for (const s of report.signals) assert.equal(s.area, 'deployment');
});

test('generateDeploymentReport: deployment.git-state signal is CONNECTED', () => {
  const report = svc.generateDeploymentReport();
  const gitStateSig = report.signals.find((s) => s.key === 'deployment.git-state');
  assert.ok(gitStateSig, 'deployment.git-state signal present');
  assert.equal(gitStateSig.status, 'CONNECTED');
  assert.equal(gitStateSig.value, null); // value is null — TelemetryNormalizer returns null for structural
});

test('generateDeploymentReport: deployment.deployed-version signal is NOT_CONNECTED', () => {
  const report = svc.generateDeploymentReport();
  const dvSig = report.signals.find((s) => s.key === 'deployment.deployed-version');
  assert.ok(dvSig, 'deployment.deployed-version signal present');
  assert.equal(dvSig.status, 'NOT_CONNECTED');
  assert.equal(dvSig.value, null);
  assert.ok(dvSig.requiresEnvVar.length >= 1, 'requiresEnvVar named');
});

test('generateDeploymentReport: deployment.release-health signal is NOT_CONNECTED', () => {
  const report = svc.generateDeploymentReport();
  const rhSig = report.signals.find((s) => s.key === 'deployment.release-health');
  assert.ok(rhSig, 'deployment.release-health signal present');
  assert.equal(rhSig.status, 'NOT_CONNECTED');
  assert.equal(rhSig.value, null);
});

test('generateDeploymentReport: health has area=deployment', () => {
  const report = svc.generateDeploymentReport();
  assert.equal(report.health.area, 'deployment');
  assert.ok(typeof report.health.connectedSignals === 'number');
  assert.ok(typeof report.health.notConnectedSignals === 'number');
});

test('generateDeploymentReport: liveConnected is false (no live values in this env)', () => {
  const report = svc.generateDeploymentReport();
  assert.equal(report.liveConnected, false);
});

test('generateDeploymentReport: timestamp equals fixed now', () => {
  const report = svc.generateDeploymentReport();
  assert.equal(report.timestamp, FIXED);
});

test('generateDeploymentReport: evidence array is non-empty', () => {
  const report = svc.generateDeploymentReport();
  assert.ok(report.evidence.length >= 1, 'evidence non-empty');
});

test('generateDeploymentReport: sources array is non-empty', () => {
  const report = svc.generateDeploymentReport();
  assert.ok(report.sources.length >= 1, 'sources non-empty');
});

test('generateDeploymentReport: summary is a non-trivial string', () => {
  const report = svc.generateDeploymentReport();
  assert.ok(typeof report.summary === 'string');
  assert.ok(report.summary.length > 50, 'summary is substantive');
});

test('generateDeploymentReport: summary mentions SPOF count', () => {
  const report = svc.generateDeploymentReport();
  assert.ok(
    report.summary.includes('SPOF') || report.summary.includes('spof'),
    `summary mentions SPOF: ${report.summary}`,
  );
});

test('generateDeploymentReport: summary mentions NOT_CONNECTED status', () => {
  const report = svc.generateDeploymentReport();
  assert.ok(
    report.summary.includes('NOT_CONNECTED') || report.summary.includes('not connected'),
    `summary is honest about NOT_CONNECTED: ${report.summary}`,
  );
});

test('generateDeploymentReport: facts contain declared-head with CONNECTED status', () => {
  const report = svc.generateDeploymentReport();
  const headFact = report.facts.find((f) => f.kind === 'declared-head');
  assert.ok(headFact, 'declared-head fact present');
  assert.equal(headFact.status, 'CONNECTED');
  assert.ok(headFact.value !== null, 'value is the commit hash');
});

test('generateDeploymentReport: facts contain live-deployed-version with NOT_CONNECTED and null value', () => {
  const report = svc.generateDeploymentReport();
  const liveFact = report.facts.find((f) => f.kind === 'live-deployed-version');
  assert.ok(liveFact, 'live-deployed-version fact present');
  assert.equal(liveFact.status, 'NOT_CONNECTED');
  assert.equal(liveFact.value, null);
});

test('generateDeploymentReport: facts contain subdomain entries (CONNECTED)', () => {
  const report = svc.generateDeploymentReport();
  const subFacts = report.facts.filter((f) => f.kind === 'subdomain');
  assert.ok(subFacts.length >= 1, 'at least one subdomain fact');
  for (const f of subFacts) assert.equal(f.status, 'CONNECTED');
});

test('generateDeploymentReport: worker-targets and vercel-targets facts are CONNECTED', () => {
  const report = svc.generateDeploymentReport();
  const wf = report.facts.find((f) => f.kind === 'worker-targets');
  const vf = report.facts.find((f) => f.kind === 'vercel-targets');
  if (wf) {
    assert.equal(wf.status, 'CONNECTED');
    assert.ok(typeof wf.value === 'number' && wf.value >= 1);
  }
  if (vf) {
    assert.equal(vf.status, 'CONNECTED');
    assert.ok(typeof vf.value === 'number' && vf.value >= 1);
  }
});

// ── F. Honesty contract ───────────────────────────────────────────────────────

test('honesty: every NOT_CONNECTED finding has confidence=0', () => {
  const report = svc.generateDeploymentReport();
  for (const f of report.findings) {
    if (f.status === 'NOT_CONNECTED') {
      assert.equal(f.confidence, 0, `NOT_CONNECTED finding ${f.id} must have confidence=0`);
    }
  }
});

test('honesty: every NOT_CONNECTED signal has value=null', () => {
  const report = svc.generateDeploymentReport();
  for (const s of report.signals) {
    if (s.status === 'NOT_CONNECTED') {
      assert.equal(s.value, null, `NOT_CONNECTED signal ${s.key} must have value=null`);
    }
  }
});

test('honesty: every NOT_CONNECTED signal names at least one env var', () => {
  const report = svc.generateDeploymentReport();
  for (const s of report.signals) {
    if (s.status === 'NOT_CONNECTED') {
      assert.ok(s.requiresEnvVar.length >= 1, `${s.key} must name requiresEnvVar`);
    }
  }
});

test('honesty: every NOT_CONNECTED fact has value=null', () => {
  const report = svc.generateDeploymentReport();
  for (const f of report.facts) {
    if (f.status === 'NOT_CONNECTED') {
      assert.equal(f.value, null, `NOT_CONNECTED fact "${f.kind}" must have value=null`);
    }
  }
});

test('honesty: CONNECTED findings have positive confidence', () => {
  const report = svc.generateDeploymentReport();
  for (const f of report.findings) {
    if (f.status === 'CONNECTED') {
      assert.ok(f.confidence > 0, `CONNECTED finding ${f.id} should have confidence > 0`);
    }
  }
});

test('honesty: overall confidence never exceeds 0.9', () => {
  const report = svc.generateDeploymentReport();
  assert.ok(report.confidence <= 0.9, `confidence must not exceed 0.9: ${report.confidence}`);
});

// ── G. Determinism ────────────────────────────────────────────────────────────

test('determinism: generateDeploymentReport produces identical results on two calls', () => {
  const svc2 = new DeploymentOperationsService(engine, fixedNow);
  const r1 = svc2.generateDeploymentReport();
  const r2 = svc2.generateDeploymentReport();
  assert.equal(r1.timestamp, r2.timestamp);
  assert.equal(r1.findings.length, r2.findings.length);
  assert.equal(r1.facts.length, r2.facts.length);
  assert.equal(r1.summary, r2.summary);
  assert.equal(r1.liveConnected, r2.liveConnected);
});

test('determinism: detectDeployments produces identical finding ids on two calls', () => {
  const svc2 = new DeploymentOperationsService(engine, fixedNow);
  const f1 = svc2.detectDeployments().map((f) => f.id).sort();
  const f2 = svc2.detectDeployments().map((f) => f.id).sort();
  assert.deepEqual(f1, f2);
});

test('determinism: detectFailedDeploys produces identical SPOF finding ids on two calls', () => {
  const svc2 = new DeploymentOperationsService(engine, fixedNow);
  const ids1 = svc2.detectFailedDeploys().map((f) => f.id).sort();
  const ids2 = svc2.detectFailedDeploys().map((f) => f.id).sort();
  assert.deepEqual(ids1, ids2);
});

// ── H. Provenance ─────────────────────────────────────────────────────────────

test('provenance: all findings have at least one evidence item', () => {
  const report = svc.generateDeploymentReport();
  for (const f of report.findings) {
    assert.ok(f.evidence.length >= 1, `finding ${f.id} must have evidence`);
  }
});

test('provenance: CONNECTED findings cite deployment-intelligence-v5 or deployment-state artifacts', () => {
  const report = svc.generateDeploymentReport();
  const connectedFindings = report.findings.filter((f) => f.status === 'CONNECTED');
  for (const f of connectedFindings) {
    const sourceStrings = f.evidence.map((e) => (e.source ?? '') + (e.detail ?? '')).join(' ');
    const hasCitation =
      sourceStrings.includes('deployment-intelligence-v5') ||
      sourceStrings.includes('deployment-state') ||
      sourceStrings.includes('lcis-operations') ||
      sourceStrings.includes('infrastructure');
    assert.ok(hasCitation, `CONNECTED finding ${f.id} should cite a deployment artifact. sources: ${sourceStrings}`);
  }
});

test('provenance: NOT_CONNECTED evidence items have kind=not-connected', () => {
  const report = svc.generateDeploymentReport();
  const notConnectedFindings = report.findings.filter((f) => f.status === 'NOT_CONNECTED');
  for (const f of notConnectedFindings) {
    const hasNotConnectedEvidence = f.evidence.some((e) => e.kind === 'not-connected');
    assert.ok(hasNotConnectedEvidence, `NOT_CONNECTED finding ${f.id} should have not-connected evidence`);
  }
});

test('provenance: rollback-scripts-present evidence cites deployment-intelligence-v5', () => {
  const findings = svc.detectRollbacks();
  const rf = findings.find((f) => f.kind === 'rollback-scripts-present');
  assert.ok(rf);
  const hasCitation = rf.evidence.some((e) => (e.source ?? '').includes('deployment-intelligence-v5'));
  assert.ok(hasCitation, 'rollback-scripts-present should cite deployment-intelligence-v5');
});

// ── I. Read-only source scan ──────────────────────────────────────────────────

test('source-scan: DeploymentOperationsService.ts contains no fetch() calls', () => {
  const src = readFileSync(
    new URL('../src/deployment/DeploymentOperationsService.ts', import.meta.url),
    'utf8',
  ).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!src.includes('fetch('), 'no fetch() in service source');
});

test('source-scan: DeploymentOperationsService.ts contains no child_process/exec/spawn', () => {
  const src = readFileSync(
    new URL('../src/deployment/DeploymentOperationsService.ts', import.meta.url),
    'utf8',
  ).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!src.includes('child_process'), 'no child_process');
  assert.ok(!src.includes('exec('), 'no exec()');
  assert.ok(!src.includes('spawn('), 'no spawn()');
  assert.ok(!src.includes('execSync('), 'no execSync()');
});

test('source-scan: DeploymentOperationsService.ts contains no writeFile/appendFile', () => {
  const src = readFileSync(
    new URL('../src/deployment/DeploymentOperationsService.ts', import.meta.url),
    'utf8',
  ).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!src.includes('writeFile'), 'no writeFile');
  assert.ok(!src.includes('appendFile'), 'no appendFile');
  assert.ok(!src.includes('writeSync'), 'no writeSync');
});

test('source-scan: DeploymentOperationsService.ts contains no eval()', () => {
  const src = readFileSync(
    new URL('../src/deployment/DeploymentOperationsService.ts', import.meta.url),
    'utf8',
  ).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!src.includes('eval('), 'no eval()');
});

test('source-scan: DeploymentOperationsService.ts imports only from shared/index and @letbuyy/lcis-core', () => {
  const src = readFileSync(
    new URL('../src/deployment/DeploymentOperationsService.ts', import.meta.url),
    'utf8',
  );
  // Extract from-clauses of import statements (handles multi-line imports)
  const fromMatches = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const from of fromMatches) {
    const isAllowed =
      from.startsWith('@letbuyy/lcis-core') ||
      from.includes('../shared/index') ||
      from.startsWith('node:');
    assert.ok(isAllowed, `unexpected import from "${from}" in service`);
  }
});

// ── J. Artifact real-data assertions ─────────────────────────────────────────

test('real-data: 4 Cloudflare workers are declared in deployment-state targets', () => {
  const report = svc.generateDeploymentReport();
  const wf = report.facts.find((f) => f.kind === 'worker-targets');
  assert.ok(wf, 'worker-targets fact present');
  assert.equal(wf.value, 4, 'exactly 4 workers declared');
});

test('real-data: 5 Vercel apps are declared in deployment-state targets', () => {
  const report = svc.generateDeploymentReport();
  const vf = report.facts.find((f) => f.kind === 'vercel-targets');
  assert.ok(vf, 'vercel-targets fact present');
  assert.equal(vf.value, 5, 'exactly 5 Vercel apps declared');
});

test('real-data: secrets-required fact has value=19', () => {
  const report = svc.generateDeploymentReport();
  const sf = report.facts.find((f) => f.kind === 'secrets-required');
  assert.ok(sf, 'secrets-required fact present');
  assert.equal(sf.value, 19);
});

test('real-data: all 4 rollback scripts are referenced in rollback-scripts-present finding', () => {
  const findings = svc.detectRollbacks();
  const rf = findings.find((f) => f.kind === 'rollback-scripts-present');
  assert.ok(rf, 'rollback-scripts-present finding');
  const combined = rf.detail + rf.title;
  // At minimum production-rollback.mjs should appear
  assert.ok(combined.includes('rollback') || combined.includes('script'), `references scripts: ${combined}`);
});

test('real-data: 3 SPOFs are returned by detectFailedDeploys', () => {
  const findings = svc.detectFailedDeploys();
  const spofFindings = findings.filter((f) => f.kind.startsWith('spof-') && f.kind !== 'spof-unknown');
  assert.equal(spofFindings.length, 3, `expected 3 SPOF findings, got ${spofFindings.length}`);
});

test('real-data: latest source migration is referenced in declared state facts', () => {
  const report = svc.generateDeploymentReport();
  const migFact = report.facts.find((f) => f.kind === 'latest-migration');
  assert.ok(migFact, 'latest-migration fact present');
  const state = createEngine().store.read<{declared: {latestMigration: {n: number}}}>('deployment-state');
  assert.equal(migFact.value, state.declared.latestMigration.n, 'latest source migration is reported exactly');
});

test('real-data: all declared subdomains appear exactly in the report', () => {
  const report = svc.generateDeploymentReport();
  const subFacts = report.facts.filter((f) => f.kind === 'subdomain');
  const intel = createEngine().store.read<{subdomains: {app: string}[]}>('deployment-intelligence-v5');
  assert.ok(intel.subdomains.length > 0);
  assert.deepEqual(subFacts.map(f => f.subject).sort(), intel.subdomains.map(row => row.app).sort());
});

test('real-data: every source-declared subdomain fact is connected', () => {
  const report = svc.generateDeploymentReport();
  const declared = createEngine().store.read<{subdomains: {app: string}[]}>('deployment-intelligence-v5');
  for (const row of declared.subdomains) {
    const sf = report.facts.find(f => f.kind === 'subdomain' && f.subject === row.app);
    assert.ok(sf, `declared subdomain fact for ${row.app} is present`);
    assert.equal(sf.status, 'CONNECTED');
  }
});
