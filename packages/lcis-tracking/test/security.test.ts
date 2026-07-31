/**
 * LCTS security scan tests — mirror of the lcis-orchestration pattern.
 *
 * Every file under packages/lcis-tracking/src/ is walked recursively (comments stripped)
 * and asserted to contain NO execution, filesystem-write, network, forbidden-import,
 * DB-mutation, wall-clock, or AI primitives. LCTS tracks change; it never performs it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = new URL('../src', import.meta.url).pathname;
const PKG_JSON = new URL('../package.json', import.meta.url).pathname;

// ── helpers ────────────────────────────────────────────────────────────────────

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
const ALL_SRC = SRC_FILES.map(strippedSource).join('\n');

// ── token lists ────────────────────────────────────────────────────────────────

/** Shell / execution — LCTS never runs anything. */
const FORBIDDEN_EXECUTION = [
  'child_process', 'spawn(', 'execSync', 'exec(', '.exec(', 'eval(', 'new Function(',
];

/** Filesystem mutation — LCTS is read-only. */
const FORBIDDEN_FS_WRITE = [
  'writeFile', 'appendFile', 'unlink', 'rmSync', 'rmdir', 'mkdir',
  'rename(', 'copyFile', 'chmod', 'createWriteStream',
];

/** Network primitives — LCTS reads composed artifacts, makes no calls. */
const FORBIDDEN_NETWORK = [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'http.request', 'https.request',
];

/** Module imports that would even make the above possible. */
const FORBIDDEN_IMPORTS = [
  "from 'node:child_process'", 'from "node:child_process"', "from 'child_process'",
  "from 'node:fs'", 'from "node:fs"', "from 'fs'", "from 'node:fs/promises'",
  'from "node:fs/promises"',
  "from 'node:http'", 'from "node:http"', "from 'node:https'", 'from "node:https"',
  "from 'node:net'", 'from "node:net"', "from 'node:dgram'", 'from "node:dgram"',
  "from 'node:worker_threads'", 'from "node:worker_threads"',
  "require(",
];

/** DB mutation helpers — LCTS never writes to the database. */
const FORBIDDEN_DB = ['.insert(', '.update(', '.delete(', '.upsert(', '.rpc('];

/** Wall-clock primitives — tests inject a clock so 'new Date()' with no arg is forbidden. */
const FORBIDDEN_WALL_CLOCK = ['Date.now(', 'new Date()'];

/** AI/embedding/vector primitives — LCTS derives from structural artifacts only. */
const FORBIDDEN_AI = [
  'openai', 'anthropic', 'embedding', 'qdrant', 'Qdrant', 'langchain', 'llm(', 'LLM(',
];

// ── coverage meta-test ─────────────────────────────────────────────────────────

test('security scan: src tree is non-empty and contains the shared directory', () => {
  assert.ok(SRC_FILES.length >= 1, `expected at least 1 source file, found ${SRC_FILES.length}`);
  assert.ok(
    SRC_FILES.some((f) => f.includes('/src/shared/')),
    'no files found under src/shared/',
  );
});

test('security scan: every scanned path resolves to an existing .ts file', () => {
  for (const f of SRC_FILES) {
    assert.ok(f.endsWith('.ts'), `non-.ts file in walk result: ${f}`);
    // statSync would have thrown in walk() if the file didn't exist
    assert.ok(f.length > 0);
  }
});

// ── per-file scans ─────────────────────────────────────────────────────────────

for (const file of SRC_FILES) {
  const rel = file.slice(SRC_ROOT.length + 1);
  const src = strippedSource(file);

  test(`NO EXEC — ${rel}: no execution/shell primitives`, () => {
    for (const tok of FORBIDDEN_EXECUTION) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden execution token: '${tok}'`);
    }
  });

  test(`NO WRITE — ${rel}: no filesystem mutation primitives`, () => {
    for (const tok of FORBIDDEN_FS_WRITE) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden fs-write token: '${tok}'`);
    }
  });

  test(`NO NETWORK — ${rel}: no network primitives`, () => {
    for (const tok of FORBIDDEN_NETWORK) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden network token: '${tok}'`);
    }
  });

  test(`NO IO IMPORTS — ${rel}: no fs/net/process/child_process imports`, () => {
    for (const tok of FORBIDDEN_IMPORTS) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden import: '${tok}'`);
    }
  });

  test(`NO DB MUTATION — ${rel}: no insert/update/delete/upsert/rpc calls`, () => {
    for (const tok of FORBIDDEN_DB) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden DB mutation token: '${tok}'`);
    }
  });

  test(`NO WALL CLOCK — ${rel}: no bare Date.now() or new Date() with no argument`, () => {
    // shared/envelope.ts is the single canonical clock-injection point (defaultNow).
    // Every other file must use the injected `now` callback — never bare Date.now() / new Date().
    if (rel === 'shared/envelope.ts') return;
    for (const tok of FORBIDDEN_WALL_CLOCK) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden wall-clock token: '${tok}'`);
    }
  });
}

// ── aggregate AI scan ──────────────────────────────────────────────────────────

test('NO AI — src has no LLM/embedding/vector-db imports or clients', () => {
  for (const tok of FORBIDDEN_AI) {
    assert.ok(!ALL_SRC.includes(tok), `src contains forbidden AI token: '${tok}'`);
  }
});

// ── package.json checks ────────────────────────────────────────────────────────

test('dependencies are exactly the five approved composition targets + zod', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { dependencies?: Record<string, string> };
  const deps = Object.keys(pkg.dependencies ?? {}).sort();
  assert.deepEqual(deps, [
    '@letbuyy/lcis-adapters',
    '@letbuyy/lcis-core',
    '@letbuyy/lcis-engineering',
    '@letbuyy/lcis-governance',
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

test('package.json name is @letbuyy/lcis-tracking', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { name?: string };
  assert.equal(pkg.name, '@letbuyy/lcis-tracking');
});

test('package.json has type=module (ESM — import.meta.url is required for path resolution)', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { type?: string };
  assert.equal(pkg.type, 'module');
});
