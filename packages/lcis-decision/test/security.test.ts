/**
 * LDSS security + safety source scan. Recursively walks src/ (comments stripped) and asserts:
 * no execution/fs-write/network/DB-mutation/wall-clock/AI primitives; the dependency allowlist
 * is exact; and — the LDSS SAFETY LAW — there is NO apply/execute/deploy path anywhere (LDSS
 * recommends only).
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
  return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

const SRC_FILES = walk(SRC_ROOT);
const ENVELOPE = 'shared/envelope.ts';

test('scan covers the full src tree incl. all six service dirs', () => {
  assert.ok(SRC_FILES.length >= 15);
  for (const d of ['alternative', 'tradeoff', 'comparison', 'affected', 'graph', 'decision-engine', 'shared']) {
    assert.ok(SRC_FILES.some((f) => f.includes(`/src/${d}/`)), `missing src/${d}/`);
  }
});

for (const file of SRC_FILES) {
  const rel = file.slice(SRC_ROOT.length + 1);
  const src = stripped(file);

  test(`NO EXEC — ${rel}`, () => {
    for (const t of ['child_process', 'spawn(', 'execSync', 'execFile', ' exec(', '.exec(', 'eval(', 'new Function(']) {
      assert.ok(!src.includes(t), `${rel} has '${t}'`);
    }
  });
  test(`NO FS WRITE — ${rel}`, () => {
    for (const t of ['writeFile', 'appendFile', 'unlink', 'rmSync', 'rmdir', 'mkdir', 'renameSync', 'copyFile', 'createWriteStream']) {
      assert.ok(!src.includes(t), `${rel} has '${t}'`);
    }
  });
  test(`NO NETWORK — ${rel}`, () => {
    for (const t of ['fetch(', 'XMLHttpRequest', 'new WebSocket', 'http.request', 'net.connect']) {
      assert.ok(!src.includes(t), `${rel} has '${t}'`);
    }
  });
  test(`NO IO IMPORTS — ${rel}`, () => {
    for (const t of ["from 'node:child_process'", "from 'node:fs'", "from 'node:http'", "from 'node:net'", 'require(']) {
      assert.ok(!src.includes(t), `${rel} has '${t}'`);
    }
  });
  test(`NO DB MUTATION — ${rel}`, () => {
    for (const t of ['.insert(', '.update(', '.upsert(', '.rpc(', '.from(']) {
      assert.ok(!src.includes(t), `${rel} has '${t}'`);
    }
  });
  test(`SAFETY LAW: no execution path — ${rel}`, () => {
    for (const t of ['.deploy(', 'applyDecision', 'executeDecision', 'apply(', '.execute(', 'performAction']) {
      assert.ok(!src.includes(t), `${rel} has execution path token '${t}'`);
    }
  });
  test(`NO WALL CLOCK — ${rel} (envelope.ts only)`, () => {
    assert.ok(!src.includes('Date.now('), `${rel} has Date.now(`);
    if (!rel.endsWith(ENVELOPE)) assert.ok(!/new Date\(\)/.test(src), `${rel} has argless new Date()`);
  });
}

test('NO AI tokens anywhere in src', () => {
  const all = SRC_FILES.map(stripped).join('\n');
  for (const t of ['openai', 'anthropic', 'embedding', 'qdrant', 'langchain']) {
    assert.ok(!all.includes(t), `src has AI token '${t}'`);
  }
});

test('dependencies are exactly the approved composition targets + zod', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { dependencies?: Record<string, string> };
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}).sort(), [
    '@letbuyy/lcis-core',
    '@letbuyy/lcis-engineering',
    '@letbuyy/lcis-operations',
    '@letbuyy/lcis-twin',
    'zod',
  ]);
});

test('scripts contain no mutation verbs', () => {
  const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { scripts?: Record<string, string> };
  const s = Object.values(pkg.scripts ?? {}).join(' ');
  for (const v of ['deploy', 'push', 'publish', 'migrate']) assert.ok(!s.includes(v), `scripts have '${v}'`);
});
