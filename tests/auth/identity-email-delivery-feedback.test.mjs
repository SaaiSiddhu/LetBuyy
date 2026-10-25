import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual page handlers with bounded browser/network ports. No email,
// token provider, database or user browser is contacted by this regression suite.
function handler(page, name, context) {
  const file = `apps/platform/identity/src/app/${page}/page.tsx`;
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) expression = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression, `${name} exists in the real page`);
  const code = ts.transpileModule(`globalThis.run = ${expression.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const sandbox = vm.createContext(context);
  new vm.Script(code, { filename: file }).runInContext(sandbox);
  return sandbox.run;
}

function fixture(status = 200, payload = { success: true }, kind = 'magic_link') {
  const calls = [], errors = [], countdowns = [], resendEnabled = [];
  const context = {
    email: 'email-delivery@example.invalid', type: kind, canResend: true, resending: false,
    turnstileToken: 'fresh-synthetic-proof', turnstileTokenRef: { current: 'fresh-synthetic-proof' },
    turnstileEnabled: true, turnstileRef: { current: { reset() { calls.push({ reset: true }); } } },
    setTurnstileToken() {}, setLoading() {}, setResending() {},
    setError(value) { errors.push(value); },
    setCountdown(value) { countdowns.push(value); }, setCanResend(value) { resendEnabled.push(value); },
    t: { rateLimited: 'rate-limited', botFailed: 'verification-required', sendFailed: 'email-send-failed',
      requestFailed: 'refresh-required', networkFailed: 'network-failed' },
    getAuthHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'synthetic-csrf' }),
    fetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
      return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
    },
    window: { location: { href: '' } }, encodeURIComponent,
  };
  return { context, calls, errors, countdowns, resendEnabled };
}

for (const [status, payload, expected] of [
  [429, { error: 'Too many requests' }, 'rate-limited'],
  [403, { error: 'Bot verification failed.' }, 'verification-required'],
  [502, { error: 'Provider rejected the email' }, 'email-send-failed'],
  [200, { success: false }, 'email-send-failed'],
]) {
  test(`lookup keeps the user on login and shows a safe error for rejected send ${status}`, async () => {
    const f = fixture(status, payload);
    await handler('lookup', 'handleSendMagicLink', f.context)();
    assert.equal(f.context.window.location.href, '');
    assert.equal(f.errors.at(-1), expected);
    assert.ok(f.calls.some(c => c.reset));
    assert.equal(f.context.turnstileTokenRef.current, null);
  });
  test(`resend does not start a success cooldown for rejected send ${status}`, async () => {
    const f = fixture(status, payload);
    await handler('check-email', 'handleResend', f.context)();
    assert.deepEqual(f.countdowns, []);
    assert.deepEqual(f.resendEnabled, []);
    assert.equal(f.errors.at(-1), expected);
  });
}

test('lookup reaches check-email only after an acknowledged successful request', async () => {
  const f = fixture();
  await handler('lookup', 'handleSendMagicLink', f.context)();
  assert.match(f.context.window.location.href, /^\/check-email\?email=.*&type=magic_link$/);
  assert.equal(f.calls[0].body.turnstileToken, 'fresh-synthetic-proof');
  assert.equal(f.errors.at(-1), null);
});

for (const [kind, endpoint] of [
  ['magic_link', '/api/auth/send-magic'], ['password_reset', '/api/auth/send-reset'], ['email_verify', '/api/auth/signup'],
]) {
  test(`resend ${kind} uses the genuine fresh proof and correct existing endpoint`, async () => {
    const f = fixture(200, { success: true }, kind);
    await handler('check-email', 'handleResend', f.context)();
    const call = f.calls.find(c => c.url);
    assert.equal(call.url, endpoint);
    assert.equal(call.body.turnstileToken, 'fresh-synthetic-proof');
    assert.equal(call.headers['X-CSRF-Token'], 'synthetic-csrf');
    assert.deepEqual(f.countdowns, [60]);
    assert.deepEqual(f.resendEnabled, [false]);
    assert.ok(f.calls.some(c => c.reset));
  });
}

test('resend without a current proof performs no request and explains verification', async () => {
  const f = fixture(); f.context.turnstileToken = null; f.context.turnstileTokenRef.current = null;
  await handler('check-email', 'handleResend', f.context)();
  assert.equal(f.calls.some(c => c.url), false);
  assert.equal(f.errors.at(-1), 'verification-required');
});

for (const page of ['lookup', 'check-email']) {
  test(`${page} exposes a network failure without a success transition`, async () => {
    const f = fixture(); f.context.fetch = async () => { throw new Error('synthetic offline'); };
    await handler(page, page === 'lookup' ? 'handleSendMagicLink' : 'handleResend', f.context)();
    assert.equal(f.context.window.location.href, '');
    assert.deepEqual(f.countdowns, []);
    assert.equal(f.errors.at(-1), 'network-failed');
  });
}


test('email lookup stays busy until its automatic magic-link request finishes', async () => {
  const f = fixture(); const loading = []; let release;
  f.context.setLoading = value => loading.push(value);
  f.context.fetch = async () => new Response(JSON.stringify({ exists: true, hasPassword: false }));
  f.context.handleSendMagicLink = () => new Promise(resolve => { release = resolve; });
  const pending = handler('lookup', 'handleEmailContinue', f.context)({ preventDefault() {} });
  for (let i = 0; i < 10 && !release; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof release, 'function');
  try { assert.equal(loading.at(-1), true); }
  finally { release(); await pending; }
  assert.equal(loading.at(-1), false);
});
