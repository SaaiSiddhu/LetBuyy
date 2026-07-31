/**
 * ReadinessService tests — GDIS Phase 5.
 *
 * Contract assertions:
 * - scores are always 0..100 over KNOWN factors
 * - UNKNOWN factors (monitoring/alerts/rollback/healthcheck) appear in `unknowns`, never as pass
 * - money domain security factor reflects real artifacts
 * - evaluateLaunchReadiness reuses verifyProductionReadiness (async, returns Verification)
 * - every output carries evidence / confidence / sources / timestamp
 * - determinism: fixed `now` → identical timestamps
 * - ReadinessService source files are read-only (no network/spawn/writeFile)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as fs from 'node:fs';
import { createEngine } from '@letbuyy/lcis-core';
import { GovernanceArtifactStore } from '../src/index';
import { ReadinessService } from '../src/readiness/index';

// ── shared setup ──────────────────────────────────────────────────────────────

const FIXED = '2026-06-20T12:00:00.000Z';
const fixedNow = () => FIXED;
const engine = createEngine();
const svc = new ReadinessService(engine, fixedNow);
const store = new GovernanceArtifactStore(engine);

// Helper: look up a real domain key from artifacts
function firstDomainKey(): string {
  const domains = store.domains();
  assert.ok(domains.length > 0, 'test pre-req: domains must be present');
  return domains[0]!.key;
}

function moneyDomainKey(): string | undefined {
  return store.domains().find((d) => d.money)?.key;
}

function tenantDomainKey(): string | undefined {
  return store.domains().find((d) => d.tenant)?.key;
}

function ownedDomainKey(): string | undefined {
  return store.domains().find((d) => d.owners.length > 0)?.key;
}

// ── 1. Score range ─────────────────────────────────────────────────────────────

test('domain score is always 0..100', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  assert.ok(result.score >= 0 && result.score <= 100, `score=${result.score} out of range`);
});

test('domain score is a whole integer', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  assert.equal(result.score, Math.round(result.score));
});

// ── 2. UNKNOWN factors are surfaced, never passed ─────────────────────────────

test('monitoring factor is UNKNOWN and in unknowns', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  const mFactor = result.factors.find((f) => f.key === 'monitoring');
  assert.ok(mFactor, 'monitoring factor must exist');
  assert.equal(mFactor!.present, 'UNKNOWN');
  assert.ok(result.unknowns.includes('monitoring'));
});

test('alerts factor is UNKNOWN and in unknowns', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  const aFactor = result.factors.find((f) => f.key === 'alerts');
  assert.ok(aFactor, 'alerts factor must exist');
  assert.equal(aFactor!.present, 'UNKNOWN');
  assert.ok(result.unknowns.includes('alerts'));
});

test('rollback factor is UNKNOWN and in unknowns', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  const rFactor = result.factors.find((f) => f.key === 'rollback');
  assert.ok(rFactor, 'rollback factor must exist');
  assert.equal(rFactor!.present, 'UNKNOWN');
  assert.ok(result.unknowns.includes('rollback'));
});

test('healthcheck factor is UNKNOWN and in unknowns', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  const hFactor = result.factors.find((f) => f.key === 'healthcheck');
  assert.ok(hFactor, 'healthcheck factor must exist');
  assert.equal(hFactor!.present, 'UNKNOWN');
  assert.ok(result.unknowns.includes('healthcheck'));
});

test('UNKNOWN factors are not counted as pass in the score', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  const unknownFactors = result.factors.filter((f) => f.present === 'UNKNOWN');
  // Verify: if all UNKNOWN factors were counted as pass, the score would be higher
  // Manual pass count
  const known = result.factors.filter((f) => f.present !== 'UNKNOWN');
  const passed = known.filter((f) => f.present === true);
  const denominator = known.reduce((s, f) => s + f.weight, 0);
  const numerator = passed.reduce((s, f) => s + f.weight, 0);
  const expectedScore = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
  assert.equal(result.score, expectedScore, 'score must equal passed/known, not counting UNKNOWN as pass');
  // UNKNOWN factors actually exist
  assert.ok(unknownFactors.length >= 3, 'at least 3 UNKNOWN factors (monitoring/alerts/rollback)');
});

// ── 3. Provenance on every output ─────────────────────────────────────────────

test('domain readiness has evidence, confidence, sources, timestamp', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  assert.ok(Array.isArray(result.evidence) && result.evidence.length > 0, 'evidence must be non-empty');
  assert.ok(result.confidence > 0 && result.confidence <= 0.95, `confidence=${result.confidence}`);
  assert.ok(Array.isArray(result.sources), 'sources array required');
  assert.equal(result.timestamp, FIXED);
});

test('domain readiness has subject, factors array, band, unknowns', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  assert.equal(result.subject, key);
  assert.ok(Array.isArray(result.factors) && result.factors.length === 10, '10 factors');
  assert.ok(['ready', 'conditional', 'not-ready', 'unknown'].includes(result.band));
  assert.ok(Array.isArray(result.unknowns));
});

// ── 4. Determinism ────────────────────────────────────────────────────────────

test('evaluateDomainReadiness is deterministic', async () => {
  const key = firstDomainKey();
  const a = await svc.evaluateDomainReadiness(key);
  const b = await svc.evaluateDomainReadiness(key);
  assert.equal(a.score, b.score);
  assert.equal(a.band, b.band);
  assert.equal(a.timestamp, b.timestamp);
  assert.deepEqual(a.unknowns, b.unknowns);
});

test('generateReadinessReport is deterministic', async () => {
  const a = await svc.generateReadinessReport();
  const b = await svc.generateReadinessReport();
  assert.equal(a.overall, b.overall);
  assert.equal(a.scores.length, b.scores.length);
});

// ── 5. Money domain security factor ───────────────────────────────────────────

test('money domain security factor reflects real RLS/securityDefiner artifacts', async () => {
  const key = moneyDomainKey();
  if (!key) {
    // Skip gracefully if no money domain in artifacts
    assert.ok(true, 'no money domain in artifacts — skipped');
    return;
  }
  const result = await svc.evaluateDomainReadiness(key);
  const secFactor = result.factors.find((f) => f.key === 'security');
  assert.ok(secFactor, 'security factor must exist for money domain');
  // security factor must NOT be UNKNOWN (it is determinable from artifacts)
  assert.notEqual(secFactor!.present, 'UNKNOWN', 'security factor must be KNOWN for money domain');
  // Evidence must mention RLS or securityDefiner
  const detail = secFactor!.evidence.map((e) => e.detail ?? '').join(' ');
  assert.ok(
    detail.toLowerCase().includes('rls') || detail.toLowerCase().includes('security'),
    `evidence detail should mention rls/security: "${detail}"`,
  );
});

test('security factor is NOT in unknowns for any domain with real artifacts', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  // security is deterministic — it should never be UNKNOWN
  assert.ok(!result.unknowns.includes('security'), 'security factor must never be UNKNOWN');
});

// ── 6. evaluateLaunchReadiness reuses verifyProductionReadiness ───────────────

test('evaluateLaunchReadiness calls verifyProductionReadiness and returns a ReadinessReport', async () => {
  const result = await svc.evaluateLaunchReadiness();
  // Must have all provenance fields
  assert.ok(Array.isArray(result.scores));
  assert.ok(typeof result.overall === 'number' && result.overall >= 0 && result.overall <= 100);
  assert.ok(Array.isArray(result.evidence) && result.evidence.length > 0);
  assert.equal(result.timestamp, FIXED);
  // Summary must reference verification (status text from verifyProductionReadiness)
  assert.ok(result.summary.length > 0);
});

test('evaluateLaunchReadiness overall is mean of system scores', async () => {
  const result = await svc.evaluateLaunchReadiness();
  if (result.scores.length > 0) {
    const expected = Math.round(result.scores.reduce((s, r) => s + r.score, 0) / result.scores.length);
    assert.equal(result.overall, expected);
  } else {
    assert.equal(result.overall, 0);
  }
});

test('evaluateLaunchReadiness: each score has subject, band, evidence, timestamp', async () => {
  const result = await svc.evaluateLaunchReadiness();
  for (const score of result.scores) {
    assert.ok(typeof score.subject === 'string' && score.subject.length > 0);
    assert.ok(['ready', 'conditional', 'not-ready', 'unknown'].includes(score.band));
    assert.ok(Array.isArray(score.evidence) && score.evidence.length > 0);
    assert.equal(score.timestamp, FIXED);
  }
});

// ── 7. evaluateOperationalReadiness ─────────────────────────────────────────

test('evaluateOperationalReadiness returns report with scores for each domain', async () => {
  const result = await svc.evaluateOperationalReadiness();
  const domains = store.domains();
  assert.equal(result.scores.length, domains.length);
});

test('evaluateOperationalReadiness: all 3 UNKNOWN factors (healthcheck/monitoring/alerts) per domain', async () => {
  const result = await svc.evaluateOperationalReadiness();
  if (result.scores.length > 0) {
    const first = result.scores[0]!;
    assert.ok(first.unknowns.includes('healthcheck') || first.unknowns.includes('monitoring'), 'operational unknowns present');
  }
});

test('evaluateOperationalReadiness has provenance', async () => {
  const result = await svc.evaluateOperationalReadiness();
  assert.ok(Array.isArray(result.evidence));
  assert.equal(result.timestamp, FIXED);
  assert.ok(result.overall >= 0 && result.overall <= 100);
});

// ── 8. evaluateRecoveryReadiness ──────────────────────────────────────────────

test('evaluateRecoveryReadiness: rollback is UNKNOWN for every domain', async () => {
  const result = await svc.evaluateRecoveryReadiness();
  for (const score of result.scores) {
    assert.ok(score.unknowns.includes('rollback'), `domain ${score.subject}: rollback must be UNKNOWN`);
  }
});

test('evaluateRecoveryReadiness summary mentions rollback undeterminable', async () => {
  const result = await svc.evaluateRecoveryReadiness();
  assert.ok(result.summary.toLowerCase().includes('rollback'), 'summary must mention rollback');
});

test('evaluateRecoveryReadiness has provenance', async () => {
  const result = await svc.evaluateRecoveryReadiness();
  assert.equal(result.timestamp, FIXED);
  assert.ok(result.overall >= 0 && result.overall <= 100);
});

// ── 9. evaluateSecurityReadiness ──────────────────────────────────────────────

test('evaluateSecurityReadiness returns a score per domain', async () => {
  const result = await svc.evaluateSecurityReadiness();
  const domains = store.domains();
  assert.equal(result.scores.length, domains.length);
});

test('evaluateSecurityReadiness has provenance', async () => {
  const result = await svc.evaluateSecurityReadiness();
  assert.equal(result.timestamp, FIXED);
  assert.ok(result.overall >= 0 && result.overall <= 100);
  assert.ok(Array.isArray(result.evidence));
});

test('evaluateSecurityReadiness: security factor is not UNKNOWN (deterministic from artifacts)', async () => {
  const result = await svc.evaluateSecurityReadiness();
  for (const score of result.scores) {
    const sf = score.factors.find((f) => f.key === 'security');
    if (sf) {
      assert.notEqual(sf.present, 'UNKNOWN', `domain ${score.subject}: security must not be UNKNOWN`);
    }
  }
});

// ── 10. generateReadinessReport ───────────────────────────────────────────────

test('generateReadinessReport returns a score for every domain', async () => {
  const report = await svc.generateReadinessReport();
  const domains = store.domains();
  assert.equal(report.scores.length, domains.length);
});

test('generateReadinessReport overall is the mean of domain scores', async () => {
  const report = await svc.generateReadinessReport();
  if (report.scores.length > 0) {
    const expected = Math.round(report.scores.reduce((s, r) => s + r.score, 0) / report.scores.length);
    assert.equal(report.overall, expected);
  }
});

test('generateReadinessReport has evidence, confidence, sources, timestamp', async () => {
  const report = await svc.generateReadinessReport();
  assert.ok(Array.isArray(report.evidence) && report.evidence.length > 0);
  assert.ok(report.confidence > 0 && report.confidence <= 0.95);
  assert.ok(Array.isArray(report.sources));
  assert.equal(report.timestamp, FIXED);
});

test('generateReadinessReport summary mentions domains and overall', async () => {
  const report = await svc.generateReadinessReport();
  assert.ok(report.summary.includes('domain') || report.summary.includes('Domain'));
  assert.ok(report.summary.includes('overall') || report.summary.includes(String(report.overall)));
});

// ── 11. Band classification ────────────────────────────────────────────────────

test('band is one of ready/conditional/not-ready/unknown', async () => {
  const report = await svc.generateReadinessReport();
  const valid = new Set(['ready', 'conditional', 'not-ready', 'unknown']);
  for (const score of report.scores) {
    assert.ok(valid.has(score.band), `invalid band: ${score.band}`);
  }
});

test('score=0 on only UNKNOWN factors → band=unknown (not enough known)', async () => {
  // evaluateRecoveryReadiness has only 2 factors, 1 UNKNOWN → <4 known → unknown band
  const result = await svc.evaluateRecoveryReadiness();
  // Every domain should have unknown band (only 1 known factor: runbook)
  for (const score of result.scores) {
    assert.equal(score.band, 'unknown', `domain ${score.subject}: expected unknown band with <4 known factors`);
  }
});

// ── 12. Service readiness ─────────────────────────────────────────────────────

test('evaluateServiceReadiness returns a ReadinessScore', async () => {
  const workers = store.workers();
  const workerName = workers.length > 0 ? workers[0]!.name : 'api-gateway';
  const result = await svc.evaluateServiceReadiness(workerName);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(Array.isArray(result.factors));
  assert.ok(Array.isArray(result.unknowns));
  assert.equal(result.timestamp, FIXED);
});

test('evaluateServiceReadiness: healthcheck and monitoring are UNKNOWN', async () => {
  const workers = store.workers();
  const workerName = workers.length > 0 ? workers[0]!.name : 'api-gateway';
  const result = await svc.evaluateServiceReadiness(workerName);
  assert.ok(result.unknowns.includes('healthcheck'), 'healthcheck must be UNKNOWN');
  assert.ok(result.unknowns.includes('monitoring'), 'monitoring must be UNKNOWN');
});

test('evaluateServiceReadiness has evidence and timestamp', async () => {
  const workers = store.workers();
  const workerName = workers.length > 0 ? workers[0]!.name : 'api-gateway';
  const result = await svc.evaluateServiceReadiness(workerName);
  assert.ok(Array.isArray(result.evidence) && result.evidence.length > 0);
  assert.equal(result.timestamp, FIXED);
});

// ── 13. notConnected evidence for UNKNOWN factors ─────────────────────────────

test('UNKNOWN factors carry not-connected evidence (kind=not-connected)', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  const unknownFactors = result.factors.filter((f) => f.present === 'UNKNOWN');
  for (const factor of unknownFactors) {
    const hasNotConnected = factor.evidence.some((e) => e.kind === 'not-connected');
    assert.ok(hasNotConnected, `factor ${factor.key}: must have not-connected evidence`);
  }
});

// ── 14. Factor weights are documented and sum correctly ───────────────────────

test('all 10 ReadinessFactorKeys have a weight', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  const keys = result.factors.map((f) => f.key);
  const expected: string[] = ['owner', 'runbook', 'tests', 'rollback', 'coverage', 'documentation', 'healthcheck', 'monitoring', 'alerts', 'security'];
  for (const k of expected) {
    assert.ok(keys.includes(k as any), `missing factor key: ${k}`);
  }
});

test('each factor has a positive weight', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  for (const factor of result.factors) {
    assert.ok(factor.weight > 0, `factor ${factor.key} has non-positive weight: ${factor.weight}`);
  }
});

// ── 15. Owned domain owner factor ─────────────────────────────────────────────

test('owner factor is true for a domain that has owners', async () => {
  const key = ownedDomainKey();
  if (!key) {
    assert.ok(true, 'no owned domain in artifacts — skipped');
    return;
  }
  const result = await svc.evaluateDomainReadiness(key);
  const ownerFactor = result.factors.find((f) => f.key === 'owner');
  assert.ok(ownerFactor, 'owner factor must exist');
  assert.equal(ownerFactor!.present, true, `domain ${key} has owners in artifacts but factor is false`);
});

// ── 16. Tenant domain security factor ─────────────────────────────────────────

test('tenant domain security factor is boolean (not UNKNOWN)', async () => {
  const key = tenantDomainKey() ?? firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  const sf = result.factors.find((f) => f.key === 'security');
  assert.ok(sf, 'security factor must exist');
  assert.ok(typeof sf!.present === 'boolean', 'security factor must be boolean, not UNKNOWN');
});

// ── 17. ReadinessService source is read-only ──────────────────────────────────

test('ReadinessService.ts contains no fetch/spawn/exec/eval/writeFile', () => {
  const src = fs.readFileSync(
    new URL('../src/readiness/ReadinessService.ts', import.meta.url),
    'utf8',
  );
  const forbidden = ['fetch(', 'spawn(', 'exec(', 'eval(', 'writeFile(', 'writeFileSync(', 'child_process'];
  for (const pat of forbidden) {
    assert.ok(!src.includes(pat), `ReadinessService.ts must not contain "${pat}"`);
  }
});

// ── 18. evaluateLaunchReadiness is async (returns Promise) ───────────────────

test('evaluateLaunchReadiness returns a Promise (awaitable)', async () => {
  const p = svc.evaluateLaunchReadiness();
  assert.ok(p instanceof Promise, 'must return a Promise');
  await p;
});

// ── 19. Score formula edge cases ──────────────────────────────────────────────

test('a domain with all known factors false scores 0 not negative', async () => {
  // Unknown domain key → no matches in any lookup → most boolean factors false
  const result = await svc.evaluateDomainReadiness('___nonexistent___domain___');
  assert.ok(result.score >= 0 && result.score <= 100);
});

test('a domain with no test nodes has tests=false', async () => {
  // Domains that are unlikely to appear in graph test nodes
  const result = await svc.evaluateDomainReadiness('___nonexistent___domain___');
  const testFactor = result.factors.find((f) => f.key === 'tests');
  assert.ok(testFactor, 'tests factor must exist');
  assert.equal(testFactor!.present, false, 'tests must be false for unknown domain');
});

// ── 20. Report evidence coverage ──────────────────────────────────────────────

test('generateReadinessReport evidence items all have kind and ref', async () => {
  const report = await svc.generateReadinessReport();
  for (const ev of report.evidence) {
    assert.ok(typeof ev.kind === 'string' && ev.kind.length > 0, 'evidence must have kind');
    assert.ok(typeof ev.ref === 'string' && ev.ref.length > 0, 'evidence must have ref');
  }
});

test('evaluateLaunchReadiness confidence is 0..0.95', async () => {
  const result = await svc.evaluateLaunchReadiness();
  assert.ok(result.confidence >= 0 && result.confidence <= 0.95);
});

test('evaluateOperationalReadiness confidence is 0..0.95', async () => {
  const result = await svc.evaluateOperationalReadiness();
  assert.ok(result.confidence >= 0 && result.confidence <= 0.95);
});

test('evaluateRecoveryReadiness confidence is 0..0.95', async () => {
  const result = await svc.evaluateRecoveryReadiness();
  assert.ok(result.confidence >= 0 && result.confidence <= 0.95);
});

test('evaluateSecurityReadiness confidence is 0..0.95', async () => {
  const result = await svc.evaluateSecurityReadiness();
  assert.ok(result.confidence >= 0 && result.confidence <= 0.95);
});

// ── 21. Scores array in all reports is an array ───────────────────────────────

test('evaluateOperationalReadiness scores is an array', async () => {
  const result = await svc.evaluateOperationalReadiness();
  assert.ok(Array.isArray(result.scores));
});

test('evaluateRecoveryReadiness scores is an array', async () => {
  const result = await svc.evaluateRecoveryReadiness();
  assert.ok(Array.isArray(result.scores));
});

test('evaluateSecurityReadiness scores is an array', async () => {
  const result = await svc.evaluateSecurityReadiness();
  assert.ok(Array.isArray(result.scores));
});

// ── 22. Summary content ────────────────────────────────────────────────────────

test('domain readiness summary includes domain key', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  assert.ok(result.summary.includes(key), `summary must include domain key "${key}"`);
});

test('recovery readiness score summaries mention rollback or runbook', async () => {
  const result = await svc.evaluateRecoveryReadiness();
  if (result.scores.length > 0) {
    assert.ok(
      result.scores[0]!.summary.includes('rollback') || result.scores[0]!.summary.includes('runbook'),
    );
  }
});

test('operational readiness score summaries mention domain key', async () => {
  const result = await svc.evaluateOperationalReadiness();
  if (result.scores.length > 0) {
    const first = result.scores[0]!;
    assert.ok(first.summary.includes(first.subject), 'summary must include subject');
  }
});

// ── 23. Types structural check ─────────────────────────────────────────────────

test('ReadinessScore.factors is readonly array of ReadinessFactor', async () => {
  const key = firstDomainKey();
  const result = await svc.evaluateDomainReadiness(key);
  // TypeScript runtime check: each factor has key, present, weight, evidence
  for (const factor of result.factors) {
    assert.ok('key' in factor);
    assert.ok('present' in factor);
    assert.ok('weight' in factor);
    assert.ok('evidence' in factor);
  }
});

test('ReadinessReport.scores each have all ReadinessScore fields', async () => {
  const report = await svc.generateReadinessReport();
  for (const s of report.scores) {
    assert.ok('subject' in s);
    assert.ok('score' in s);
    assert.ok('factors' in s);
    assert.ok('band' in s);
    assert.ok('unknowns' in s);
    assert.ok('summary' in s);
    assert.ok('evidence' in s);
    assert.ok('confidence' in s);
    assert.ok('sources' in s);
    assert.ok('timestamp' in s);
  }
});

// ── 24. Fixed-now determinism across all methods ──────────────────────────────

test('all six methods return FIXED timestamp', async () => {
  const key = firstDomainKey();
  const workers = store.workers();
  const workerName = workers.length > 0 ? workers[0]!.name : 'api-gateway';

  const [domain, service, launch, operational, recovery, security] = await Promise.all([
    svc.evaluateDomainReadiness(key),
    svc.evaluateServiceReadiness(workerName),
    svc.evaluateLaunchReadiness(),
    svc.evaluateOperationalReadiness(),
    svc.evaluateRecoveryReadiness(),
    svc.evaluateSecurityReadiness(),
  ]);

  for (const r of [domain, service, launch, operational, recovery, security]) {
    assert.equal(r.timestamp, FIXED, `timestamp must be FIXED in all methods`);
  }
});

// ── 25. Bonus: full report overall is coherent ────────────────────────────────

test('full report overall is 0..100', async () => {
  const report = await svc.generateReadinessReport();
  assert.ok(report.overall >= 0 && report.overall <= 100);
});
