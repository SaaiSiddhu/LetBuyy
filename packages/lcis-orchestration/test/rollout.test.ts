/**
 * RolloutIntelligenceService tests — EAOS Phase 8.
 *
 * All tests use real createEngine() + real buildEngineeringPackage() under a FIXED clock.
 * Verifies:
 *  - launchVerdict ∈ {GO, CONDITIONAL_GO, NO_GO} matching pkg.blueprint.launch.decision.decision
 *  - rollbackReadiness matches pkg.blueprint.rollback.readiness (CONNECTED)
 *  - live rollout progress is NOT_CONNECTED + confidence 0
 *  - reuse citations to lcis-execution + lcis-operations present in evidence
 *  - provenance envelope (evidence, confidence, sources, timestamp, liveConnected)
 *  - determinism under fixed clock
 *  - read-only: no fetch, no writeFile, no spawn, no eval
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@letbuyy/lcis-core';
import { buildEngineeringPackage } from '../src/index';
import { RolloutIntelligenceService } from '../src/rollout/index';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIXED = '2026-06-21T00:00:00.000Z';
const engine = createEngine();
const svc = new RolloutIntelligenceService(engine, () => FIXED);

const VERDICTS = new Set(['GO', 'CONDITIONAL_GO', 'NO_GO'] as const);
const RB_READINESS = new Set(['READY', 'CONDITIONAL', 'NOT_READY'] as const);

// Helper: build a real pkg with fixed clock
async function makePkg(text: string) {
  return buildEngineeringPackage(engine, { text }, () => FIXED);
}

// ── 1. rolloutState ───────────────────────────────────────────────────────────

test('rolloutState: launchDecision matches blueprint.launch.decision.decision', async () => {
  const pkg = await makePkg('Build coupon engine');
  const state = svc.rolloutState(pkg);
  assert.equal(state.launchDecision, pkg.blueprint.launch.decision.decision);
});

test('rolloutState: rollbackReadiness matches blueprint.rollback.readiness', async () => {
  const pkg = await makePkg('Add GST invoice download');
  const state = svc.rolloutState(pkg);
  assert.equal(state.rollbackReadiness, pkg.blueprint.rollback.readiness);
});

test('rolloutState: composite decision is strictest of launch + rollback', async () => {
  const pkg = await makePkg('Implement webhook retry queue');
  const state = svc.rolloutState(pkg);
  assert.ok(VERDICTS.has(state.decision as 'GO' | 'CONDITIONAL_GO' | 'NO_GO'));
  // NO_GO if either is NO_GO/NOT_READY
  if (pkg.blueprint.launch.decision.decision === 'NO_GO' || pkg.blueprint.rollback.readiness === 'NOT_READY') {
    assert.equal(state.decision, 'NO_GO');
  }
});

test('rolloutState: liveConnected mirrors ops.liveConnected (always false)', async () => {
  const pkg = await makePkg('Add product import');
  const state = svc.rolloutState(pkg);
  assert.equal(state.liveConnected, pkg.blueprint.operations.liveConnected);
  assert.equal(state.liveConnected, false);
});

test('rolloutState: evidence contains reuse citations to lcis-execution and lcis-operations', async () => {
  const pkg = await makePkg('Multi-currency checkout');
  const state = svc.rolloutState(pkg);
  const sources = state.evidence.map((e) => e.source ?? '');
  assert.ok(sources.some((s) => s.includes('lcis-execution')), 'should cite lcis-execution');
  assert.ok(sources.some((s) => s.includes('lcis-operations')), 'should cite lcis-operations');
});

test('rolloutState: deterministic under fixed clock', async () => {
  const a = await makePkg('Build inventory transfer');
  const b = await makePkg('Build inventory transfer');
  assert.equal(svc.rolloutState(a).launchDecision, svc.rolloutState(b).launchDecision);
  assert.equal(svc.rolloutState(a).rollbackReadiness, svc.rolloutState(b).rollbackReadiness);
  assert.equal(svc.rolloutState(a).decision, svc.rolloutState(b).decision);
});

// ── 2. rolloutHealth ──────────────────────────────────────────────────────────

test('rolloutHealth: area is "rollout"', async () => {
  const pkg = await makePkg('Add staff permissions');
  const h = svc.rolloutHealth(pkg);
  assert.equal(h.area, 'rollout');
});

test('rolloutHealth: score is a number in 0..100', async () => {
  const pkg = await makePkg('Implement customer tags');
  const h = svc.rolloutHealth(pkg);
  assert.ok(h.score !== null);
  assert.ok((h.score as number) >= 0 && (h.score as number) <= 100);
});

test('rolloutHealth: band reflects score', async () => {
  const pkg = await makePkg('Add order notes');
  const h = svc.rolloutHealth(pkg);
  const validBands = new Set(['healthy', 'degraded', 'failing', 'unknown']);
  assert.ok(validBands.has(h.band));
});

test('rolloutHealth: notConnectedSignals > 0 (live metrics + live deploy progress)', async () => {
  const pkg = await makePkg('Build returns management');
  const h = svc.rolloutHealth(pkg);
  assert.ok(h.notConnectedSignals > 0, 'should have NOT_CONNECTED live signals');
});

test('rolloutHealth: connectedSignals > 0 (structural)', async () => {
  const pkg = await makePkg('Add payout scheduling');
  const h = svc.rolloutHealth(pkg);
  assert.ok(h.connectedSignals > 0, 'should have CONNECTED structural signals');
});

test('rolloutHealth: deterministic', async () => {
  const a = await makePkg('Build shipping label print');
  const b = await makePkg('Build shipping label print');
  assert.equal(svc.rolloutHealth(a).score, svc.rolloutHealth(b).score);
  assert.equal(svc.rolloutHealth(a).band, svc.rolloutHealth(b).band);
});

// ── 3. rolloutProgress ────────────────────────────────────────────────────────

test('rolloutProgress: connection is NOT_CONNECTED', async () => {
  const pkg = await makePkg('Add product variants');
  const p = svc.rolloutProgress(pkg);
  assert.equal(p.connection, 'NOT_CONNECTED');
});

test('rolloutProgress: completed is null (not fabricated)', async () => {
  const pkg = await makePkg('Build discount ladder');
  const p = svc.rolloutProgress(pkg);
  assert.equal(p.completed, null);
});

test('rolloutProgress: planned equals pkg.tasks.length (CONNECTED)', async () => {
  const pkg = await makePkg('Implement flash sale');
  const p = svc.rolloutProgress(pkg);
  assert.equal(p.planned, pkg.tasks.length);
});

test('rolloutProgress: liveSource is non-empty string naming the deploy source', async () => {
  const pkg = await makePkg('Add referral tracking');
  const p = svc.rolloutProgress(pkg);
  assert.ok(typeof p.liveSource === 'string' && p.liveSource.length > 0);
});

test('rolloutProgress: label is descriptive', async () => {
  const pkg = await makePkg('Add upsell flows');
  const p = svc.rolloutProgress(pkg);
  assert.ok(typeof p.label === 'string' && p.label.length > 0);
});

// ── 4. rollbackReadiness ─────────────────────────────────────────────────────

test('rollbackReadiness: readiness matches blueprint.rollback.readiness', async () => {
  const pkg = await makePkg('Add gift card bulk issue');
  const rb = svc.rollbackReadiness(pkg);
  assert.ok(RB_READINESS.has(rb.readiness));
  assert.equal(rb.readiness, pkg.blueprint.rollback.readiness);
});

test('rollbackReadiness: connection is CONNECTED', async () => {
  const pkg = await makePkg('Build PO receiving workflow');
  const rb = svc.rollbackReadiness(pkg);
  assert.equal(rb.connection, 'CONNECTED');
});

test('rollbackReadiness: irreversible array matches blueprint.rollback.irreversible length', async () => {
  const pkg = await makePkg('Add payment refund to gift card');
  const rb = svc.rollbackReadiness(pkg);
  assert.equal(rb.irreversible.length, pkg.blueprint.rollback.irreversible.length);
});

test('rollbackReadiness: evidence cites lcis-execution reuse', async () => {
  const pkg = await makePkg('Build cart abandonment recovery');
  const rb = svc.rollbackReadiness(pkg);
  const sources = rb.evidence.map((e) => e.source ?? '');
  assert.ok(sources.some((s) => s.includes('lcis-execution')));
});

test('rollbackReadiness: evidence ref contains the method name', async () => {
  const pkg = await makePkg('Add POS terminal support');
  const rb = svc.rollbackReadiness(pkg);
  assert.ok(rb.evidence.some((e) => typeof e.ref === 'string' && e.ref.includes('rollback')));
});

test('rollbackReadiness: irreversible items have subject and reason', async () => {
  const pkg = await makePkg('Add ledger reconciliation job');
  const rb = svc.rollbackReadiness(pkg);
  for (const item of rb.irreversible) {
    assert.ok(typeof item.subject === 'string');
    assert.ok(typeof item.reason === 'string');
  }
});

test('rollbackReadiness: deterministic', async () => {
  const a = await makePkg('Migrate product schema');
  const b = await makePkg('Migrate product schema');
  assert.equal(svc.rollbackReadiness(a).readiness, svc.rollbackReadiness(b).readiness);
  assert.equal(svc.rollbackReadiness(a).irreversible.length, svc.rollbackReadiness(b).irreversible.length);
});

// ── 5. launchBlockers ─────────────────────────────────────────────────────────

test('launchBlockers: returns an array', async () => {
  const pkg = await makePkg('Implement checkout extensions');
  const findings = svc.launchBlockers(pkg);
  assert.ok(Array.isArray(findings));
});

test('launchBlockers: all findings have category "rollout"', async () => {
  const pkg = await makePkg('Add custom domain setup flow');
  const findings = svc.launchBlockers(pkg);
  for (const f of findings) {
    assert.equal(f.category, 'rollout');
  }
});

test('launchBlockers: count >= pkg.blueprint.launch.blockers.length', async () => {
  const pkg = await makePkg('Build tax engine integration');
  const findings = svc.launchBlockers(pkg);
  assert.ok(findings.length >= pkg.blueprint.launch.blockers.length);
});

test('launchBlockers: launch-blocker findings cite lcis-execution', async () => {
  const pkg = await makePkg('Add international shipping zones');
  const findings = svc.launchBlockers(pkg);
  const launchFindings = findings.filter((f) => f.kind === 'launch-blocker');
  for (const f of launchFindings) {
    const sources = f.evidence.map((e) => e.source ?? '');
    assert.ok(sources.some((s) => s.includes('lcis-execution')), `finding ${f.id} must cite lcis-execution`);
  }
});

test('launchBlockers: ops-failing findings cite lcis-operations', async () => {
  const pkg = await makePkg('Add inventory forecasting');
  const findings = svc.launchBlockers(pkg);
  const opsFindings = findings.filter((f) => f.kind === 'ops-failing-at-launch');
  for (const f of opsFindings) {
    const sources = f.evidence.map((e) => e.source ?? '');
    assert.ok(sources.some((s) => s.includes('lcis-operations')), `finding ${f.id} must cite lcis-operations`);
  }
});

test('launchBlockers: ops-failing count equals ops.answers.failing.length', async () => {
  const pkg = await makePkg('Build product bundling');
  const findings = svc.launchBlockers(pkg);
  const opsCount = findings.filter((f) => f.kind === 'ops-failing-at-launch').length;
  assert.equal(opsCount, pkg.blueprint.operations.answers.failing.length);
});

test('launchBlockers: all findings have rule EO07', async () => {
  const pkg = await makePkg('Implement Razorpay payout routing');
  const findings = svc.launchBlockers(pkg);
  for (const f of findings) {
    assert.equal(f.rule, 'EO07');
  }
});

test('launchBlockers: all findings have connection CONNECTED', async () => {
  const pkg = await makePkg('Build loyalty points ledger');
  const findings = svc.launchBlockers(pkg);
  for (const f of findings) {
    assert.equal(f.connection, 'CONNECTED');
  }
});

test('launchBlockers: each finding has a unique id', async () => {
  const pkg = await makePkg('Add customer segmentation');
  const findings = svc.launchBlockers(pkg);
  const ids = findings.map((f) => f.id);
  assert.equal(ids.length, new Set(ids).size, 'finding ids must be unique');
});

test('launchBlockers: deterministic', async () => {
  const a = await makePkg('Build notification dispatch');
  const b = await makePkg('Build notification dispatch');
  const fa = svc.launchBlockers(a);
  const fb = svc.launchBlockers(b);
  assert.equal(fa.length, fb.length);
  fa.forEach((f, i) => assert.equal(f.id, fb[i]?.id));
});

// ── 6. releaseReadiness ───────────────────────────────────────────────────────

test('releaseReadiness: verdict ∈ {GO, CONDITIONAL_GO, NO_GO}', async () => {
  const pkg = await makePkg('Implement subscription billing');
  const r = svc.releaseReadiness(pkg);
  assert.ok(VERDICTS.has(r.verdict));
});

test('releaseReadiness: verdict NO_GO when launch is NO_GO', async () => {
  // Build a package and force NO_GO check via launch.decision.decision
  const pkg = await makePkg('Deploy full ERP migration');
  const r = svc.releaseReadiness(pkg);
  if (pkg.blueprint.launch.decision.decision === 'NO_GO') {
    assert.equal(r.verdict, 'NO_GO');
  }
});

test('releaseReadiness: verdict NO_GO when rollback is NOT_READY', async () => {
  const pkg = await makePkg('Remove legacy payment tables');
  const r = svc.releaseReadiness(pkg);
  if (pkg.blueprint.rollback.readiness === 'NOT_READY') {
    assert.equal(r.verdict, 'NO_GO');
  }
});

test('releaseReadiness: launchDecision matches pkg.blueprint.launch.decision.decision', async () => {
  const pkg = await makePkg('Add A/B test framework');
  const r = svc.releaseReadiness(pkg);
  assert.equal(r.launchDecision, pkg.blueprint.launch.decision.decision);
});

test('releaseReadiness: rollbackReadiness matches pkg.blueprint.rollback.readiness', async () => {
  const pkg = await makePkg('Build order export CSV');
  const r = svc.releaseReadiness(pkg);
  assert.equal(r.rollbackReadiness, pkg.blueprint.rollback.readiness);
});

test('releaseReadiness: packageDecision matches pkg.decision.verdict', async () => {
  const pkg = await makePkg('Build live chat integration');
  const r = svc.releaseReadiness(pkg);
  assert.equal(r.packageDecision, pkg.decision.verdict);
});

test('releaseReadiness: connection is CONNECTED', async () => {
  const pkg = await makePkg('Implement SEO sitemap');
  const r = svc.releaseReadiness(pkg);
  assert.equal(r.connection, 'CONNECTED');
});

test('releaseReadiness: evidence cites lcis-execution and lcis-engineering', async () => {
  const pkg = await makePkg('Build analytics dashboard');
  const r = svc.releaseReadiness(pkg);
  const sources = r.evidence.map((e) => e.source ?? '');
  assert.ok(sources.some((s) => s.includes('lcis-execution')));
  assert.ok(sources.some((s) => s.includes('lcis-engineering')));
});

test('releaseReadiness: rationale is a non-empty string', async () => {
  const pkg = await makePkg('Add multi-warehouse routing');
  const r = svc.releaseReadiness(pkg);
  assert.ok(typeof r.rationale === 'string' && r.rationale.length > 0);
});

test('releaseReadiness: deterministic', async () => {
  const a = await makePkg('Build search indexing');
  const b = await makePkg('Build search indexing');
  assert.equal(svc.releaseReadiness(a).verdict, svc.releaseReadiness(b).verdict);
  assert.equal(svc.releaseReadiness(a).launchDecision, svc.releaseReadiness(b).launchDecision);
});

// ── 7. generateRolloutReport ──────────────────────────────────────────────────

test('generateRolloutReport: returns RolloutReport shape', async () => {
  const pkg = await makePkg('Build theme customizer');
  const report = svc.generateRolloutReport(pkg);
  assert.ok(report.request);
  assert.ok(VERDICTS.has(report.launchVerdict));
  assert.ok(RB_READINESS.has(report.rollbackReadiness));
  assert.ok(Array.isArray(report.blockers));
  assert.ok(Array.isArray(report.findings));
  assert.ok(report.health);
  assert.ok(typeof report.summary === 'string');
});

test('generateRolloutReport: launchVerdict matches releaseReadiness.verdict', async () => {
  const pkg = await makePkg('Add mobile app push notifications');
  const report = svc.generateRolloutReport(pkg);
  const release = svc.releaseReadiness(pkg);
  assert.equal(report.launchVerdict, release.verdict);
});

test('generateRolloutReport: rollbackReadiness matches blueprint.rollback.readiness', async () => {
  const pkg = await makePkg('Implement email campaign manager');
  const report = svc.generateRolloutReport(pkg);
  assert.equal(report.rollbackReadiness, pkg.blueprint.rollback.readiness);
});

test('generateRolloutReport: liveConnected is false (mirrors ops)', async () => {
  const pkg = await makePkg('Build product review system');
  const report = svc.generateRolloutReport(pkg);
  assert.equal(report.liveConnected, false);
});

test('generateRolloutReport: confidence > 0 (has structural evidence)', async () => {
  const pkg = await makePkg('Add bulk product upload');
  const report = svc.generateRolloutReport(pkg);
  assert.ok(report.confidence > 0, 'confidence should be > 0 from structural evidence');
  assert.ok(report.confidence <= 0.9, 'confidence capped at 0.9 (no live data)');
});

test('generateRolloutReport: evidence contains NOT_CONNECTED entries for live signals', async () => {
  const pkg = await makePkg('Build affiliate partner portal');
  const report = svc.generateRolloutReport(pkg);
  const ncEntries = report.evidence.filter((e) => e.kind === 'not-connected');
  assert.ok(ncEntries.length >= 2, 'should have ≥2 NOT_CONNECTED evidence for deploy + metrics');
});

test('generateRolloutReport: evidence contains reuse citations to lcis-execution', async () => {
  const pkg = await makePkg('Add storefront theme switcher');
  const report = svc.generateRolloutReport(pkg);
  const sources = report.evidence.map((e) => e.source ?? '');
  assert.ok(sources.some((s) => s.includes('lcis-execution')));
});

test('generateRolloutReport: evidence contains reuse citations to lcis-operations', async () => {
  const pkg = await makePkg('Add digital product delivery');
  const report = svc.generateRolloutReport(pkg);
  const sources = report.evidence.map((e) => e.source ?? '');
  assert.ok(sources.some((s) => s.includes('lcis-operations')));
});

test('generateRolloutReport: timestamp is the fixed ISO date', async () => {
  const pkg = await makePkg('Build supplier invoice matching');
  const report = svc.generateRolloutReport(pkg);
  assert.equal(report.timestamp, FIXED);
});

test('generateRolloutReport: sources is non-empty', async () => {
  const pkg = await makePkg('Add customer loyalty tiers');
  const report = svc.generateRolloutReport(pkg);
  assert.ok(Array.isArray(report.sources) && report.sources.length > 0);
});

test('generateRolloutReport: summary mentions NOT_CONNECTED for live signals', async () => {
  const pkg = await makePkg('Build smart pricing rules');
  const report = svc.generateRolloutReport(pkg);
  assert.ok(report.summary.includes('NOT_CONNECTED'), 'summary must surface NOT_CONNECTED honesty');
});

test('generateRolloutReport: health area is "rollout"', async () => {
  const pkg = await makePkg('Implement order splitting');
  const report = svc.generateRolloutReport(pkg);
  assert.equal(report.health.area, 'rollout');
});

test('generateRolloutReport: blockers count >= launch blockers count', async () => {
  const pkg = await makePkg('Add Razorpay international gateway');
  const report = svc.generateRolloutReport(pkg);
  assert.ok(report.blockers.length >= pkg.blueprint.launch.blockers.length);
});

test('generateRolloutReport: deterministic under fixed clock', async () => {
  const a = await makePkg('Build SLA monitoring dashboard');
  const b = await makePkg('Build SLA monitoring dashboard');
  const ra = svc.generateRolloutReport(a);
  const rb = svc.generateRolloutReport(b);
  assert.equal(ra.launchVerdict, rb.launchVerdict);
  assert.equal(ra.rollbackReadiness, rb.rollbackReadiness);
  assert.equal(ra.timestamp, rb.timestamp);
  assert.equal(ra.confidence, rb.confidence);
  assert.equal(ra.blockers.length, rb.blockers.length);
});

// ── 8. Read-only scan — no forbidden patterns ─────────────────────────────────

test('read-only contract: service source has no fetch/spawn/exec/eval/writeFile/network calls', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(
    new URL('../src/rollout/RolloutIntelligenceService.ts', import.meta.url),
    'utf8',
  );
  // Strip comments to avoid false positives
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const forbidden = [/\bfetch\s*\(/, /\bspawn\s*\(/, /\bexec\s*\(/, /\beval\s*\(/, /\bwriteFile\s*\(/, /\brequire\s*\('node:net'\)/];
  for (const pat of forbidden) {
    assert.ok(!pat.test(stripped), `forbidden pattern ${pat} found in service source`);
  }
});
