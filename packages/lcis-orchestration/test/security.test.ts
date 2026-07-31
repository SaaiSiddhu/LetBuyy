/**
 * EAOS Phase 15 — mandatory security review source-scan tests.
 *
 * RULE 3 (READ ONLY) enforced against the REAL source tree: every file under src/ is scanned
 * (comments stripped) for execution, mutation, filesystem-write, and network primitives.
 * EAOS tracks execution — it never performs it. These tests fail the suite the moment anyone
 * introduces exec/spawn/child_process/writeFile/fetch/network/mutation into the package.
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
    .replace(/\/\/.*$/gm, ''); // single-line comments
}

const SRC_FILES = walk(SRC_ROOT);

/** Execution / shell primitives — EAOS must never run anything. */
const FORBIDDEN_EXECUTION = ['child_process', 'spawn(', 'spawnSync', 'execSync', 'execFile', ' exec(', '.exec(', 'eval(', 'new Function('];

/** Filesystem mutation primitives — EAOS must never write, delete, or move files. */
const FORBIDDEN_FS_WRITE = ['writeFile', 'appendFile', 'unlink', 'rmSync', 'rmdir', 'mkdir', 'renameSync', 'rename(', 'copyFile', 'chmod', 'chown', 'truncate', 'createWriteStream'];

/** Network primitives — EAOS reads the composed package; it makes no calls. */
const FORBIDDEN_NETWORK = ['fetch(', 'XMLHttpRequest', 'new WebSocket', 'http.request', 'https.request', 'net.connect', 'net.createServer', 'dgram.'];

/** Module imports that would even make the above possible. */
const FORBIDDEN_IMPORTS = [
  "from 'node:child_process'", 'from "node:child_process"', "from 'child_process'",
  "from 'node:fs'", 'from "node:fs"', "from 'fs'", "from 'node:fs/promises'",
  "from 'node:http'", "from 'node:https'", "from 'node:net'", "from 'node:dgram'",
  "from 'node:worker_threads'", "from 'node:cluster'", "require(",
];

test('security scan covers the full src tree (every service + shared + engine)', () => {
  assert.ok(SRC_FILES.length >= 20, `expected >= 20 source files, found ${SRC_FILES.length}`);
  const dirs = ['shared', 'engine', 'execution', 'agent', 'artifact', 'validation', 'status', 'rollout', 'timeline'];
  for (const d of dirs) {
    assert.ok(SRC_FILES.some((f) => f.includes(`/src/${d}/`)), `no files scanned under src/${d}/`);
  }
});

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

  test(`NO IO IMPORTS — ${rel} imports no fs/net/process modules`, () => {
    for (const tok of FORBIDDEN_IMPORTS) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden import: '${tok}'`);
    }
  });

  test(`NO DB MUTATION — ${rel} has no insert/update/delete/upsert calls`, () => {
    for (const tok of ['.insert(', '.update(', '.delete(', '.upsert(', '.rpc(']) {
      assert.ok(!src.includes(tok), `${rel} contains forbidden DB mutation token: '${tok}'`);
    }
  });
}

test('NO AI — src has no LLM/embedding/vector-db imports or clients', () => {
  const all = SRC_FILES.map(strippedSource).join('\n');
  for (const tok of ['openai', 'anthropic', 'embedding', 'qdrant', 'Qdrant', 'langchain', 'llm(', 'LLM(']) {
    assert.ok(!all.includes(tok), `src contains forbidden AI token: '${tok}'`);
  }
});

test('dependencies are exactly the six approved composition targets + zod', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { dependencies?: Record<string, string> };
  const deps = Object.keys(pkg.dependencies ?? {}).sort();
  assert.deepEqual(deps, [
    '@letbuyy/lcis-core',
    '@letbuyy/lcis-engineering',
    '@letbuyy/lcis-execution',
    '@letbuyy/lcis-governance',
    '@letbuyy/lcis-operations',
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
