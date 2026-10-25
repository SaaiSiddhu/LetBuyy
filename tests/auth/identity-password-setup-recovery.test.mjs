import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

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
  assert.equal(response.location, '/onboarding');
  assert.ok(f.calls.includes('session'));
  assert.ok(!f.calls.includes('intent'));
});
