/**
 * Read-only enforcement (P0). These tests FAIL THE BUILD if any adapter gains a
 * network call outside the GET-only client, or any mutation / code-execution / fs-write
 * primitive in EXECUTABLE code. Comments and string literals are stripped first, so
 * documenting the forbidden keywords in a comment is allowed; using them in code is not.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (entry.endsWith('.ts')) out.push(p);
  }
  return out;
}

const rel = (f: string): string => relative(srcDir, f).replace(/\\/g, '/');

/** Remove comments + string/template-literal contents so only executable code remains. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

// The ONLY file permitted to call fetch is the read-only GET boundary.
const FETCH_ALLOWED = new Set(['shared/http.ts']);

test('no source performs a raw network call outside shared/http.ts (the GET-only boundary)', () => {
  const offenders: string[] = [];
  for (const f of walk(srcDir)) {
    if (/\bfetch\s*\(/.test(code(readFileSync(f, 'utf8'))) && !FETCH_ALLOWED.has(rel(f))) {
      offenders.push(rel(f));
    }
  }
  assert.deepEqual(offenders, [], `raw fetch outside shared/http.ts: ${offenders.join(', ')}`);
});

test('no source contains a mutation / code-execution / filesystem-write primitive (in code)', () => {
  const FORBIDDEN =
    /child_process|\bspawn\s*\(|\bexecSync\b|\bexec\s*\(|\beval\s*\(|new Function|writeFileSync|appendFileSync|\bwriteFile\s*\(|rmSync|unlinkSync|\bmkdirSync/;
  const offenders: string[] = [];
  for (const f of walk(srcDir)) {
    if (FORBIDDEN.test(code(readFileSync(f, 'utf8')))) offenders.push(rel(f));
  }
  assert.deepEqual(offenders, [], `forbidden mutation/exec/write primitives in code: ${offenders.join(', ')}`);
});

test('the read-only HTTP client uses only the GET method (no mutating verbs)', () => {
  const http = readFileSync(join(srcDir, 'shared', 'http.ts'), 'utf8');
  assert.match(http, /method:\s*'GET'/);
  assert.doesNotMatch(http, /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/);
});
