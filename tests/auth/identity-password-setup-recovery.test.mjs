import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';

const { z } = createRequire(new URL('../../packages/auth-core/package.json', import.meta.url))('zod');

function execute(file, name, context, effect = false) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let node;
  function visit(value) {
    if (effect && !node && ts.isCallExpression(value) && value.expression.getText(source) === 'useEffect') node = value.arguments[0];
    if (!effect && ts.isFunctionDeclaration(value) && value.name?.text === name) node = value;
    ts.forEachChild(value, visit);
  }
  visit(source);
  assert.ok(node, `${name} exists`);
  const body = effect ? node.getText(source) : node.getText(source).replace(/^export\s+/, '');
  const code = ts.transpileModule(effect ? `globalThis.run = ${body}` : `${body}; globalThis.run = ${name}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const sandbox = vm.createContext(context);
  new vm.Script(code, { filename: file }).runInContext(sandbox);
  return sandbox.run;
}
const page = 'apps/platform/identity/src/app/set-password/page.tsx';
const verify = 'apps/platform/identity/src/app/api/auth/verify/route.ts';
const setPassword = 'apps/platform/identity/src/app/api/auth/set-password/route.ts';
const tick = () => new Promise(resolve => setImmediate(resolve));

for (const [status, payload] of [[200, { canSetPassword: true }], [403, { canSetPassword: false }], [503, { error: 'Unavailable' }]]) {
  test(`password setup does not silently redirect on context status ${status}`, async () => {
    const urls = [], ready = [];
    const ctx = {
      localStorage: { getItem: () => 'en' }, setLang() {}, searchParams: new URLSearchParams(),
      returnTo: null, setUserId() {}, setUserEmail() {}, setContextReady(value) { ready.push(value); },
      setCheckingContext() {}, setContextError() {}, setError() {},
      t: { sessionExpired: 'expired', contextFailed: 'unavailable' },
      window: { location: { href: '' } }, authPathWithReturnTo: path => path,
      fetch: async url => { urls.push(url); return new Response(JSON.stringify(payload), { status }); },
    };
    execute(page, 'password context effect', ctx, true)();
    await tick(); await tick();
    assert.deepEqual(urls, ['/api/auth/set-password']);
    assert.equal(ctx.window.location.href, '');
    assert.equal(ready.at(-1), status === 200);
  });
}

test('password context is private, advisory and needs the HTTP-only intent cookie', async () => {
  for (const cookie of [undefined, 'synthetic-intent-id']) {
    const headers = [];
    const response = await execute(setPassword, 'GET', {
      getPasswordSetIntentCookie: async () => cookie,
      NextResponse: { json: (body, init) => { headers.push(init); return { body, init }; } },
    })();
    assert.equal(response.body.canSetPassword, Boolean(cookie));
    assert.equal(response.init.headers['Cache-Control'], 'private, no-store');
    assert.equal(response.init.status, cookie ? 200 : 403);
    assert.deepEqual(Object.keys(response.body), ['canSetPassword']);
  }
});

function verificationFixture(type, hasPassword = false) {
  const calls = [];
  const ctx = {
    URL, console: { error() {} },
    checkRateLimit: async () => ({ allowed: true }),
    validateToken: async () => ({ user_id: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.invalid' }),
    createPasswordSetIntent: async () => { calls.push('intent'); return { id: 'synthetic-intent-id' }; },
    setPasswordSetIntentCookie: async () => { calls.push('intent-cookie'); },
    generateDeviceFingerprint: () => 'synthetic-fingerprint',
    getOrCreateDevice: async () => { calls.push('device'); return { deviceId: 'fixture-device' }; },
    createSession: async () => { calls.push('session'); return 'fixture-session'; },
    setSessionCookie: async () => {}, addAccount: async () => {},
    getAdminDashboardUrl: () => 'https://admin.letbuyy.com/fixture',
    identityApiRequest: async path => {
      calls.push(path);
      return { ok: true, json: async () => path.endsWith('/by-email') ? { data: {
        id: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.invalid',
        email_verified: true, has_password: hasPassword,
      } } : { data: [] } };
    },
    NextResponse: { redirect: url => ({ location: url.pathname }) },
  };
  return { calls, ctx, request: { url: `https://accounts.letbuyy.com/api/auth/verify?token=synthetic-token&type=${type}`, headers: new Headers() } };
}
for (const type of ['email_verify', 'magic_link']) {
  test(`${type} hands a passwordless verified account to password setup without requiring a full session`, async () => {
    const f = verificationFixture(type);
    const response = await execute(verify, 'GET', f.ctx)(f.request);
    assert.equal(response.location, '/set-password');
    assert.ok(f.calls.includes('intent'));
    assert.ok(f.calls.includes('intent-cookie'));
    assert.ok(!f.calls.includes('session'));
  });
}
test('magic link for an account with a password preserves normal sign-in', async () => {
  const f = verificationFixture('magic_link', true);
  const response = await execute(verify, 'GET', f.ctx)(f.request);
  assert.equal(response.location, '/login');
  assert.ok(!f.calls.includes('session'));
  assert.ok(!f.calls.includes('intent'));
});

function passwordProxy(cookies = {}) {
  const source = readFileSync('apps/platform/identity/src/proxy.ts', 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const writes = [];
  const next = { kind: 'next', cookies: { set: (...args) => writes.push(args) }, headers: new Headers() };
  const ctx = { exports: {}, URL, Uint8Array, process: { env: { NODE_ENV: 'production' } },
    crypto: { getRandomValues: bytes => bytes.fill(7) }, require: name => {
      if (name === 'next/server') return { NextResponse: { next: () => next, redirect: url => ({ kind: 'redirect', location: url.pathname }) } };
      if (name === '@/lib/config/urls') return { getAdminUrl: () => 'https://admin.letbuyy.com' };
      if (name === '@letbuyy/auth-core') return { LETBUYY_MERCHANT_SESSION_COOKIE: 'lb_session', verifyLetbuyySessionCookieValue: () => ({ accepted: false }) };
      throw new Error(`Unexpected runtime import: ${name}`);
    } };
  new vm.Script(output).runInContext(vm.createContext(ctx));
  const response = ctx.exports.proxy({ nextUrl: new URL('https://accounts.letbuyy.com/set-password'), url: 'https://accounts.letbuyy.com/set-password', cookies: { get: name => cookies[name] ? { value: cookies[name] } : undefined } });
  return { response, writes };
}
for (const cookie of [undefined, 'synthetic-intent-id']) {
  test(`the production proxy renders the password shell before session creation (intent ${Boolean(cookie)})`, () => {
    const { response, writes } = passwordProxy(cookie ? { lb_password_set_intent: cookie } : {});
    assert.equal(response.kind, 'next');
    assert.ok(writes.some(row => row[0] === 'letbuyy_csrf'));
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  });
}

test('the public password shell never lets an unverified POST change a password', async () => {
  const calls = [];
  const response = await execute(setPassword, 'POST', {
    PasswordUpdateSchema: z.object({ password: z.string().min(12).max(128) }),
    MobileAuthError: class extends Error {},
    checkRateLimit: async () => ({ allowed: true }), validateCsrf: () => true,
    getPasswordSetIntentCookie: async () => undefined,
    identityApiRequest: async () => { calls.push('mutation'); },
    NextResponse: { json: (body, init) => ({ body, status: init.status }) },
    console: { error() {} },
  })({ headers: new Headers(), json: async () => ({ password: randomUUID(), userId: 'forged-user', email: 'forged@example.invalid' }) });
  assert.equal(response.status, 403);
  assert.deepEqual(calls, []);
});
