import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// LB-1 (V1_SCOPE_LOCK_2026_06_12): the storefront host-routing proxy must be
// wired as Next.js middleware. Without src/middleware.ts, subdomain and
// custom-domain routing never executes in production.

const repoRoot = process.cwd();
const middlewarePath = path.join(
  repoRoot,
  'apps/storefront-runtime/src/middleware.ts',
);
const proxyPath = path.join(repoRoot, 'apps/storefront-runtime/src/proxy.ts');

test('LB-1: storefront middleware.ts exists', () => {
  assert.doesNotThrow(() => readFileSync(middlewarePath, 'utf8'));
});

test('LB-1: middleware.ts re-exports proxy as the middleware entry point', () => {
  const source = readFileSync(middlewarePath, 'utf8');
  assert.match(
    source,
    /export\s*\{\s*proxy\s+as\s+middleware\s*\}\s*from\s*'\.\/proxy'/,
    'middleware.ts must re-export proxy as middleware from ./proxy',
  );
});

test('LB-1: middleware.ts exports a static config with a matcher', () => {
  const source = readFileSync(middlewarePath, 'utf8');
  assert.match(
    source,
    /export\s+const\s+config\s*=\s*\{/,
    'middleware.ts must export an inline config object (Next.js statically analyses it)',
  );
  assert.match(source, /matcher\s*:/, 'config must define a matcher');
});

test('LB-1: middleware matcher stays in sync with proxy.ts matcher', () => {
  const middlewareSource = readFileSync(middlewarePath, 'utf8');
  const proxySource = readFileSync(proxyPath, 'utf8');
  const extract = (source) => {
    const match = source.match(/matcher\s*:\s*\[\s*'([^']+)'\s*\]/);
    return match ? match[1] : null;
  };
  const middlewareMatcher = extract(middlewareSource);
  const proxyMatcher = extract(proxySource);
  assert.ok(middlewareMatcher, 'middleware.ts matcher not found');
  assert.ok(proxyMatcher, 'proxy.ts matcher not found');
  assert.equal(
    middlewareMatcher,
    proxyMatcher,
    'middleware.ts matcher must equal proxy.ts matcher',
  );
});
