/**
 * test/security.test.ts — LSAS mandatory source-scan tests.
 *
 * Mirrors packages/lcis-twin/test/security.test.ts EXACTLY in structure.
 * RULE 3 (READ ONLY) enforced against the REAL source tree: every file under src/ is scanned
 * (comments stripped) for execution, mutation, filesystem-write, and network primitives.
 * LSAS is a pure computation layer — it never executes, writes, or makes network calls.
 * These tests fail the suite the moment anyone introduces exec/spawn/child_process/writeFile/
 * fetch/network/mutation/AI into the package.
 *
 * Also checks: advisory literal in RiskScoringService, dependency allowlist, wall-clock ban,
 * mutation-verb ban, package governance.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = new URL('../src', import.meta.url).pathname;
const PKG_JSON = new URL('../package.json', import.meta.url).pathname;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function strippedSource(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (incl. JSDoc)
    .replace(/\/\/.*$/gm, '');         // single-line comments
}

const SRC_FILES = walk(SRC_ROOT);

/** Execution / shell primitives — LSAS must never run anything. */
const FORBIDDEN_EXECUTION = [
  'child_process',
  'spawn(',
  'spawnSync',
  'execSync',
  'execFile',
  ' exec(',
  '.exec(',
  'eval(',
  'new Function(',
];

/** Filesystem mutation primitives — LSAS must never write, delete, or move files. */
const FORBIDDEN_FS_WRITE = [
  'writeFile',
  'appendFile',
  'unlink',
  'rmSync',
  'rmdir',
  'mkdir',
  'renameSync',
  'rename(',
  'copyFile',
  'chmod',
  'chown',
  'truncate',
  'createWriteStream',
];

/** Network primitives — LSAS is a pure computation layer; it makes no outbound calls. */
const FORBIDDEN_NETWORK = [
  'fetch(',
  'XMLHttpRequest',
  'new WebSocket',
  'http.request',
  'https.request',
  'net.connect',
  'net.createServer',
  'dgram.',
];

/** Module imports that would even make the above possible. */
const FORBIDDEN_IMPORTS = [
  "from 'node:child_process'",
  'from "node:child_process"',
  "from 'child_process'",
  "from 'node:fs'",
  'from "node:fs"',
  "from 'fs'",
  "from 'node:fs/promises'",
  "from 'node:http'",
  "from 'node:https'",
  "from 'node:net'",
  "from 'node:dgram'",
  "from 'node:worker_threads'",
  "from 'node:cluster'",
  'require(',
];

// ── Coverage gate ──────────────────────────────────────────────────────────────

test('security scan covers the full src tree (shared + risk + engine)', () => {
  assert.ok(SRC_FILES.length >= 4, `expected >= 4 source files, found ${SRC_FILES.length}`);
  // Verify at least one file per known sub-tree exists.
  const expectedSubtrees = ['shared', 'risk'];
  for (const d of expectedSubtrees) {
    assert.ok(
      SRC_FILES.some((f) => f.includes(`/src/${d}/`)),
      `no files scanned under src/${d}/`,
    );
  }
  // engine.ts lives at src root — verify it is included.
  assert.ok(
    SRC_FILES.some((f) => f.endsWith('/src/engine.ts')),
    'src/engine.ts not found in scan',
  );
});

test('security scan finds the frozen shared types and envelope', () => {
  assert.ok(SRC_FILES.some((f) => f.endsWith('shared/types.ts')), 'shared/types.ts missing from scan');
  assert.ok(SRC_FILES.some((f) => f.endsWith('shared/envelope.ts')), 'shared/envelope.ts missing from scan');
});

test('security scan finds the frozen shared rules file', () => {
  assert.ok(
    SRC_FILES.some((f) => f.endsWith('shared/rules.ts')),
    'shared/rules.ts missing from scan',
  );
});

test('security scan finds the RiskScoringService implementation', () => {
  assert.ok(
    SRC_FILES.some((f) => f.endsWith('risk/RiskScoringService.ts')),
    'risk/RiskScoringService.ts missing from scan',
  );
});

// ── Per-file per-category forbids ─────────────────────────────────────────────

for (const file of SRC_FILES) {
  const rel = file.slice(SRC_ROOT.length + 1);
  const src = strippedSource(file);

  test(`NO EXEC — ${rel} has no execution/shell primitives`, () => {
    for (const tok of FORBIDDEN_EXECUTION) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden execution token: '${tok}'`);
    }
  });

  test(`NO WRITE — ${rel} has no filesystem mutation primitives`, () => {
    for (const tok of FORBIDDEN_FS_WRITE) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden fs-write token: '${tok}'`);
    }
  });

  test(`NO NETWORK — ${rel} has no network primitives`, () => {
    for (const tok of FORBIDDEN_NETWORK) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden network token: '${tok}'`);
    }
  });

  test(`NO IO IMPORTS — ${rel} imports no fs/net/process/child_process modules`, () => {
    for (const tok of FORBIDDEN_IMPORTS) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden import: '${tok}'`);
    }
  });

  test(`NO DB MUTATION — ${rel} has no .delete( + .from( DB mutation tokens`, () => {
    // '.delete(' intentionally excluded from the DB-mutation check (in-memory Map/Set.delete()
    // is legitimate; no DB client exists in this package per the dependency allowlist).
    for (const tok of ['.insert(', '.update(', '.upsert(', '.rpc(', '.from(']) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden DB mutation token: '${tok}'`);
    }
  });

  test(`NO WALL CLOCK — ${rel} has no argless Date.now() or new Date() calls`, () => {
    // The clock must always be injectable; argless Date.now() and new Date() (no arg) are
    // banned everywhere EXCEPT shared/envelope.ts — the single sanctioned clock boundary
    // (defaultNow), mirroring the pattern in other LCIS packages.
    if (rel.endsWith('shared/envelope.ts')) {
      // envelope.ts may define defaultNow via new Date(); Date.now() stays banned even there.
      assert.ok(!src.includes('Date.now('), `${rel} contains forbidden wall-clock call: 'Date.now('`);
      return;
    }
    assert.ok(!src.includes('Date.now('), `${rel} contains forbidden wall-clock call: 'Date.now('`);
    assert.ok(
      !src.match(/new Date\(\)/),
      `${rel} contains forbidden argless wall-clock call: 'new Date()'`,
    );
  });
}

// ── Whole-corpus AI token check ───────────────────────────────────────────────

test('NO AI — src has no LLM/embedding/vector-db imports or clients', () => {
  const all = SRC_FILES.map(strippedSource).join('\n');
  for (const tok of [
    'openai',
    'anthropic',
    'embedding',
    'qdrant',
    'Qdrant',
    'langchain',
    'llm(',
    'LLM(',
  ]) {
    assert.ok(!all.includes(tok), `src contains forbidden AI token: '${tok}'`);
  }
});

// ── Advisory literal check ────────────────────────────────────────────────────

test('advisory literal true present in RiskScoringService source', () => {
  const riskSrc = readFileSync(join(SRC_ROOT, 'risk', 'RiskScoringService.ts'), 'utf8');
  // The advisory: true literal must appear verbatim in the service source.
  assert.ok(
    riskSrc.includes('advisory: true'),
    'RiskScoringService.ts missing advisory: true literal',
  );
});

test('advisory literal is not inside a comment in RiskScoringService', () => {
  const stripped = strippedSource(join(SRC_ROOT, 'risk', 'RiskScoringService.ts'));
  assert.ok(
    stripped.includes('advisory: true'),
    'advisory: true literal missing from stripped RiskScoringService source (may be comment-only)',
  );
});

// ── Package-level governance ──────────────────────────────────────────────────

test('dependencies are exactly the approved composition targets', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { dependencies?: Record<string, string> };
  const deps = Object.keys(pkg.dependencies ?? {}).sort();
  assert.deepEqual(deps, [
    '@letbuyy/lcis-adapters',
    '@letbuyy/lcis-core',
    '@letbuyy/lcis-governance',
    '@letbuyy/lcis-operations',
    '@letbuyy/lcis-tracking',
    '@letbuyy/lcis-twin',
    'zod',
  ]);
});

test('package.json scripts contain no mutation verbs (deploy/push/publish/migrate)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { scripts?: Record<string, string> };
  const scripts = Object.values(pkg.scripts ?? {}).join(' ');
  for (const verb of ['deploy', 'push', 'publish', 'migrate']) {
    assert.ok(!scripts.includes(verb), `package.json scripts contain forbidden verb: '${verb}'`);
  }
});

test('package.json has a name and it is the correct LSAS package', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { name?: string };
  assert.equal(pkg.name, '@letbuyy/lcis-security');
});

test('package.json type is "module" (ESM-only — no CommonJS)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { type?: string };
  assert.equal(pkg.type, 'module');
});

test('NO defaultNow CALL — defaultNow() in production code is only definition site (envelope.ts)', () => {
  // Only envelope.ts is permitted to define/call defaultNow() because it is the injectable
  // clock provider. Any other src file that calls defaultNow() without injection breaks the
  // LSAS determinism guarantee. We allow the definition in envelope.ts but forbid usage elsewhere.
  const nonEnvelope = SRC_FILES.filter((f) => !f.endsWith('shared/envelope.ts'));
  for (const file of nonEnvelope) {
    const src = strippedSource(file);
    // Allow import of defaultNow (type-level or value import) but forbid calling it without arg.
    // Concretely: 'defaultNow()' (invocation) must not appear outside envelope.ts.
    assert.ok(
      !src.includes('defaultNow()'),
      `${file.slice(SRC_ROOT.length + 1)} calls defaultNow() directly — pass the now() parameter instead`,
    );
  }
});
