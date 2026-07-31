/**
 * TestAnalyticsService tests — LQAS Phase 15.
 *
 * Uses stub ArtifactStore + createEngine({store, repoRoot:'/stub'}).
 * Fixed clock '2026-07-04T00:00:00.000Z'.  Covers:
 *   - Construction (with core + now; pure constructor())
 *   - analyze(): structural gaps, plannedTests, passRate NOT_CONNECTED, summary
 *   - coverage(): NOT_CONNECTED pcts, CONNECTED structural gaps
 *   - mutation(): NOT_CONNECTED score, correct liveSource
 *   - flaky(): NOT_CONNECTED list, correct liveSource
 *   - Mapping: EngineeringFinding → QualityFinding (rule QA01, connection CONNECTED)
 *   - Honesty: null values, exact liveSource strings, no fabricated numbers
 *   - Determinism: same inputs → deep-equal outputs
 *   - Empty / stub stores: honest empty results, never throw
 *   - Source scan: no forbidden IO patterns in src/test/
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine, type ArtifactStore } from '@letbuyy/lcis-core';
import { TestAnalyticsService } from '../src/test/index';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Fixed clock ───────────────────────────────────────────────────────────────

const FIXED = '2026-07-04T00:00:00.000Z';
const fixedNow = (): string => FIXED;

// ── Stub ArtifactStore ────────────────────────────────────────────────────────

/**
 * Minimal in-memory ArtifactStore.  The spec-mandated helper.
 * Provides only the artifacts we supply; everything else is null / throws.
 */
function stubStore(artifacts: Record<string, unknown>): ArtifactStore {
  return {
    has:     (n: string) => n in artifacts,
    tryRead: (n: string) => (n in artifacts ? (artifacts[n] as unknown) : null) as ReturnType<ArtifactStore['tryRead']>,
    read:    (n: string) => {
      if (!(n in artifacts)) throw new Error('missing ' + n);
      return artifacts[n] as ReturnType<ArtifactStore['read']>;
    },
    pathOf: (n: string) => '/stub/' + n,
  } as unknown as ArtifactStore;
}

/** Minimal graph artifact (always include; GraphService constructor iterates nodes). */
const EMPTY_GRAPH = { nodes: [], links: [] };

/** A graph with one rpc node so seed-resolution can find it. */
const GRAPH_WITH_RPC = {
  nodes: [
    { id: 'rpc-create-order', label: 'create_order', kind: 'rpc', sourceFile: 'services/api-gateway/src/routes/orders.ts' },
  ],
  links: [],
};

/** db-intel stubs */
const DB_EMPTY = { tables: [] };
const DB_WITH_MONEY_TABLE = {
  tables: [{ name: 'orders', money: true, tenant: true }],
};
const DB_WITH_PLAIN_TABLE = {
  tables: [{ name: 'products', money: false, tenant: false }],
};

/** domain-intel stubs */
const DOMAIN_EMPTY = { domains: [] };
const DOMAIN_WITH_ONE = {
  domains: [{ key: 'payments', name: 'Payments', description: 'payment processing' }],
};

// ── Engine factories ──────────────────────────────────────────────────────────

function makeEngine(artifacts: Record<string, unknown>) {
  return createEngine({ store: stubStore({ graph: EMPTY_GRAPH, ...artifacts }), repoRoot: '/stub' });
}

/** Full empty stub (no domains, no tables). */
const emptyCore = makeEngine({ 'domain-intel': DOMAIN_EMPTY, 'db-intel': DB_EMPTY });

/** Stub with a money table (explicit table seed → gaps expected when table is named). */
const moneyCore = makeEngine({ 'domain-intel': DOMAIN_EMPTY, 'db-intel': DB_WITH_MONEY_TABLE });

/** Stub with a graph node and a plain table. */
const plainCore = makeEngine({
  graph: GRAPH_WITH_RPC,
  'domain-intel': DOMAIN_EMPTY,
  'db-intel': DB_WITH_PLAIN_TABLE,
});

// ── Services under test ───────────────────────────────────────────────────────

const svcEmpty  = new TestAnalyticsService(emptyCore, fixedNow);
const svcMoney  = new TestAnalyticsService(moneyCore, fixedNow);
const svcPlain  = new TestAnalyticsService(plainCore, fixedNow);

// ═════════════════════════════════════════════════════════════════════════════
// SOURCE SCAN
// ═════════════════════════════════════════════════════════════════════════════

test('source scan: no fetch/child_process/spawn/exec/eval/writeFile in src/test/', () => {
  const srcDir = join(__dirname, '../src/test');
  const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length > 0, 'src/test must have at least one .ts file');
  const FORBIDDEN = ['fetch(', 'child_process', 'spawn(', 'exec(', 'eval(', 'writeFile', 'appendFile'];
  for (const file of files) {
    const raw = readFileSync(join(srcDir, file), 'utf8');
    const content = raw
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    for (const pat of FORBIDDEN) {
      assert.ok(!content.includes(pat), `Forbidden pattern "${pat}" in src/test/${file}`);
    }
  }
});

test('source scan: no Date.now() in src/test/TestAnalyticsService.ts (injectable clock only)', () => {
  const raw = readFileSync(join(__dirname, '../src/test/TestAnalyticsService.ts'), 'utf8');
  const content = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!content.includes('Date.now()'), 'must not call Date.now() directly');
});

test('source scan: no new Date() without args in src/test/TestAnalyticsService.ts', () => {
  const raw = readFileSync(join(__dirname, '../src/test/TestAnalyticsService.ts'), 'utf8');
  const content = raw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // The only Date usage allowed is via defaultNow (imported from envelope.ts, the sanctioned boundary).
  assert.ok(!content.includes('new Date()'), 'must not call new Date() without arguments');
});

// ═════════════════════════════════════════════════════════════════════════════
// CONSTRUCTION
// ═════════════════════════════════════════════════════════════════════════════

test('constructs with core + now', () => {
  const svc = new TestAnalyticsService(emptyCore, fixedNow);
  assert.ok(svc instanceof TestAnalyticsService);
});

test('constructs with core only (defaultNow fallback)', () => {
  const svc = new TestAnalyticsService(emptyCore);
  assert.ok(svc instanceof TestAnalyticsService);
});

test('all four public methods exist', () => {
  assert.equal(typeof svcEmpty.analyze,   'function');
  assert.equal(typeof svcEmpty.coverage,  'function');
  assert.equal(typeof svcEmpty.mutation,  'function');
  assert.equal(typeof svcEmpty.flaky,     'function');
});

// ═════════════════════════════════════════════════════════════════════════════
// analyze() — shape
// ═════════════════════════════════════════════════════════════════════════════

test('analyze(): returns a TestAnalytics object', () => {
  const r = svcEmpty.analyze();
  assert.ok(r !== null && typeof r === 'object');
});

test('analyze(): coverageGaps is a readonly array', () => {
  const r = svcEmpty.analyze();
  assert.ok(Array.isArray(r.coverageGaps));
});

test('analyze(): plannedTests is a non-negative integer', () => {
  const r = svcEmpty.analyze();
  assert.ok(typeof r.plannedTests === 'number');
  assert.ok(r.plannedTests >= 0);
  assert.ok(Number.isInteger(r.plannedTests));
});

test('analyze(): passRate.connection is NOT_CONNECTED', () => {
  const r = svcEmpty.analyze();
  assert.equal(r.passRate.connection, 'NOT_CONNECTED');
});

test('analyze(): passRate.value is null (never fabricated)', () => {
  const r = svcEmpty.analyze();
  assert.equal(r.passRate.value, null);
});

test('analyze(): passRate.liveSource names the CI test-run store', () => {
  const r = svcEmpty.analyze();
  assert.ok(r.passRate.liveSource.toLowerCase().includes('ci') || r.passRate.liveSource.toLowerCase().includes('test-run'));
});

test('analyze(): summary is a non-empty string', () => {
  const r = svcEmpty.analyze();
  assert.ok(typeof r.summary === 'string' && r.summary.trim().length > 0);
});

test('analyze(): summary mentions NOT_CONNECTED', () => {
  const r = svcEmpty.analyze();
  assert.ok(r.summary.includes('NOT_CONNECTED'), 'summary must surface the NOT_CONNECTED signal');
});

// ═════════════════════════════════════════════════════════════════════════════
// analyze() — coverageGaps are QualityFindings with QA01
// ═════════════════════════════════════════════════════════════════════════════

test('analyze(): with empty stub, coverageGaps is [] (honest empty, not fabricated)', () => {
  const r = svcEmpty.analyze();
  assert.deepEqual(r.coverageGaps, []);
});

test('analyze(): every gap has rule=QA01', () => {
  // Use real engine to get realistic coverage gaps, but if 0 that is also valid.
  // With emptyCore the result is []; with a real engine we expect QA01.
  const realCore = createEngine();
  const svcReal  = new TestAnalyticsService(realCore, fixedNow);
  const r = svcReal.analyze();
  for (const g of r.coverageGaps) {
    assert.equal(g.rule, 'QA01', `gap "${g.id}" must have rule QA01`);
  }
});

test('analyze(): every gap has connection=CONNECTED', () => {
  const realCore = createEngine();
  const svcReal  = new TestAnalyticsService(realCore, fixedNow);
  const r = svcReal.analyze();
  for (const g of r.coverageGaps) {
    assert.equal(g.connection, 'CONNECTED', `gap "${g.id}" must be CONNECTED`);
  }
});

test('analyze(): every gap has a non-empty id', () => {
  const realCore = createEngine();
  const svcReal  = new TestAnalyticsService(realCore, fixedNow);
  const r = svcReal.analyze();
  for (const g of r.coverageGaps) {
    assert.ok(typeof g.id === 'string' && g.id.length > 0);
  }
});

test('analyze(): every gap has a non-empty subject', () => {
  const realCore = createEngine();
  const svcReal  = new TestAnalyticsService(realCore, fixedNow);
  const r = svcReal.analyze();
  for (const g of r.coverageGaps) {
    assert.ok(typeof g.subject === 'string' && g.subject.length > 0);
  }
});

test('analyze(): every gap has a non-empty title', () => {
  const realCore = createEngine();
  const svcReal  = new TestAnalyticsService(realCore, fixedNow);
  const r = svcReal.analyze();
  for (const g of r.coverageGaps) {
    assert.ok(typeof g.title === 'string' && g.title.length > 0);
  }
});

test('analyze(): every gap has a non-empty detail', () => {
  const realCore = createEngine();
  const svcReal  = new TestAnalyticsService(realCore, fixedNow);
  const r = svcReal.analyze();
  for (const g of r.coverageGaps) {
    assert.ok(typeof g.detail === 'string' && g.detail.length > 0);
  }
});

test('analyze(): every gap has a valid severity', () => {
  const realCore = createEngine();
  const svcReal  = new TestAnalyticsService(realCore, fixedNow);
  const r = svcReal.analyze();
  const VALID = new Set(['critical', 'high', 'medium', 'low', 'info']);
  for (const g of r.coverageGaps) {
    assert.ok(VALID.has(g.severity), `invalid severity "${g.severity}" on gap "${g.id}"`);
  }
});

test('analyze(): every gap has evidence as readonly array', () => {
  const realCore = createEngine();
  const svcReal  = new TestAnalyticsService(realCore, fixedNow);
  const r = svcReal.analyze();
  for (const g of r.coverageGaps) {
    assert.ok(Array.isArray(g.evidence));
  }
});

test('analyze(): plannedTests equals 0 for empty stub (no required tests)', () => {
  const r = svcEmpty.analyze();
  assert.equal(r.plannedTests, 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// analyze() — passRate is never a number (NOT_CONNECTED)
// ═════════════════════════════════════════════════════════════════════════════

test('analyze(): passRate.value is never a number (strict NOT_CONNECTED honesty)', () => {
  const r = svcEmpty.analyze();
  assert.ok(typeof r.passRate.value !== 'number', 'pass rate must not be a number — CI data not connected');
});

test('analyze(): passRate liveSource is non-empty', () => {
  const r = svcEmpty.analyze();
  assert.ok(typeof r.passRate.liveSource === 'string' && r.passRate.liveSource.length > 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// coverage() — shape & honesty
// ═════════════════════════════════════════════════════════════════════════════

test('coverage(): returns a CoverageAnalytics object', () => {
  const r = svcEmpty.coverage();
  assert.ok(r !== null && typeof r === 'object');
});

test('coverage(): connection is NOT_CONNECTED', () => {
  const r = svcEmpty.coverage();
  assert.equal(r.connection, 'NOT_CONNECTED');
});

test('coverage(): linePct is null (never fabricated)', () => {
  const r = svcEmpty.coverage();
  assert.equal(r.linePct, null);
});

test('coverage(): branchPct is null (never fabricated)', () => {
  const r = svcEmpty.coverage();
  assert.equal(r.branchPct, null);
});

test('coverage(): linePct is never a number', () => {
  const r = svcEmpty.coverage();
  assert.ok(typeof r.linePct !== 'number', 'linePct must not be a number — no coverage report');
});

test('coverage(): branchPct is never a number', () => {
  const r = svcEmpty.coverage();
  assert.ok(typeof r.branchPct !== 'number', 'branchPct must not be a number — no coverage report');
});

test('coverage(): liveSource names c8/istanbul', () => {
  const r = svcEmpty.coverage();
  assert.ok(r.liveSource.includes('c8') || r.liveSource.includes('istanbul') || r.liveSource.includes('lcov'));
});

test('coverage(): liveSource is non-empty', () => {
  const r = svcEmpty.coverage();
  assert.ok(typeof r.liveSource === 'string' && r.liveSource.length > 0);
});

test('coverage(): gaps is an array', () => {
  const r = svcEmpty.coverage();
  assert.ok(Array.isArray(r.gaps));
});

test('coverage(): gaps is [] for empty stub', () => {
  const r = svcEmpty.coverage();
  assert.deepEqual(r.gaps, []);
});

test('coverage(): gaps are CONNECTED structural findings even though pct is NOT_CONNECTED', () => {
  const realCore = createEngine();
  const svcReal  = new TestAnalyticsService(realCore, fixedNow);
  const r = svcReal.coverage();
  for (const g of r.gaps) {
    assert.equal(g.connection, 'CONNECTED');
  }
});

test('coverage(): gaps have rule=QA01 (when present)', () => {
  const realCore = createEngine();
  const svcReal  = new TestAnalyticsService(realCore, fixedNow);
  const r = svcReal.coverage();
  for (const g of r.gaps) {
    assert.equal(g.rule, 'QA01');
  }
});

test('coverage(): analyze().coverageGaps matches coverage().gaps (same underlying data)', () => {
  const realCore = createEngine();
  const svcReal  = new TestAnalyticsService(realCore, fixedNow);
  const a = svcReal.analyze();
  const c = svcReal.coverage();
  assert.deepEqual(a.coverageGaps, c.gaps);
});

// ═════════════════════════════════════════════════════════════════════════════
// mutation() — shape & honesty
// ═════════════════════════════════════════════════════════════════════════════

test('mutation(): returns a MutationAnalytics object', () => {
  const r = svcEmpty.mutation();
  assert.ok(r !== null && typeof r === 'object');
});

test('mutation(): connection is NOT_CONNECTED', () => {
  const r = svcEmpty.mutation();
  assert.equal(r.connection, 'NOT_CONNECTED');
});

test('mutation(): mutationScore is null (never fabricated)', () => {
  const r = svcEmpty.mutation();
  assert.equal(r.mutationScore, null);
});

test('mutation(): mutationScore is never a number', () => {
  const r = svcEmpty.mutation();
  assert.ok(typeof r.mutationScore !== 'number', 'mutation score must not be a number');
});

test('mutation(): liveSource names stryker', () => {
  const r = svcEmpty.mutation();
  assert.ok(r.liveSource.includes('stryker') || r.liveSource.includes('mutation'));
});

test('mutation(): liveSource is non-empty', () => {
  const r = svcEmpty.mutation();
  assert.ok(typeof r.liveSource === 'string' && r.liveSource.length > 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// flaky() — shape & honesty
// ═════════════════════════════════════════════════════════════════════════════

test('flaky(): returns a FlakyReport object', () => {
  const r = svcEmpty.flaky();
  assert.ok(r !== null && typeof r === 'object');
});

test('flaky(): connection is NOT_CONNECTED', () => {
  const r = svcEmpty.flaky();
  assert.equal(r.connection, 'NOT_CONNECTED');
});

test('flaky(): flakyTests is an empty array (NOT_CONNECTED)', () => {
  const r = svcEmpty.flaky();
  assert.deepEqual(r.flakyTests, []);
});

test('flaky(): flakyTests is an array', () => {
  const r = svcEmpty.flaky();
  assert.ok(Array.isArray(r.flakyTests));
});

test('flaky(): liveSource names CI retry history / test-run store', () => {
  const r = svcEmpty.flaky();
  assert.ok(r.liveSource.includes('CI') || r.liveSource.includes('retry') || r.liveSource.includes('test-run'));
});

test('flaky(): liveSource is non-empty', () => {
  const r = svcEmpty.flaky();
  assert.ok(typeof r.liveSource === 'string' && r.liveSource.length > 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// DETERMINISM
// ═════════════════════════════════════════════════════════════════════════════

test('determinism: analyze() — same engine + fixed now → deep-equal', () => {
  const a = svcEmpty.analyze();
  const b = svcEmpty.analyze();
  assert.deepEqual(a, b);
});

test('determinism: coverage() → deep-equal', () => {
  const a = svcEmpty.coverage();
  const b = svcEmpty.coverage();
  assert.deepEqual(a, b);
});

test('determinism: mutation() → deep-equal', () => {
  const a = svcEmpty.mutation();
  const b = svcEmpty.mutation();
  assert.deepEqual(a, b);
});

test('determinism: flaky() → deep-equal', () => {
  const a = svcEmpty.flaky();
  const b = svcEmpty.flaky();
  assert.deepEqual(a, b);
});

test('determinism: analyze() with plain stub → deep-equal across two calls', () => {
  const a = svcPlain.analyze();
  const b = svcPlain.analyze();
  assert.deepEqual(a, b);
});

test('determinism: two independent services on same engine → same analyze() output', () => {
  const s1 = new TestAnalyticsService(emptyCore, fixedNow);
  const s2 = new TestAnalyticsService(emptyCore, fixedNow);
  assert.deepEqual(s1.analyze(), s2.analyze());
});

test('determinism: two independent services on same engine → same coverage() output', () => {
  const s1 = new TestAnalyticsService(emptyCore, fixedNow);
  const s2 = new TestAnalyticsService(emptyCore, fixedNow);
  assert.deepEqual(s1.coverage(), s2.coverage());
});

// ═════════════════════════════════════════════════════════════════════════════
// DIFFERENT STUBS — no fabrication under any store configuration
// ═════════════════════════════════════════════════════════════════════════════

test('money stub: analyze() does not fabricate pass rate', () => {
  const r = svcMoney.analyze();
  assert.equal(r.passRate.value, null);
  assert.equal(r.passRate.connection, 'NOT_CONNECTED');
});

test('money stub: coverage() linePct is null', () => {
  const r = svcMoney.coverage();
  assert.equal(r.linePct, null);
});

test('money stub: coverage() branchPct is null', () => {
  const r = svcMoney.coverage();
  assert.equal(r.branchPct, null);
});

test('money stub: mutation() mutationScore is null', () => {
  const r = svcMoney.mutation();
  assert.equal(r.mutationScore, null);
});

test('money stub: flaky() flakyTests is []', () => {
  const r = svcMoney.flaky();
  assert.deepEqual(r.flakyTests, []);
});

test('plain stub: analyze() does not fabricate pass rate', () => {
  const r = svcPlain.analyze();
  assert.equal(r.passRate.value, null);
});

test('plain stub: mutation() is NOT_CONNECTED', () => {
  const r = svcPlain.mutation();
  assert.equal(r.connection, 'NOT_CONNECTED');
});

// ═════════════════════════════════════════════════════════════════════════════
// REAL ARTIFACTS — validate that TestAnalyticsService works end-to-end
// ═════════════════════════════════════════════════════════════════════════════

test('real engine: analyze() does not throw', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  assert.doesNotThrow(() => svc.analyze());
});

test('real engine: coverage() does not throw', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  assert.doesNotThrow(() => svc.coverage());
});

test('real engine: mutation() does not throw', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  assert.doesNotThrow(() => svc.mutation());
});

test('real engine: flaky() does not throw', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  assert.doesNotThrow(() => svc.flaky());
});

test('real engine: passRate.connection is NOT_CONNECTED', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  assert.equal(svc.analyze().passRate.connection, 'NOT_CONNECTED');
});

test('real engine: passRate.value is null', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  assert.equal(svc.analyze().passRate.value, null);
});

test('real engine: coverage() connection is NOT_CONNECTED', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  assert.equal(svc.coverage().connection, 'NOT_CONNECTED');
});

test('real engine: mutation() connection is NOT_CONNECTED', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  assert.equal(svc.mutation().connection, 'NOT_CONNECTED');
});

test('real engine: flaky() connection is NOT_CONNECTED', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  assert.equal(svc.flaky().connection, 'NOT_CONNECTED');
});

test('real engine: mutation() mutationScore is null', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  assert.equal(svc.mutation().mutationScore, null);
});

test('real engine: coverageGaps are all CONNECTED', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  const r = svc.analyze();
  for (const g of r.coverageGaps) {
    assert.equal(g.connection, 'CONNECTED');
  }
});

test('real engine: coverage().gaps match analyze().coverageGaps', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  assert.deepEqual(svc.analyze().coverageGaps, svc.coverage().gaps);
});

test('real engine: plannedTests is a non-negative integer', () => {
  const svc = new TestAnalyticsService(createEngine(), fixedNow);
  const r = svc.analyze();
  assert.ok(typeof r.plannedTests === 'number' && r.plannedTests >= 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// ABSOLUTELY NO FABRICATED PERCENTAGES
// ═════════════════════════════════════════════════════════════════════════════

test('no fabricated linePct across empty stub', () => {
  assert.equal(svcEmpty.coverage().linePct, null);
});

test('no fabricated branchPct across empty stub', () => {
  assert.equal(svcEmpty.coverage().branchPct, null);
});

test('no fabricated mutationScore across empty stub', () => {
  assert.equal(svcEmpty.mutation().mutationScore, null);
});

test('no fabricated pass-rate value across empty stub', () => {
  assert.equal(svcEmpty.analyze().passRate.value, null);
});

test('no fabricated linePct across money stub', () => {
  assert.equal(svcMoney.coverage().linePct, null);
});

test('no fabricated branchPct across money stub', () => {
  assert.equal(svcMoney.coverage().branchPct, null);
});

test('no fabricated mutationScore across money stub', () => {
  assert.equal(svcMoney.mutation().mutationScore, null);
});

// ═════════════════════════════════════════════════════════════════════════════
// LIVE SOURCE STRINGS — exact provenance
// ═════════════════════════════════════════════════════════════════════════════

test('liveSource: passRate names node --test or vitest', () => {
  const r = svcEmpty.analyze();
  const src = r.passRate.liveSource;
  assert.ok(src.includes('node') || src.includes('vitest') || src.includes('test-run'), `passRate liveSource: "${src}"`);
});

test('liveSource: coverage names c8 or istanbul or lcov', () => {
  const src = svcEmpty.coverage().liveSource;
  assert.ok(src.includes('c8') || src.includes('istanbul') || src.includes('lcov'), `coverage liveSource: "${src}"`);
});

test('liveSource: mutation names stryker', () => {
  const src = svcEmpty.mutation().liveSource;
  assert.ok(src.includes('stryker'), `mutation liveSource: "${src}"`);
});

test('liveSource: flaky names CI retry history or test-run store', () => {
  const src = svcEmpty.flaky().liveSource;
  assert.ok(src.includes('CI') || src.includes('retry') || src.includes('test-run'), `flaky liveSource: "${src}"`);
});
