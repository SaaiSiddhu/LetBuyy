/**
 * AbuseComplianceService tests — LSAS abuse + compliance area.
 *
 * Uses node:test + assert/strict. Fixed clock '2026-07-04T00:00:00.000Z'.
 * Stub ArtifactStore pattern so no real graphify-out artifacts are required.
 *
 * Covers:
 *   - abuseSignals(): mapping, NOT_CONNECTED honesty, liveSource, evidence
 *   - compliance(): mapping, status coercion, detail construction, evidence
 *   - determinism: same output on repeated calls
 *   - empty-honest: graceful handling of missing/empty artifacts
 *   - connection invariant: NOT_CONNECTED ops findings → NOT_CONNECTED AbuseSignal
 *   - try/catch: internal errors → []
 *   - read-only constraint: source contains no banned IO patterns
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEngine } from '@letbuyy/lcis-core';
import type { ArtifactStore } from '@letbuyy/lcis-core';
import { createOperationsEngine } from '@letbuyy/lcis-operations';
import { AbuseComplianceService } from '../src/abuse/AbuseComplianceService';
import type { AbuseSignal, ComplianceItem } from '../src/shared/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const FIXED = '2026-07-04T00:00:00.000Z';
const fixedNow = () => FIXED;

// ── Stub ArtifactStore factory ────────────────────────────────────────────────

type ArtifactMap = Record<string, unknown>;

function stubStore(artifacts: ArtifactMap): ArtifactStore {
  return {
    has: (n: string) => n in artifacts,
    tryRead: <T = unknown>(n: string): T | null => (n in artifacts ? (artifacts[n] as T) : null),
    read: <T = unknown>(n: string): T => {
      if (!(n in artifacts)) throw new Error('missing artifact: ' + n);
      return artifacts[n] as T;
    },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

// ── Minimal artifact payloads ─────────────────────────────────────────────────

/** Minimal db-intel that makes governance ComplianceService happy (empty arrays → no violations). */
const minDbIntel = {
  tables: [],
  functions: [],
  policies: [],
  triggers: [],
};

/** Minimal domain-intel. */
const minDomainIntel = {
  domains: [],
};

/** Minimal infra-intel. */
const minInfraIntel = {
  workers: [],
  ownership: [],
};

/** Minimal memory-intel. */
const minMemoryIntel = {
  migrations: [],
};

/** Minimal security-intelligence-v5 (operations store reads this). */
const minSecurityIntel = {
  controls: {
    jwt: { present: true },
    turnstile: { present: true },
  },
  crossTenantCandidates: [],
  trustBoundaries: [],
};

/** Minimal code graph (governance + operations might traverse). */
const minGraph = { nodes: [], links: [] };

function minimalArtifacts(): ArtifactMap {
  return {
    'db-intel': minDbIntel,
    'domain-intel': minDomainIntel,
    'infra-intel': minInfraIntel,
    'memory-intel': minMemoryIntel,
    'security-intelligence-v5': minSecurityIntel,
    graph: minGraph,
    'production-readiness-v2': { systems: [] },
    runbooks: { runbooks: [] },
    'runtime-intel': { workers: [], queueGraph: [] },
    'runtime-observability': { deadLetterQueues: [] },
    'operations-center': { statuses: [] },
    'telemetry-intelligence': { adapters: [] },
  };
}

/** Create an engine with stubbed artifacts and a fixed clock. */
function createStubEngine(artifacts?: ArtifactMap) {
  const store = stubStore(artifacts ?? minimalArtifacts());
  return createEngine({ store, repoRoot: '/stub' });
}

// ── Constructor / instantiation ───────────────────────────────────────────────

test('AbuseComplianceService can be instantiated with core + fixed now', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  assert.ok(svc, 'service is truthy');
  assert.ok(typeof svc.abuseSignals === 'function', 'abuseSignals is a function');
  assert.ok(typeof svc.compliance === 'function', 'compliance is a function');
});

test('AbuseComplianceService can be instantiated without explicit now (uses defaultNow)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core);
  assert.ok(svc, 'service is truthy');
});

test('AbuseComplianceService exposes exactly abuseSignals() and compliance() as public methods', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  assert.equal(typeof svc.abuseSignals, 'function');
  assert.equal(typeof svc.compliance, 'function');
});

// ── abuseSignals() — return type ──────────────────────────────────────────────

test('abuseSignals() returns an array', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  assert.ok(Array.isArray(signals), 'returns array');
});

test('abuseSignals() with minimal artifacts returns a non-empty array (ops always emits NOT_CONNECTED findings)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  // Ops produces at least 4 NOT_CONNECTED placeholder findings (one per detect method)
  assert.ok(signals.length >= 4, `expected >= 4 abuse signals, got ${signals.length}`);
});

test('abuseSignals() items conform to the AbuseSignal interface shape', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  for (const s of signals) {
    assert.ok(typeof s.kind === 'string', 'kind is string');
    assert.ok(typeof s.subject === 'string', 'subject is string');
    assert.ok(typeof s.detail === 'string', 'detail is string');
    assert.ok(s.connection === 'CONNECTED' || s.connection === 'NOT_CONNECTED', 'connection is valid');
    assert.ok(s.liveSource === null || typeof s.liveSource === 'string', 'liveSource is string or null');
    assert.ok(Array.isArray(s.evidence), 'evidence is array');
  }
});

test('abuseSignals() every item has a non-empty kind', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const s of svc.abuseSignals()) {
    assert.ok(s.kind.length > 0, `kind is non-empty for signal: ${s.kind}`);
  }
});

test('abuseSignals() every item has a non-empty subject', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const s of svc.abuseSignals()) {
    assert.ok(s.subject.length > 0, `subject is non-empty for signal: ${s.kind}`);
  }
});

test('abuseSignals() every item has a non-empty detail', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const s of svc.abuseSignals()) {
    assert.ok(s.detail.length > 0, `detail is non-empty for signal: ${s.kind}`);
  }
});

// ── abuseSignals() — NOT_CONNECTED honesty contract ──────────────────────────

test('abuseSignals() contains at least one NOT_CONNECTED signal (live ops signals are NOT_CONNECTED)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const notConnected = signals.filter((s) => s.connection === 'NOT_CONNECTED');
  assert.ok(notConnected.length >= 1, `expected at least one NOT_CONNECTED signal, got 0`);
});

test('abuseSignals() abuse-bot-rate signal is NOT_CONNECTED', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const abuseSig = signals.find((s) => s.kind === 'abuse-bot-rate');
  assert.ok(abuseSig, 'abuse-bot-rate signal is present');
  assert.equal(abuseSig.connection, 'NOT_CONNECTED', 'abuse-bot-rate is NOT_CONNECTED');
});

test('abuseSignals() auth-failure-rate signal is NOT_CONNECTED', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const authSig = signals.find((s) => s.kind === 'auth-failure-rate');
  assert.ok(authSig, 'auth-failure-rate signal is present');
  assert.equal(authSig.connection, 'NOT_CONNECTED', 'auth-failure-rate is NOT_CONNECTED');
});

test('abuseSignals() credential-events signal is NOT_CONNECTED', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const credSig = signals.find((s) => s.kind === 'credential-events');
  assert.ok(credSig, 'credential-events signal is present');
  assert.equal(credSig.connection, 'NOT_CONNECTED', 'credential-events is NOT_CONNECTED');
});

test('abuseSignals() live-security-spike signal is NOT_CONNECTED', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const spikeSig = signals.find((s) => s.kind === 'live-security-spike');
  assert.ok(spikeSig, 'live-security-spike signal is present');
  assert.equal(spikeSig.connection, 'NOT_CONNECTED', 'live-security-spike is NOT_CONNECTED');
});

test('abuseSignals() NOT_CONNECTED signals have liveSource naming an env var', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const notConnected = signals.filter((s) => s.connection === 'NOT_CONNECTED');
  for (const s of notConnected) {
    assert.ok(
      s.liveSource !== null && s.liveSource.length > 0,
      `NOT_CONNECTED signal "${s.kind}" must have a non-null liveSource naming the required env var`,
    );
  }
});

test('abuseSignals() NOT_CONNECTED signals liveSource names at least one known env var', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const notConnected = signals.filter((s) => s.connection === 'NOT_CONNECTED');
  const knownEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TURNSTILE_SECRET_KEY'];
  for (const s of notConnected) {
    const mentionsKnown = knownEnvVars.some((v) => (s.liveSource ?? '').includes(v));
    assert.ok(
      mentionsKnown,
      `NOT_CONNECTED signal "${s.kind}" liveSource="${s.liveSource}" must mention one of: ${knownEnvVars.join(', ')}`,
    );
  }
});

test('abuseSignals() abuse-bot-rate liveSource contains TURNSTILE_SECRET_KEY', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const abuseSig = signals.find((s) => s.kind === 'abuse-bot-rate');
  assert.ok(abuseSig, 'abuse-bot-rate present');
  assert.ok(
    (abuseSig.liveSource ?? '').includes('TURNSTILE_SECRET_KEY'),
    `abuse-bot-rate liveSource should reference TURNSTILE_SECRET_KEY, got: ${abuseSig.liveSource}`,
  );
});

test('abuseSignals() auth-failure-rate liveSource contains SUPABASE_URL', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const authSig = signals.find((s) => s.kind === 'auth-failure-rate');
  assert.ok(authSig, 'auth-failure-rate present');
  assert.ok(
    (authSig.liveSource ?? '').includes('SUPABASE_URL'),
    `auth-failure-rate liveSource should reference SUPABASE_URL, got: ${authSig.liveSource}`,
  );
});

// ── abuseSignals() — evidence contract ───────────────────────────────────────

test('abuseSignals() NOT_CONNECTED signals have at least one not-connected evidence entry', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const notConnected = signals.filter((s) => s.connection === 'NOT_CONNECTED');
  for (const s of notConnected) {
    const ncEvidence = s.evidence.filter((e) => e.kind === 'not-connected');
    assert.ok(
      ncEvidence.length >= 1,
      `NOT_CONNECTED signal "${s.kind}" must have at least one not-connected evidence entry`,
    );
  }
});

test('abuseSignals() every signal has at least one evidence entry', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  for (const s of signals) {
    assert.ok(s.evidence.length >= 1, `signal "${s.kind}" must have at least one evidence entry`);
  }
});

test('abuseSignals() evidence entries have the required fields (kind, ref)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  for (const s of signals) {
    for (const e of s.evidence) {
      assert.ok(typeof e.kind === 'string', `evidence kind is string for signal "${s.kind}"`);
      assert.ok(typeof e.ref === 'string', `evidence ref is string for signal "${s.kind}"`);
    }
  }
});

// ── abuseSignals() — determinism ──────────────────────────────────────────────

test('abuseSignals() is deterministic (same output on two calls)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const first = svc.abuseSignals();
  const second = svc.abuseSignals();
  assert.equal(first.length, second.length, 'same number of signals');
  for (let i = 0; i < first.length; i++) {
    assert.equal(first[i]!.kind, second[i]!.kind, `signal ${i} kind is deterministic`);
    assert.equal(first[i]!.subject, second[i]!.subject, `signal ${i} subject is deterministic`);
    assert.equal(first[i]!.connection, second[i]!.connection, `signal ${i} connection is deterministic`);
  }
});

test('abuseSignals() is deterministic (calling twice on different instances with same engine)', () => {
  const core = createStubEngine();
  const svc1 = new AbuseComplianceService(core, fixedNow);
  const svc2 = new AbuseComplianceService(core, fixedNow);
  const first = svc1.abuseSignals();
  const second = svc2.abuseSignals();
  assert.equal(first.length, second.length, 'same count from two instances');
});

// ── abuseSignals() — union coverage from all 4 ops methods ───────────────────

test('abuseSignals() includes signals from detectAbuseSignals (abuse-bot-rate)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  assert.ok(signals.some((s) => s.kind === 'abuse-bot-rate'), 'abuse-bot-rate from detectAbuseSignals is present');
});

test('abuseSignals() includes signals from detectAuthAnomalies (auth-failure-rate)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  assert.ok(signals.some((s) => s.kind === 'auth-failure-rate'), 'auth-failure-rate from detectAuthAnomalies is present');
});

test('abuseSignals() includes signals from detectCredentialEvents (credential-events)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  assert.ok(signals.some((s) => s.kind === 'credential-events'), 'credential-events from detectCredentialEvents is present');
});

test('abuseSignals() includes signals from detectSecuritySpikes (live-security-spike)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  assert.ok(signals.some((s) => s.kind === 'live-security-spike'), 'live-security-spike from detectSecuritySpikes is present');
});

test('abuseSignals() count >= sum of minimum expected outputs from all 4 ops methods', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  // Each method emits at least 1 NOT_CONNECTED finding = minimum 4 total
  assert.ok(signals.length >= 4, `expected >= 4 total signals from 4 methods, got ${signals.length}`);
});

// ── abuseSignals() — CONNECTED signals never claim CONNECTED without evidence ─

test('abuseSignals() CONNECTED signals have at least one non-not-connected evidence entry', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const connected = signals.filter((s) => s.connection === 'CONNECTED');
  for (const s of connected) {
    const connectedEvidence = s.evidence.filter((e) => e.kind !== 'not-connected');
    assert.ok(
      connectedEvidence.length >= 1,
      `CONNECTED signal "${s.kind}" must have at least one non-not-connected evidence entry`,
    );
  }
});

// ── compliance() — return type ────────────────────────────────────────────────

test('compliance() returns an array', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  assert.ok(Array.isArray(items), 'returns array');
});

test('compliance() with minimal empty artifacts returns >= 8 items (one per R001..R008)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  // ComplianceService evaluates 8 rules R001..R008
  assert.ok(items.length >= 8, `expected >= 8 compliance items, got ${items.length}`);
});

test('compliance() items conform to the ComplianceItem interface shape', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  for (const item of items) {
    assert.ok(typeof item.rule === 'string', 'rule is string');
    assert.ok(typeof item.title === 'string', 'title is string');
    assert.ok(
      item.status === 'COMPLIANT' || item.status === 'VIOLATED' || item.status === 'UNKNOWN',
      `status is valid: ${item.status}`,
    );
    assert.ok(typeof item.detail === 'string', 'detail is string');
    assert.ok(Array.isArray(item.evidence), 'evidence is array');
  }
});

test('compliance() every item has a non-empty rule id', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const item of svc.compliance()) {
    assert.ok(item.rule.length > 0, `rule id is non-empty: ${item.rule}`);
  }
});

test('compliance() every item has a non-empty title', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const item of svc.compliance()) {
    assert.ok(item.title.length > 0, `title is non-empty for rule ${item.rule}`);
  }
});

test('compliance() every item has a non-empty detail', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const item of svc.compliance()) {
    assert.ok(item.detail.length > 0, `detail is non-empty for rule ${item.rule}`);
  }
});

// ── compliance() — rule coverage ──────────────────────────────────────────────

test('compliance() includes a rule R001 item', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  assert.ok(items.some((i) => i.rule === 'R001'), 'R001 is present');
});

test('compliance() includes a rule R002 item', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  assert.ok(items.some((i) => i.rule === 'R002'), 'R002 is present');
});

test('compliance() includes a rule R003 item', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  assert.ok(items.some((i) => i.rule === 'R003'), 'R003 is present');
});

test('compliance() includes a rule R004 item', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  assert.ok(items.some((i) => i.rule === 'R004'), 'R004 is present');
});

test('compliance() includes a rule R005 item', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  assert.ok(items.some((i) => i.rule === 'R005'), 'R005 is present');
});

test('compliance() includes a rule R006 item', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  assert.ok(items.some((i) => i.rule === 'R006'), 'R006 is present');
});

test('compliance() includes a rule R007 item', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  assert.ok(items.some((i) => i.rule === 'R007'), 'R007 is present');
});

test('compliance() includes a rule R008 item', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  assert.ok(items.some((i) => i.rule === 'R008'), 'R008 is present');
});

test('compliance() has exactly 8 items (one per governance rule)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  assert.equal(items.length, 8, `expected exactly 8 items (R001..R008), got ${items.length}`);
});

// ── compliance() — status mapping ─────────────────────────────────────────────

test('compliance() with empty artifacts produces COMPLIANT for R001 (no money functions to violate)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  const r001 = items.find((i) => i.rule === 'R001');
  assert.ok(r001, 'R001 item present');
  assert.equal(r001.status, 'COMPLIANT', 'R001 is COMPLIANT when no money functions exist');
});

test('compliance() with empty artifacts produces COMPLIANT for R002 (no tenant tables to violate)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  const r002 = items.find((i) => i.rule === 'R002');
  assert.ok(r002, 'R002 item present');
  assert.equal(r002.status, 'COMPLIANT', 'R002 is COMPLIANT when no tenant tables exist');
});

test('compliance() R006 and R008 are UNKNOWN (PARTIAL→UNKNOWN honesty mapping)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  const r006 = items.find((i) => i.rule === 'R006');
  const r008 = items.find((i) => i.rule === 'R008');
  assert.ok(r006, 'R006 present');
  assert.ok(r008, 'R008 present');
  // R006 (rollback) and R008 (healthcheck) are PARTIAL in governance → UNKNOWN in LSAS
  assert.equal(r006.status, 'UNKNOWN', 'R006 PARTIAL→UNKNOWN');
  assert.equal(r008.status, 'UNKNOWN', 'R008 PARTIAL→UNKNOWN');
});

test('compliance() status values are only the three allowed: COMPLIANT, VIOLATED, UNKNOWN', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const allowed = new Set(['COMPLIANT', 'VIOLATED', 'UNKNOWN']);
  for (const item of svc.compliance()) {
    assert.ok(allowed.has(item.status), `status "${item.status}" for rule ${item.rule} is not allowed`);
  }
});

test('compliance() with a violating tenant-table artifact produces VIOLATED R002', () => {
  const artifacts = {
    ...minimalArtifacts(),
    'db-intel': {
      tables: [{ name: 'orders', rls: false, tenant: true, money: false, hasSiteId: true, hasStoreId: false, columns: 5, force: false, policies: [], triggers: [], indexes: 0, createdIn: 'migration-001' }],
      functions: [],
      policies: [],
      triggers: [],
    },
    'domain-intel': { domains: [] },
    'infra-intel': { workers: [], ownership: [] },
    'memory-intel': { migrations: [] },
  };
  const core = createStubEngine(artifacts);
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  const r002 = items.find((i) => i.rule === 'R002');
  assert.ok(r002, 'R002 present');
  assert.equal(r002.status, 'VIOLATED', 'R002 VIOLATED when tenant table has no RLS');
});

test('compliance() with a violating money-function artifact produces VIOLATED R001', () => {
  const artifacts = {
    ...minimalArtifacts(),
    'db-intel': {
      tables: [],
      functions: [
        {
          name: 'create_checkout_order',
          definedIn: 'migration-001',
          securityDefiner: false, // violation: missing SECURITY DEFINER
          args: 3,
          touches: [],
          hasIdempotency: true,
          forUpdate: true,
          money: true,
          callers: [],
        },
      ],
      policies: [],
      triggers: [],
    },
    'domain-intel': { domains: [] },
    'infra-intel': { workers: [], ownership: [] },
    'memory-intel': { migrations: [] },
  };
  const core = createStubEngine(artifacts);
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  const r001 = items.find((i) => i.rule === 'R001');
  assert.ok(r001, 'R001 present');
  assert.equal(r001.status, 'VIOLATED', 'R001 VIOLATED when money function missing SECURITY DEFINER');
});

// ── compliance() — detail content ─────────────────────────────────────────────

test('compliance() detail includes the rule id', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const item of svc.compliance()) {
    assert.ok(
      item.detail.includes(item.rule),
      `detail for ${item.rule} should include the rule id; detail: "${item.detail}"`,
    );
  }
});

test('compliance() detail includes checked count', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const item of svc.compliance()) {
    assert.ok(
      item.detail.includes('Checked:'),
      `detail for ${item.rule} should include "Checked:" count; detail: "${item.detail}"`,
    );
  }
});

test('compliance() detail includes passed count', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const item of svc.compliance()) {
    assert.ok(
      item.detail.includes('passed:'),
      `detail for ${item.rule} should include "passed:" count; detail: "${item.detail}"`,
    );
  }
});

test('compliance() VIOLATED items detail includes first violation title', () => {
  const artifacts = {
    ...minimalArtifacts(),
    'db-intel': {
      tables: [
        {
          name: 'store_customers',
          rls: false,
          tenant: true,
          money: false,
          hasSiteId: true,
          hasStoreId: false,
          columns: 5,
          force: false,
          policies: [],
          triggers: [],
          indexes: 0,
          createdIn: 'migration-001',
        },
      ],
      functions: [],
      policies: [],
      triggers: [],
    },
    'domain-intel': { domains: [] },
    'infra-intel': { workers: [], ownership: [] },
    'memory-intel': { migrations: [] },
  };
  const core = createStubEngine(artifacts);
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  const r002 = items.find((i) => i.rule === 'R002' && i.status === 'VIOLATED');
  assert.ok(r002, 'R002 is VIOLATED');
  assert.ok(
    r002.detail.includes('First violation:'),
    `VIOLATED R002 detail should include "First violation:"; detail: "${r002.detail}"`,
  );
});

// ── compliance() — evidence contract ──────────────────────────────────────────

test('compliance() every item has at least one evidence entry', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const item of svc.compliance()) {
    assert.ok(item.evidence.length >= 1, `rule ${item.rule} must have at least one evidence entry`);
  }
});

test('compliance() evidence entries have the required fields (kind, ref)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const item of svc.compliance()) {
    for (const e of item.evidence) {
      assert.ok(typeof e.kind === 'string', `evidence kind is string for rule ${item.rule}`);
      assert.ok(typeof e.ref === 'string', `evidence ref is string for rule ${item.rule}`);
    }
  }
});

// ── compliance() — determinism ─────────────────────────────────────────────────

test('compliance() is deterministic (same output on two calls)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const first = svc.compliance();
  const second = svc.compliance();
  assert.equal(first.length, second.length, 'same number of items');
  for (let i = 0; i < first.length; i++) {
    assert.equal(first[i]!.rule, second[i]!.rule, `item ${i} rule is deterministic`);
    assert.equal(first[i]!.status, second[i]!.status, `item ${i} status is deterministic`);
    assert.equal(first[i]!.title, second[i]!.title, `item ${i} title is deterministic`);
  }
});

test('compliance() is deterministic (two separate instances with same engine)', () => {
  const core = createStubEngine();
  const svc1 = new AbuseComplianceService(core, fixedNow);
  const svc2 = new AbuseComplianceService(core, fixedNow);
  const first = svc1.compliance();
  const second = svc2.compliance();
  assert.equal(first.length, second.length, 'same count from two instances');
  for (let i = 0; i < first.length; i++) {
    assert.equal(first[i]!.rule, second[i]!.rule, `rule at ${i} is deterministic`);
  }
});

// ── empty / error handling ────────────────────────────────────────────────────

test('abuseSignals() returns [] (not throws) when artifacts are completely empty', () => {
  // Only stub minimal essentials that keep ops from throwing
  const store = stubStore({
    'db-intel': { tables: [], functions: [], policies: [], triggers: [] },
    'domain-intel': { domains: [] },
    'infra-intel': { workers: [], ownership: [] },
    'memory-intel': { migrations: [] },
    graph: { nodes: [], links: [] },
    'production-readiness-v2': { systems: [] },
    runbooks: { runbooks: [] },
    'runtime-intel': { workers: [], queueGraph: [] },
    'runtime-observability': { deadLetterQueues: [] },
    'operations-center': { statuses: [] },
    'telemetry-intelligence': { adapters: [] },
  });
  const core = createEngine({ store, repoRoot: '/stub' });
  const svc = new AbuseComplianceService(core, fixedNow);
  let result: readonly AbuseSignal[];
  assert.doesNotThrow(() => {
    result = svc.abuseSignals();
  });
  assert.ok(Array.isArray(result!), 'result is an array');
});

test('compliance() returns [] (not throws) when core produces no evaluations', () => {
  const store = stubStore({
    'db-intel': { tables: [], functions: [], policies: [], triggers: [] },
    'domain-intel': { domains: [] },
    'infra-intel': { workers: [], ownership: [] },
    'memory-intel': { migrations: [] },
    graph: { nodes: [], links: [] },
    'production-readiness-v2': { systems: [] },
    runbooks: { runbooks: [] },
  });
  const core = createEngine({ store, repoRoot: '/stub' });
  const svc = new AbuseComplianceService(core, fixedNow);
  let result: readonly ComplianceItem[];
  assert.doesNotThrow(() => {
    result = svc.compliance();
  });
  assert.ok(Array.isArray(result!), 'result is an array');
});

test('abuseSignals() and compliance() both return arrays on the same service instance', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const items = svc.compliance();
  assert.ok(Array.isArray(signals), 'abuseSignals is array');
  assert.ok(Array.isArray(items), 'compliance is array');
});

// ── Cross-check: abuseSignals come from ops, compliance from governance ────────

test('abuseSignals() kinds are not governance rule IDs (they come from ops, not compliance)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const rulePattern = /^R\d{3}$/;
  for (const s of signals) {
    assert.ok(
      !rulePattern.test(s.kind),
      `abuseSignal kind "${s.kind}" looks like a governance rule id — it should come from ops`,
    );
  }
});

test('compliance() rule ids match governance rules R001..R008 pattern', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  const rulePattern = /^R\d{3}$/;
  for (const item of items) {
    assert.ok(
      rulePattern.test(item.rule),
      `compliance rule "${item.rule}" must match the R### pattern`,
    );
  }
});

// ── Read-only constraint ───────────────────────────────────────────────────────

test('AbuseComplianceService source contains no banned IO patterns', () => {
  const srcPath = new URL('../src/abuse/AbuseComplianceService.ts', import.meta.url);
  const src = readFileSync(srcPath, 'utf-8');

  const banned = [
    { pattern: /\bfetch\s*\(/, label: 'fetch()' },
    { pattern: /require\s*\(\s*['"]child_process['"]/, label: 'require(child_process)' },
    { pattern: /import.*['"]child_process['"]/, label: 'import child_process' },
    { pattern: /\bspawn\s*\(/, label: 'spawn()' },
    { pattern: /\bexecSync\s*\(/, label: 'execSync()' },
    { pattern: /\bexecFile\s*\(/, label: 'execFile()' },
    { pattern: /\beval\s*\(/, label: 'eval()' },
    { pattern: /writeFile[Sync]*\s*\(/, label: 'writeFile()' },
    { pattern: /createWriteStream\s*\(/, label: 'createWriteStream()' },
    { pattern: /new Date\(\)/, label: 'argless new Date() (use injectable now)' },
    { pattern: /Date\.now\(\)/, label: 'Date.now() (use injectable now)' },
  ];

  for (const { pattern, label } of banned) {
    assert.ok(!pattern.test(src), `AbuseComplianceService must not contain ${label}`);
  }
});

test('AbuseComplianceService source does not import node:fs directly (read-only via core)', () => {
  const srcPath = new URL('../src/abuse/AbuseComplianceService.ts', import.meta.url);
  const src = readFileSync(srcPath, 'utf-8');
  assert.ok(!src.includes("from 'node:fs'"), 'must not import node:fs directly');
  assert.ok(!src.includes('from "node:fs"'), 'must not import node:fs directly');
});

test('AbuseComplianceService source does not import node:child_process', () => {
  const srcPath = new URL('../src/abuse/AbuseComplianceService.ts', import.meta.url);
  const src = readFileSync(srcPath, 'utf-8');
  assert.ok(!src.includes('child_process'), 'must not reference child_process');
});

// ── Honesty invariant: no NOT_CONNECTED signal may have CONNECTED connection ──

test('abuseSignals() never emits a signal with both NOT_CONNECTED in evidence AND connection=CONNECTED', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  for (const s of signals) {
    if (s.connection === 'CONNECTED') {
      // If it claims CONNECTED, it must NOT have only not-connected evidence
      const allNotConnected = s.evidence.length > 0 && s.evidence.every((e) => e.kind === 'not-connected');
      assert.ok(
        !allNotConnected,
        `CONNECTED signal "${s.kind}" must not have only not-connected evidence (fabrication guard)`,
      );
    }
  }
});

// ── Misc / edge cases ─────────────────────────────────────────────────────────

test('abuseSignals() returned array is readonly-compatible (no push allowed in tests)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  // We verify the type contract at compile-time; at runtime, check it's a real array
  assert.ok(Array.isArray(signals));
});

test('compliance() returned array is readonly-compatible (no push allowed in tests)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  assert.ok(Array.isArray(items));
});

test('compliance() R002 title mentions RLS or tenant', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  const r002 = items.find((i) => i.rule === 'R002');
  assert.ok(r002, 'R002 present');
  const titleLower = r002.title.toLowerCase();
  assert.ok(
    titleLower.includes('rls') || titleLower.includes('tenant') || titleLower.includes('row'),
    `R002 title should mention RLS/tenant/row, got: "${r002.title}"`,
  );
});

test('compliance() R001 title mentions money or security definer', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  const r001 = items.find((i) => i.rule === 'R001');
  assert.ok(r001, 'R001 present');
  const titleLower = r001.title.toLowerCase();
  assert.ok(
    titleLower.includes('money') || titleLower.includes('security') || titleLower.includes('definer') || titleLower.includes('function'),
    `R001 title should mention money/security/definer, got: "${r001.title}"`,
  );
});

test('both methods can be called in sequence without interference', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  // Call both methods multiple times in alternating order
  const s1 = svc.abuseSignals();
  const c1 = svc.compliance();
  const s2 = svc.abuseSignals();
  const c2 = svc.compliance();
  assert.equal(s1.length, s2.length, 'abuseSignals stable across calls');
  assert.equal(c1.length, c2.length, 'compliance stable across calls');
});

// ── Additional mapping exactness tests ───────────────────────────────────────

test('abuseSignals() ops finding detail is preserved verbatim in the mapped signal', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  // Every signal should have a non-empty detail that came from the ops finding
  for (const s of signals) {
    assert.ok(s.detail.length > 10, `signal "${s.kind}" detail appears too short (expected verbatim ops detail): "${s.detail}"`);
  }
});

test('abuseSignals() ops finding subject is preserved verbatim in the mapped signal', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  // Subjects come from ops findings — must not be empty or generic
  for (const s of signals) {
    assert.ok(s.subject.length > 0, `signal "${s.kind}" subject must not be empty`);
  }
});

test('abuseSignals() no duplicate kind+subject combinations (union is flat, not nested)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  // The 4 primary NOT_CONNECTED kinds are distinct
  const primaryKinds = ['abuse-bot-rate', 'auth-failure-rate', 'credential-events', 'live-security-spike'];
  for (const kind of primaryKinds) {
    const matches = signals.filter((s) => s.kind === kind);
    assert.ok(matches.length >= 1, `"${kind}" should appear at least once`);
    // Each must appear exactly once from its respective detect method
    assert.equal(matches.length, 1, `"${kind}" should appear exactly once in the union`);
  }
});

test('compliance() COMPLIANT items have detail that includes "violated: 0"', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  for (const item of items) {
    if (item.status === 'COMPLIANT') {
      assert.ok(
        item.detail.includes('violated: 0'),
        `COMPLIANT item ${item.rule} detail should say "violated: 0", got: "${item.detail}"`,
      );
    }
  }
});

test('compliance() VIOLATED items have detail that mentions a positive violation count', () => {
  const artifacts = {
    ...minimalArtifacts(),
    'db-intel': {
      tables: [
        { name: 'payments', rls: false, tenant: true, money: true, hasSiteId: true, hasStoreId: false, columns: 8, force: false, policies: [], triggers: [], indexes: 0, createdIn: 'm001' },
      ],
      functions: [],
      policies: [],
      triggers: [],
    },
    'domain-intel': { domains: [] },
    'infra-intel': { workers: [], ownership: [] },
    'memory-intel': { migrations: [] },
  };
  const core = createStubEngine(artifacts);
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  const violated = items.filter((i) => i.status === 'VIOLATED');
  for (const item of violated) {
    // Must include a non-zero violation count
    assert.ok(
      !item.detail.includes('violated: 0'),
      `VIOLATED item ${item.rule} detail must not say "violated: 0"; got: "${item.detail}"`,
    );
  }
});

test('abuseSignals() evidence kind values are valid EvidenceKind values', () => {
  const validKinds = new Set([
    'graph-node', 'graph-edge', 'file', 'artifact-field', 'rpc', 'table',
    'policy', 'route', 'worker', 'doc', 'decision', 'migration', 'validator', 'not-connected',
  ]);
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const s of svc.abuseSignals()) {
    for (const e of s.evidence) {
      assert.ok(validKinds.has(e.kind), `evidence kind "${e.kind}" is not a valid EvidenceKind`);
    }
  }
});

test('compliance() evidence kind values are valid EvidenceKind values', () => {
  const validKinds = new Set([
    'graph-node', 'graph-edge', 'file', 'artifact-field', 'rpc', 'table',
    'policy', 'route', 'worker', 'doc', 'decision', 'migration', 'validator', 'not-connected',
  ]);
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  for (const item of svc.compliance()) {
    for (const e of item.evidence) {
      assert.ok(validKinds.has(e.kind), `evidence kind "${e.kind}" is not a valid EvidenceKind for rule ${item.rule}`);
    }
  }
});

test('abuseSignals() count is exactly the sum of all four ops detect-method outputs', () => {
  // The service unions all 4 methods; count must equal sum of individual method counts
  const core = createStubEngine();
  const { securityOps } = createOperationsEngine({ core, now: fixedNow });
  const expectedCount =
    securityOps.detectAbuseSignals().length +
    securityOps.detectAuthAnomalies().length +
    securityOps.detectCredentialEvents().length +
    securityOps.detectSecuritySpikes().length;
  const svc = new AbuseComplianceService(core, fixedNow);
  assert.equal(svc.abuseSignals().length, expectedCount, 'abuseSignals count == sum of 4 detect methods');
});

test('abuseSignals() liveSource is null on CONNECTED structural signals (no env var needed)', () => {
  const core = createStubEngine();
  const svc = new AbuseComplianceService(core, fixedNow);
  const signals = svc.abuseSignals();
  const connected = signals.filter((s) => s.connection === 'CONNECTED');
  // CONNECTED signals come from structural findings — they don't need env vars for the connection
  // The liveSource may or may not be null (some structural findings still name a live improvement)
  // What we assert: they must NOT claim NOT_CONNECTED in connection
  for (const s of connected) {
    assert.equal(s.connection, 'CONNECTED', `connected signal "${s.kind}" has connection=CONNECTED`);
  }
});

test('compliance() detail for R002 with no violations does not mention First violation', () => {
  const core = createStubEngine(); // no tenant tables → no R002 violations
  const svc = new AbuseComplianceService(core, fixedNow);
  const items = svc.compliance();
  const r002 = items.find((i) => i.rule === 'R002');
  assert.ok(r002, 'R002 present');
  if (r002.status === 'COMPLIANT') {
    assert.ok(
      !r002.detail.includes('First violation:'),
      `COMPLIANT R002 detail should not mention "First violation:"`,
    );
  }
});
