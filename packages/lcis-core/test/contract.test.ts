/**
 * Contract tests — enforce the consolidation rules structurally so the engine
 * cannot regress into the patterns it was built to eliminate.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const srcDir = join(pkgRoot, 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (entry.endsWith('.ts')) out.push(p);
  }
  return out;
}

const GENERATION = /^(v\d+|omega|infinity|genesis)$/i;

test('no source file path encodes a generation name (V1/V2/.../OMEGA/INFINITY/GENESIS)', () => {
  const files = walk(srcDir).map((f) => f.slice(srcDir.length + 1));
  const offenders = files.filter((rel) =>
    rel.split(/[\\/_.-]/).some((seg) => GENERATION.test(seg)),
  );
  assert.deepEqual(offenders, [], `generation-named source files found: ${offenders.join(', ')}`);
});

test('package declares no forbidden runtime dependency (no Qdrant/embeddings/OpenAI/GraphRAG/Playwright/OTel)', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  const deps = Object.keys(pkg.dependencies ?? {});
  const forbidden = /qdrant|openai|graphrag|crawl4ai|playwright|signoz|@opentelemetry|chromadb|pinecone|weaviate/i;
  const offenders = deps.filter((d) => forbidden.test(d));
  assert.deepEqual(offenders, [], `forbidden runtime dependencies: ${offenders.join(', ')}`);
  // The engine is deterministic: zod (validation) is the only runtime dependency.
  assert.deepEqual(deps.sort(), ['zod'], `unexpected runtime deps: ${deps.join(', ')}`);
});

test('every service module is reachable from the package barrel', () => {
  const index = readFileSync(join(srcDir, 'index.ts'), 'utf8');
  for (const mod of ['contracts', 'runtime', 'graph', 'blast-radius', 'memory', 'decision', 'architecture', 'verification']) {
    assert.ok(index.includes(`./${mod}/index`), `src/index.ts must export ./${mod}/index`);
  }
});
