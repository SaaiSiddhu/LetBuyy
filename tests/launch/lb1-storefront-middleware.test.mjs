import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// LB-1 (V1_SCOPE_LOCK_2026_06_12): the storefront host-routing proxy must be wired
// as Next.js middleware so subdomain / custom-domain routing executes in production.
//
// Next.js 16 renamed the middleware entry: the framework now executes `proxy.ts`
// DIRECTLY (no separate `middleware.ts`), and detecting BOTH files is a hard build
// error ("Please use proxy.ts only"). So the LB-1 wiring is now satisfied by
// proxy.ts itself — verified live by `next build` reporting "ƒ Proxy (Middleware)".

const repoRoot = process.cwd();
const middlewarePath = path.join(repoRoot, 'apps/commerce/web/src/middleware.ts');
const proxyPath = path.join(repoRoot, 'apps/commerce/web/src/proxy.ts');

test('LB-1: storefront proxy.ts exists (the Next 16 middleware entry point)', () => {
  assert.doesNotThrow(() => readFileSync(proxyPath, 'utf8'));
});

test('LB-1: the legacy middleware.ts shim is removed (Next 16 forbids both files)', () => {
  assert.equal(
    existsSync(middlewarePath),
    false,
    'middleware.ts must NOT coexist with proxy.ts — Next 16 errors the build if both are present',
  );
});

test('LB-1: proxy.ts exports the proxy middleware function', () => {
  const source = readFileSync(proxyPath, 'utf8');
  assert.match(
    source,
    /export\s+(async\s+)?function\s+proxy\s*\(/,
    'proxy.ts must export a `proxy` function (the Next 16 middleware entry)',
  );
});

test('LB-1: proxy.ts exports a static config with a host-routing matcher', () => {
  const source = readFileSync(proxyPath, 'utf8');
  assert.match(
    source,
    /export\s+const\s+config\s*=\s*\{/,
    'proxy.ts must export an inline config object (Next.js statically analyses it)',
  );
  assert.match(source, /matcher\s*:/, 'config must define a matcher');
  const matcher = source.match(/matcher\s*:\s*\[\s*'([^']+)'\s*\]/);
  assert.ok(matcher && matcher[1], 'proxy.ts matcher not found');
  // the matcher must still exclude api/ and _next/ so routing only runs on page requests
  assert.match(matcher[1], /api\//, 'matcher must exclude api/ requests');
  assert.match(matcher[1], /_next\//, 'matcher must exclude _next/ assets');
});

test('LB-1: platform instrumentation assets bypass tenant rewrites while business and near-match paths remain gated', async () => {
  const { createRequire } = await import('node:module');
  const appRequire = createRequire(new URL('../../apps/commerce/web/package.json', import.meta.url));
  // This installed Next16.1.6 export retains its pre-rename name.
  const { unstable_doesMiddlewareMatch } = appRequire('next/experimental/testing/server');
  const source = readFileSync(proxyPath, 'utf8');
  const literal = source.match(/matcher\s*:\s*\[\s*'([^']+)'\s*\]/);
  assert.ok(literal);
  const config = { matcher: [JSON.parse('"' + literal[1] + '"')] };
  for (const url of ['/_vercel/speed-insights/script.js', '/_vercel/speed-insights/vitals', '/_next/static/chunks/example.js', '/api/buyer/profile']) {
    assert.equal(unstable_doesMiddlewareMatch({config,url}),false,url);
  }
  for (const url of ['/', '/products', '/account/addresses', '/preview', '/store/synthetic-preview/account', '/store/synthetic-preview/_vercel/speed-insights/script.js', '/_vercel-store', '/_vercel']) {
    assert.equal(unstable_doesMiddlewareMatch({config,url}),true,url);
  }
});
