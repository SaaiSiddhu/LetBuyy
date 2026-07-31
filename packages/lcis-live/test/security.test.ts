/**
 * security.test.ts — source-scan assertions for @letbuyy/lcis-live.
 *
 * lcis-live is a READ-ONLY, NO-EGRESS package. All network egress is delegated to
 * the adapter injected via LivePlatform's constructor; the src/ layer itself must
 * contain NO:
 *   - fetch( calls (direct network egress)
 *   - child_process / spawn( / exec( imports or calls (process execution)
 *   - eval( (code injection)
 *   - writeFile / appendFile / createWriteStream (filesystem writes)
 *
 * The scan strips single-line comments (// ...) and multi-line block comments
 * (/ * ... * /) before pattern-matching so that documentation references in
 * comments don't trip the test.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SRC_DIR = join(__dirname, '..', 'src');

async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...(await collectTsFiles(full)));
    } else if (e.isFile() && e.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

function stripComments(source: string): string {
  // Remove block comments first, then single-line comments.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');
}

async function loadSourceMap(): Promise<Map<string, string>> {
  const files = await collectTsFiles(SRC_DIR);
  const map = new Map<string, string>();
  for (const f of files) {
    const raw = await readFile(f, 'utf-8');
    map.set(f, stripComments(raw));
  }
  return map;
}

let _sourceMap: Map<string, string> | null = null;

async function getSourceMap(): Promise<Map<string, string>> {
  if (!_sourceMap) _sourceMap = await loadSourceMap();
  return _sourceMap;
}

function findViolations(sources: Map<string, string>, pattern: RegExp): string[] {
  const violations: string[] = [];
  for (const [file, src] of sources) {
    if (pattern.test(src)) violations.push(file);
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('security: src/ files exist and are readable (sanity)', async () => {
  const sources = await getSourceMap();
  assert.ok(sources.size >= 3, `Expected ≥3 src files, got ${sources.size}`);
});

test('security: no direct fetch( calls in src/ (egress must go through adapter HTTP clients)', async () => {
  const sources = await getSourceMap();
  const hits = findViolations(sources, /\bfetch\s*\(/);
  assert.deepEqual(hits, [], `fetch( found in src/: ${hits.join(', ')}`);
});

test('security: no child_process import in src/', async () => {
  const sources = await getSourceMap();
  const hits = findViolations(sources, /['"]child_process['"]/);
  assert.deepEqual(hits, [], `child_process import found in src/: ${hits.join(', ')}`);
});

test('security: no spawn( calls in src/', async () => {
  const sources = await getSourceMap();
  const hits = findViolations(sources, /\bspawn\s*\(/);
  assert.deepEqual(hits, [], `spawn( found in src/: ${hits.join(', ')}`);
});

test('security: no exec( calls in src/', async () => {
  const sources = await getSourceMap();
  const hits = findViolations(sources, /\bexec\s*\(/);
  assert.deepEqual(hits, [], `exec( found in src/: ${hits.join(', ')}`);
});

test('security: no eval( calls in src/', async () => {
  const sources = await getSourceMap();
  const hits = findViolations(sources, /\beval\s*\(/);
  assert.deepEqual(hits, [], `eval( found in src/: ${hits.join(', ')}`);
});

test('security: no writeFile calls in src/', async () => {
  const sources = await getSourceMap();
  const hits = findViolations(sources, /\bwriteFile\s*\(/);
  assert.deepEqual(hits, [], `writeFile( found in src/: ${hits.join(', ')}`);
});

test('security: no appendFile calls in src/', async () => {
  const sources = await getSourceMap();
  const hits = findViolations(sources, /\bappendFile\s*\(/);
  assert.deepEqual(hits, [], `appendFile( found in src/: ${hits.join(', ')}`);
});

test('security: no createWriteStream calls in src/', async () => {
  const sources = await getSourceMap();
  const hits = findViolations(sources, /\bcreateWriteStream\s*\(/);
  assert.deepEqual(hits, [], `createWriteStream( found in src/: ${hits.join(', ')}`);
});

test('security: no process.exit calls in src/', async () => {
  const sources = await getSourceMap();
  const hits = findViolations(sources, /\bprocess\.exit\s*\(/);
  assert.deepEqual(hits, [], `process.exit( found in src/: ${hits.join(', ')}`);
});

test('security: no dynamic import() of external packages in src/', async () => {
  const sources = await getSourceMap();
  // allow workspace imports and node: builtins; flag external http/process packages
  const hits: string[] = [];
  for (const [file, src] of sources) {
    // Match import('something') where 'something' is not a relative path, node: prefix, or workspace
    const matches = src.match(/\bimport\s*\(\s*['"][^.@/][^'"]*['"]\s*\)/g);
    if (matches) hits.push(`${file}: ${matches.join(', ')}`);
  }
  assert.deepEqual(hits, [], `dynamic external import() found: ${hits.join('\n')}`);
});
