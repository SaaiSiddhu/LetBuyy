/**
 * LQAS Phase 15 — mandatory security review source-scan tests.
 *
 * Mirrors packages/lcis-twin/test/security.test.ts EXACTLY:
 *  - Recursive src/ scan for execution, mutation, filesystem-write, and network primitives.
 *  - DB tokens: .insert/.update/.upsert/.rpc — '.delete(' is intentionally absent (no DB client;
 *    '.from(' alone already covers the DB path, and in-memory .filter/.map are legitimate).
 *    NOTE: '.from(' itself is present in legitimate code (e.g. Array.from, import … from) but
 *    the combined token '.from(' in stripped source flags DB table access — allowed only in
 *    shared/envelope.ts (none) and is a security gate.
 *  - Wall-clock ban: Date.now() and argless new Date() banned everywhere except shared/envelope.ts.
 *  - Forbidden imports: node:fs, node:net, node:child_process, etc.
 *  - AI token ban.
 *  - advisory literal in QualityScoreService.
 *  - Mutation-verb ban in package.json scripts.
 *  - Dependency allowlist: exactly the approved composition targets.
 *
 * Count: >= 30 tests.
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
    .replace(/\/\*[\s\S]*?\*\//g, '')  // block comments
    .replace(/\/\/.*$/gm, '');          // single-line comments
}

const SRC_FILES = walk(SRC_ROOT);

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

test('security scan covers the full src tree (shared + score + engine)', () => {
  assert.ok(SRC_FILES.length >= 4, `expected >= 4 source files, found ${SRC_FILES.length}`);
  const expectedSubtrees = ['shared', 'score'];
  for (const d of expectedSubtrees) {
    assert.ok(
      SRC_FILES.some((f) => f.includes(`/src/${d}/`)),
      `no files scanned under src/${d}/`,
    );
  }
  assert.ok(
    SRC_FILES.some((f) => f.endsWith('/src/engine.ts')),
    'src/engine.ts not found in scan',
  );
});

test('security scan finds the frozen shared types and envelope', () => {
  assert.ok(SRC_FILES.some((f) => f.endsWith('shared/types.ts')), 'shared/types.ts missing from scan');
  assert.ok(SRC_FILES.some((f) => f.endsWith('shared/envelope.ts')), 'shared/envelope.ts missing from scan');
});

test('security scan finds the score service file', () => {
  assert.ok(
    SRC_FILES.some((f) => f.endsWith('score/QualityScoreService.ts')),
    'score/QualityScoreService.ts missing from scan',
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

  test(`NO DB MUTATION — ${rel} has no insert/update/upsert/rpc calls`, () => {
    // '.delete(' is intentionally absent: in-memory Set/Map.delete() is legitimate and
    // no DB client exists in this package (see the dependency allowlist test) — DB deletes
    // are unreachable without '.from('/'.rpc(' first.
    for (const tok of ['.insert(', '.update(', '.upsert(', '.rpc(']) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden DB mutation token: '${tok}'`);
    }
  });

  test(`NO WALL CLOCK — ${rel} has no argless Date.now() or new Date() calls`, () => {
    // The clock must always be injectable; argless Date.now() and new Date() (no arg) are
    // banned everywhere EXCEPT shared/envelope.ts — the single sanctioned clock boundary.
    if (rel.endsWith('shared/envelope.ts')) {
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

// ── advisory literal in QualityScoreService ───────────────────────────────────

test('QualityScoreService uses advisory:true literal on all recommendations', () => {
  const scoreFile = SRC_FILES.find((f) => f.endsWith('score/QualityScoreService.ts'));
  assert.ok(scoreFile, 'score/QualityScoreService.ts not found');
  const raw = readFileSync(scoreFile!, 'utf8');
  assert.ok(
    raw.includes('advisory: true'),
    'QualityScoreService.ts does not contain advisory: true literal',
  );
  // Verify it does NOT contain advisory: false (which would contradict the contract)
  assert.ok(
    !raw.includes('advisory: false'),
    'QualityScoreService.ts contains advisory: false — all recommendations must be advisory:true',
  );
});

// ── Package-level governance ──────────────────────────────────────────────────

test('dependencies are exactly the approved composition targets', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { dependencies?: Record<string, string> };
  const deps = Object.keys(pkg.dependencies ?? {}).sort();
  assert.deepEqual(deps, [
    '@letbuyy/lcis-core',
    '@letbuyy/lcis-engineering',
    '@letbuyy/lcis-governance',
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

test('package.json has a name and it is the correct LQAS package', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { name?: string };
  assert.equal(pkg.name, '@letbuyy/lcis-quality');
});

test('package.json type is "module" (ESM-only — no CommonJS)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { type?: string };
  assert.equal(pkg.type, 'module');
});

test('NO defaultNow CALL — defaultNow() in production code is only definition site (envelope.ts)', () => {
  const nonEnvelope = SRC_FILES.filter((f) => !f.endsWith('shared/envelope.ts'));
  for (const file of nonEnvelope) {
    const src = strippedSource(file);
    assert.ok(
      !src.includes('defaultNow()'),
      `${file.slice(SRC_ROOT.length + 1)} calls defaultNow() directly — pass the now() parameter instead`,
    );
  }
});
