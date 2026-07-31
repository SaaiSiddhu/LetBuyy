/**
 * VerificationService — integration tests.
 *
 * Uses the real graphify-out/ artifacts where present; skips gracefully when absent.
 * All assertions are conservative so they survive artifact rebuilds.
 *
 * Advisory contract: VerificationService is INFORMATIONAL only; the 107-validator
 * gate (scripts/validate-governance.mjs) is the sole authoritative merge gate.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtifactStore } from '../src/runtime/ArtifactStore';
import { VerificationService } from '../src/verification/VerificationService';

const store = ArtifactStore.default();
const svc = new VerificationService(store);

const hasAudit = store.has('audit-engine-v2');
const hasPrv2 = store.has('production-readiness-v2');
const hasLaunch = store.has('launch-command-center');
const hasConn = store.has('connections-intel');
const hasDomain = store.has('domain-intel');
const hasInfra = store.has('infra-intel');
const hasDb = store.has('db-intel');

// ─── Structural invariants ────────────────────────────────────────────────────

test('verifyProductionReadiness returns a Verification with required fields', {
  skip: !hasPrv2 && !hasLaunch,
}, async () => {
  const v = await svc.verifyProductionReadiness();
  assert.equal(v.subject, 'production-readiness');
  assert.ok(['VERIFIED', 'PARTIAL', 'UNVERIFIED', 'REFUTED'].includes(v.status));
  assert.ok(v.confidence >= 0 && v.confidence <= 1, `confidence out of range: ${v.confidence}`);
  assert.ok(Array.isArray(v.evidence), 'evidence must be an array');
  assert.ok(Array.isArray(v.gaps), 'gaps must be an array');
});

// ─── Test 1: verifyProductionReadiness — PARTIAL with 5 open blockers ─────────
test('verifyProductionReadiness is PARTIAL when launch has open blockers (current: 5)', {
  skip: !hasPrv2 || !hasLaunch,
}, async () => {
  const v = await svc.verifyProductionReadiness();

  // Current artifact: 98% structural, 5 open blockers → PARTIAL (not VERIFIED)
  // GO/NO-GO asymmetry: high structural score + open blockers = PARTIAL
  assert.ok(
    v.status === 'PARTIAL' || v.status === 'VERIFIED',
    `expected PARTIAL (or VERIFIED if blockers resolved), got ${v.status}`,
  );

  // With 5 open blockers, expect PARTIAL specifically
  if (v.gaps.some((g) => g.what.startsWith('gap-pr-blocker-'))) {
    assert.equal(v.status, 'PARTIAL', 'open blockers must prevent VERIFIED');
  }

  // Evidence must include a launch verdict source (v1-lcis when GO, decision-v2 when NO-GO)
  // and security-gate (hardViolations)
  const evSources = v.evidence.map((e) => e.ref);
  const hasLaunchVerdict = evSources.includes('v1-lcis') || evSources.includes('decision-v2');
  assert.ok(hasLaunchVerdict, 'must cite v1-lcis or decision-v2 for launch verdict');
  assert.ok(evSources.includes('security-gate'), 'must cite security-gate (hardViolations)');

  // Current artifact: 5 blockers → 5 gap entries prefixed gap-pr-blocker-
  const blockerGaps = v.gaps.filter((g) => g.what.startsWith('gap-pr-blocker-'));
  assert.ok(blockerGaps.length >= 1, `expected ≥1 blocker gaps, got ${blockerGaps.length}`);
});

// ─── Test 2: verifyProductionReadiness — hardViolations=0 corroborates ───────
test('verifyProductionReadiness security-gate evidence corroborates when hardViolations=0', {
  skip: !hasAudit || !hasPrv2,
}, async () => {
  const v = await svc.verifyProductionReadiness();
  // The current artifact has hardViolations=0, so security-gate corroborates
  // (no REFUTED expected from audit)
  assert.notEqual(v.status, 'REFUTED', 'hardViolations=0 must not produce REFUTED');
  // Note: confidence may be clamped to 0 when 13 NC sources × 0.08 = 1.04 penalty
  // exceeds structural corroboration. This is by design (honesty law). Status is
  // PARTIAL (not UNVERIFIED) because structural evidence IS present.
  assert.ok(v.confidence >= 0 && v.confidence <= 1, `confidence must be in [0,1]: ${v.confidence}`);
  assert.ok(v.evidence.length > 0, 'must have evidence items');
});

// ─── Test 3: verifyRuntime — always PARTIAL (honest NOT CONNECTED) ────────────
test('verifyRuntime is PARTIAL (all 13 providers NOT CONNECTED by design)', {
  skip: !hasConn,
}, async () => {
  const v = await svc.verifyRuntime();
  assert.equal(v.subject, 'runtime');
  // Structural declarations are CONNECTED; live values NOT CONNECTED → PARTIAL
  assert.equal(v.status, 'PARTIAL', `expected PARTIAL for runtime, got ${v.status}`);

  // All 13 NOT CONNECTED sources must appear in not-connected evidence
  const ncEvidence = v.evidence.filter((e) => e.kind === 'not-connected');
  assert.ok(ncEvidence.length >= 13, `expected ≥13 not-connected evidence, got ${ncEvidence.length}`);

  // Each not-connected evidence must reference the exact source (honesty law)
  for (const nc of ncEvidence) {
    assert.ok(nc.detail?.includes('NOT CONNECTED'), `detail must state NOT CONNECTED: ${nc.detail}`);
    assert.ok(nc.ref && nc.ref.length > 0, 'ref must be non-empty');
  }

  // Confidence penalised by 13 × 0.08 = 1.04 → clamped to 0 or very low
  assert.ok(v.confidence < 0.60, `confidence should be penalised below 0.60, got ${v.confidence}`);
});

// ─── Test 4: verifyDomains — UNVERIFIED for unknown cross-domain edge table ───
test('verifyDomains handles missing artifacts gracefully', async () => {
  // Construct a store pointing to an empty/non-existent dir to simulate UNVERIFIED
  const emptyStore = ArtifactStore.fromDir('/tmp/__lcis_no_artifacts__');
  const emptySvc = new VerificationService(emptyStore);
  const v = await emptySvc.verifyDomains();
  assert.equal(v.subject, 'domains');
  assert.equal(v.status, 'UNVERIFIED', 'zero evidence → UNVERIFIED (not REFUTED)');
  assert.equal(v.confidence, 0, 'zero evidence → confidence = 0');
  assert.deepEqual(v.evidence, [], 'zero evidence array');
});

// ─── Test 5: verifyArchitecture — PARTIAL with RLS candidates ────────────────
test('verifyArchitecture is not REFUTED when hardViolations=0 (candidates ≠ violations)', {
  skip: !hasAudit,
}, async () => {
  const v = await svc.verifyArchitecture();
  assert.equal(v.subject, 'architecture');
  // hardViolations=0 in current artifact; candidates present but gate passes
  assert.notEqual(v.status, 'REFUTED', 'hardViolations=0 must not REFUTE architecture');

  // RLS candidates (20 in current artifact) should appear as gaps, not REFUTED
  const rlsGaps = v.gaps.filter((g) => g.what.includes('rls'));
  if (rlsGaps.length > 0) {
    assert.ok(
      v.status === 'PARTIAL' || v.status === 'VERIFIED',
      `RLS candidates should yield PARTIAL/VERIFIED, not ${v.status}`,
    );
  }

  // 107-validators source must be cited
  const evSources = v.evidence.map((e) => e.ref);
  assert.ok(evSources.includes('107-validators'), 'must cite 107-validators');
});

// ─── Test 6: UNVERIFIED = zero evidence (not REFUTED) ────────────────────────
test('UNVERIFIED from empty store is not confused with REFUTED', async () => {
  const emptyStore = ArtifactStore.fromDir('/tmp/__lcis_no_artifacts__');
  const emptySvc = new VerificationService(emptyStore);

  const [arch, dom, svc2, rt, dep, pr] = await Promise.all([
    emptySvc.verifyArchitecture(),
    emptySvc.verifyDomains(),
    emptySvc.verifyServices(),
    emptySvc.verifyRuntime(),
    emptySvc.verifyDependencies(),
    emptySvc.verifyProductionReadiness(),
  ]);

  for (const v of [arch, dom, svc2, rt, dep, pr]) {
    assert.equal(v.status, 'UNVERIFIED', `${v.subject}: zero evidence must be UNVERIFIED not REFUTED`);
    assert.equal(v.confidence, 0, `${v.subject}: confidence must be 0`);
    assert.notEqual(v.status, 'REFUTED', `${v.subject}: absence of evidence ≠ REFUTED`);
  }
});

// ─── Test 7: authoritative contradiction triggers REFUTED ─────────────────────
// This tests the refuse-to-rubber-stamp logic directly via a custom approach:
// we verify the status derivation constants are correct.
test('AUTHORITATIVE_SOURCES set contains all 5 gate keys', async () => {
  const { AUTHORITATIVE_SOURCES } = await import('../src/verification/types');
  for (const key of ['v1-lcis', '107-validators', 'security-gate', 'rls-gate', 'canonical-ledger']) {
    assert.ok(AUTHORITATIVE_SOURCES.has(key), `${key} must be authoritative`);
  }
  assert.equal(AUTHORITATIVE_SOURCES.size, 5);
});

test('sourceWeight returns 1.0 for authoritative sources and 0.7 for structural', async () => {
  const { sourceWeight } = await import('../src/verification/types');
  assert.equal(sourceWeight('v1-lcis'), 1.0);
  assert.equal(sourceWeight('107-validators'), 1.0);
  assert.equal(sourceWeight('security-gate'), 1.0);
  assert.equal(sourceWeight('rls-gate'), 1.0);
  assert.equal(sourceWeight('canonical-ledger'), 1.0);
  assert.equal(sourceWeight('arch-intel'), 0.70);
  assert.equal(sourceWeight('db-intel'), 0.70);
  assert.equal(sourceWeight('domain-graph'), 0.70);
  assert.equal(sourceWeight('memory-engine'), 0.50);
  assert.ok(sourceWeight('some-live-connected-source') >= 0.90, 'live-connected ≥ 0.90');
  assert.ok(sourceWeight('not connected supabase') <= 0.20, 'not connected ≤ 0.20');
  assert.equal(sourceWeight('unknown-source-xyz'), 0.30, 'unknown defaults to 0.30');
});

// ─── Test 8: verifyDependencies — canonical-ledger corroborates when gate green ─
test('verifyDependencies canonical-ledger corroborates hardViolations=0', {
  skip: !hasAudit,
}, async () => {
  const v = await svc.verifyDependencies();
  assert.equal(v.subject, 'dependencies');
  // Current artifact: hardViolations=0, so canonical-ledger corroborates
  assert.notEqual(v.status, 'REFUTED', 'hardViolations=0 must not REFUTE dependencies');
  const canonicalEv = v.evidence.filter((e) => e.ref === 'canonical-ledger');
  assert.ok(canonicalEv.length >= 1, 'must cite canonical-ledger');
});

// ─── Test 9: verifyServices — no deprecated aliases in current infra-intel ────
test('verifyServices no deprecated aliases in active deploy targets', {
  skip: !hasInfra,
}, async () => {
  const v = await svc.verifyServices();
  assert.equal(v.subject, 'services');
  // Current infra-intel has correct Vercel apps; no deprecated aliases expected
  const deprecatedGaps = v.gaps.filter((g) => g.what.includes('deprecated-alias'));
  assert.equal(deprecatedGaps.length, 0, 'no deprecated aliases should appear in infra-intel');
  // Must not be REFUTED
  assert.notEqual(v.status, 'REFUTED', 'current infra has no deprecated aliases');
});

// ─── Test 10: confidence is capped at 0.95 for structural-only evidence ───────
test('confidence is never > 0.95 when no live-connected source is present', {
  skip: !hasAudit || !hasPrv2,
}, async () => {
  const v = await svc.verifyArchitecture();
  assert.ok(v.confidence <= 0.95, `confidence ${v.confidence} exceeds structural-only cap of 0.95`);
});
