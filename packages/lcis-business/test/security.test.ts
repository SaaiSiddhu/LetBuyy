/**
 * LBIS security + no-fabrication source scan. Recursively walks src/ (comments stripped)
 * and asserts: no execution/fs-write/network/DB-mutation/wall-clock/AI primitives; the
 * dependency allowlist is exact; and — the LBIS-specific law — NO BusinessMetric is ever
 * constructed with a numeric literal value (every magnitude must be `value: null`).
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

function stripped(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ');
}

const SRC_FILES = walk(SRC_ROOT);
const ENVELOPE = 'shared/envelope.ts';

const FORBIDDEN_EXECUTION = ['child_process', 'spawn(', 'spawnSync', 'execSync', 'execFile', ' exec(', '.exec(', 'eval(', 'new Function('];
const FORBIDDEN_FS_WRITE = ['writeFile', 'appendFile', 'unlink', 'rmSync', 'rmdir', 'mkdir', 'renameSync', 'copyFile', 'chmod', 'createWriteStream'];
const FORBIDDEN_NETWORK = ['fetch(', 'XMLHttpRequest', 'new WebSocket', 'http.request', 'https.request', 'net.connect', 'net.createServer'];
const FORBIDDEN_IMPORTS = ["from 'node:child_process'", "from 'node:fs'", "from 'node:fs/promises'", "from 'node:http'", "from 'node:https'", "from 'node:net'", 'require('];
const FORBIDDEN_DB = ['.insert(', '.update(', '.upsert(', '.rpc(', '.from('];
const FORBIDDEN_MUTATION_VERBS = ['.deploy(', 'applyRecommendation', 'executeDecision'];

test('security scan covers the full src tree incl. all six service dirs', () => {
  assert.ok(SRC_FILES.length >= 15, `expected >= 15 files, found ${SRC_FILES.length}`);
  for (const d of ['merchant', 'revenue', 'customer', 'growth', 'finance', 'executive', 'shared']) {
    assert.ok(SRC_FILES.some((f) => f.includes(`/src/${d}/`)), `no files under src/${d}/`);
  }
});

for (const file of SRC_FILES) {
  const rel = file.slice(SRC_ROOT.length + 1);
  const src = stripped(file);

  test(`NO EXEC — ${rel}`, () => {
    for (const tok of FORBIDDEN_EXECUTION) assert.ok(!src.includes(tok), `${rel} has '${tok}'`);
  });
  test(`NO FS WRITE — ${rel}`, () => {
    for (const tok of FORBIDDEN_FS_WRITE) assert.ok(!src.includes(tok), `${rel} has '${tok}'`);
  });
  test(`NO NETWORK — ${rel}`, () => {
    for (const tok of FORBIDDEN_NETWORK) assert.ok(!src.includes(tok), `${rel} has '${tok}'`);
  });
  test(`NO IO IMPORTS — ${rel}`, () => {
    for (const tok of FORBIDDEN_IMPORTS) assert.ok(!src.includes(tok), `${rel} has '${tok}'`);
  });
  test(`NO DB MUTATION — ${rel}`, () => {
    for (const tok of FORBIDDEN_DB) assert.ok(!src.includes(tok), `${rel} has '${tok}'`);
  });
  test(`NO MUTATION VERBS — ${rel}`, () => {
    for (const tok of FORBIDDEN_MUTATION_VERBS) assert.ok(!src.includes(tok), `${rel} has '${tok}'`);
  });
  test(`NO WALL CLOCK — ${rel} (envelope.ts is the only clock boundary)`, () => {
    assert.ok(!src.includes('Date.now('), `${rel} has Date.now(`);
    if (!rel.endsWith(ENVELOPE)) {
      assert.ok(!/new Date\(\)/.test(src), `${rel} has argless new Date()`);
    }
  });
}

test('NO AI tokens anywhere in src', () => {
  const all = SRC_FILES.map(stripped).join('\n');
  for (const tok of ['openai', 'anthropic', 'embedding', 'qdrant', 'langchain']) {
    assert.ok(!all.includes(tok), `src contains AI token '${tok}'`);
  }
});

test('NO-FABRICATION LAW — no BusinessMetric literal has a numeric value', () => {
  // Scan for `value:` followed by a numeric literal inside metric construction.
  // Allowed: `value: null`, `value:null`. Forbidden: `value: 123`, `value: 3.14`.
  for (const file of SRC_FILES) {
    const src = stripped(file);
    const matches = src.match(/value\s*:\s*-?\d/g);
    assert.equal(matches, null, `${file.slice(SRC_ROOT.length + 1)} constructs a metric with a numeric value: ${matches?.join(', ')}`);
  }
});

test('dependencies are exactly the approved composition targets + zod', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { dependencies?: Record<string, string> };
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}).sort(), [
    '@letbuyy/lcis-adapters',
    '@letbuyy/lcis-core',
    '@letbuyy/lcis-operations',
    '@letbuyy/lcis-tracking',
    '@letbuyy/lcis-twin',
    'zod',
  ]);
});

test('package scripts contain no mutation verbs', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { scripts?: Record<string, string> };
  const scripts = Object.values(pkg.scripts ?? {}).join(' ');
  for (const verb of ['deploy', 'push', 'publish', 'migrate']) {
    assert.ok(!scripts.includes(verb), `scripts contain '${verb}'`);
  }
});
