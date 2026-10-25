import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const configUrl = new URL('../../apps/commerce/web/next.config.ts', import.meta.url);
const requireApp = createRequire(configUrl);
const ts = requireApp('typescript');
const { pathToRegexp } = requireApp('next/dist/compiled/path-to-regexp');
const configSource = readFileSync(configUrl, 'utf8').replaceAll('import.meta.url', JSON.stringify(configUrl.href));
const brandSource = readFileSync(new URL('../../packages/shared-types/src/brand.ts', import.meta.url), 'utf8');
const securitySource = readFileSync(new URL('../../config/security/next-security-headers.ts', import.meta.url), 'utf8');

function loadModule(source, env, require) {
  const exports = {};
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require, process: { env }, URL });
  return exports;
}

async function headersFor(env, path) {
  const security = loadModule(securitySource, env, requireApp);
  const brand = loadModule(brandSource, env, requireApp);
  const config = loadModule(configSource, env, id => id === '../../../config/security/next-security-headers' ? security : id === '@letbuyy/shared-types' ? brand : requireApp(id)).default;
  const entries = await config.headers();
  const matches = entries.filter(entry => pathToRegexp(entry.source).test(path));
  return new Map(matches.flatMap(entry => entry.headers.map(header => [header.key.toLowerCase(), header.value])));
}

const configured = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_ADMIN_URL: 'https://admin.example.invalid',
  ADMIN_ORIGIN: 'https://ops.example.invalid',
  NEXT_PUBLIC_THEME_MARKETPLACE_URL: 'http://localhost:9005/themes',
};
const ancestors = headers => headers.get('content-security-policy').split('; ').find(value => value.startsWith('frame-ancestors '));

test('public demo responses allow exactly configured marketplace/admin origins and retain other security headers', async () => {
  for (const path of ['/theme-preview', '/theme-preview/letbuyy-sense', '/theme-preview/letbuyy-forge']) {
    const headers = await headersFor(configured, path);
    assert.equal(ancestors(headers), "frame-ancestors 'self' https://admin.example.invalid https://ops.example.invalid http://localhost:9005");
    assert.equal(headers.has('x-frame-options'), false, 'no overlapping SAMEORIGIN header can block the public embed');
    assert.equal(headers.get('cache-control'), 'private, no-store');
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.match(headers.get('content-security-policy'), /object-src 'none'/);
  }
});

test('buyer, checkout, private preview and API responses keep their existing frame policy', async () => {
  for (const path of ['/', '/store/syn-example/products', '/checkout', '/account/login', '/preview/private-draft', '/api/buyer-auth/session', '/theme-preview-other']) {
    const headers = await headersFor(configured, path);
    assert.equal(ancestors(headers), "frame-ancestors 'self' https://admin.example.invalid https://ops.example.invalid");
    assert.equal(headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.doesNotMatch(ancestors(headers), /9005/);
  }
});

test('missing, malformed, wildcard, credentialed and executable marketplace origins never broaden framing', async () => {
  for (const value of [undefined, '', '*', 'https://*.example.invalid', '//untrusted.invalid', 'javascript:alert(1)', 'data:text/html,hello', 'https://user:secret@untrusted.invalid', 'https://good.invalid https://bad.invalid']) {
    const headers = await headersFor({ ...configured, NEXT_PUBLIC_THEME_MARKETPLACE_URL: value }, '/theme-preview/letbuyy-sense');
    assert.equal(ancestors(headers), "frame-ancestors 'self' https://admin.example.invalid https://ops.example.invalid");
  }
  const headers = await headersFor({ NODE_ENV: 'production', NEXT_PUBLIC_THEME_MARKETPLACE_URL: 'https://themes.example.invalid/list?origin=https://untrusted.invalid' }, '/theme-preview/letbuyy-sense');
  assert.equal(ancestors(headers), "frame-ancestors 'self' https://themes.example.invalid");
  assert.doesNotMatch(ancestors(headers), /untrusted/);
});
