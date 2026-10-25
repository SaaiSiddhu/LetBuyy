import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const requireApp = createRequire(new URL('../package.json', import.meta.url));
const { transpileModule, ModuleKind, ScriptTarget } = requireApp('typescript');
const { resolveLetbuyyApiBaseUrl } = requireApp('@letbuyy/api-client');
const source = readFileSync(new URL('../src/lib/api/client.ts', import.meta.url), 'utf8');
function loadClient({ token, secret, accepted = true } = {}) {
    const calls = { cookieReads: 0, bridges: 0 };
    const exports = {};
    const code = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, Headers, Request, URL, fetch: async () => { throw new Error('Unexpected network'); }, process: { env: { LETBUYY_API_URL: 'http://127.0.0.1:9010', INTERNAL_API_SECRET: secret } },
        require(id) {
            if (id === 'server-only') return {};
            if (id === 'next/headers') return { cookies: async () => { calls.cookieReads++; return { get: () => token ? { value: token } : undefined }; } };
            if (id === '@letbuyy/api-client') return { resolveLetbuyyApiBaseUrl, createLetbuyyApiClient: options => options };
            if (id === '@letbuyy/auth-core') return {
                LETBUYY_MERCHANT_SESSION_COOKIE: 'synthetic-merchant-session',
                getLetbuyyInternalAuthSecret: env => env.INTERNAL_API_SECRET,
                createLetbuyyInternalSessionHeaders: async (session, configured) => {
                    calls.bridges++; assert.equal(session, token);
                    return configured && accepted ? { ok: true, headers: { 'X-Synthetic-Authenticated': 'yes' } }
                        : { ok: false, reason: 'Authentication unavailable' };
                },
            };
            throw new Error('Unexpected dependency: ' + id);
        },
    });
    return { create: exports.createThemeMarketplaceApiClient, calls };
}
test('public catalog client never reads or bridges an ambient merchant session', async () => {
    const client = loadClient({ token: 'synthetic-stale-token' });
    const options = await client.create();
    assert.equal(options.baseUrl, 'http://127.0.0.1:9010'); assert.equal(options.apiVersionPath, '/v1');
    assert.equal(new Headers(options.headers).has('X-Synthetic-Authenticated'), false);
    assert.deepEqual(client.calls, { cookieReads: 0, bridges: 0 });
});
test('authenticated operations require a session and a successful canonical identity bridge', async () => {
    const missing = loadClient();
    await assert.rejects(missing.create({ requireSession: true }), /Authentication required/);
    assert.deepEqual(missing.calls, { cookieReads: 1, bridges: 0 });
    for (const options of [{ token: 'synthetic-token' }, { token: 'synthetic-token', secret: 'synthetic-secret', accepted: false }]) {
        const denied = loadClient(options);
        await assert.rejects(denied.create({ requireSession: true }), /Authentication unavailable/);
        assert.deepEqual(denied.calls, { cookieReads: 1, bridges: 1 });
    }
    const accepted = loadClient({ token: 'synthetic-token', secret: 'synthetic-secret' });
    const options = await accepted.create({ requireSession: true });
    assert.equal(new Headers(options.headers).has('X-Synthetic-Authenticated'), false, 'private proof must live in the guarded transport, not reusable SDK defaults');
    assert.deepEqual(accepted.calls, { cookieReads: 1, bridges: 1 });
});

const sdk = requireApp('@letbuyy/api-client');
const canonicalAuth = requireApp('@letbuyy/auth-core');
const syntheticToken = 'm'.repeat(48), syntheticSecret = 'synthetic-marketplace-transport-secret';
const base = 'http://127.0.0.1:9010/gateway';
const header = suffix => `X-LetBuyy-Internal-${suffix}`;

function actualTransport({ token = syntheticToken, secret = syntheticSecret, configured = base + '/v1', bridgeExpired = false } = {}) {
    const calls = { cookieReads: 0, signs: 0, requests: [], consumed: new Set() };
    const clock = { now: Date.now() };
    let options;
    const network = async (input, init) => {
        const request = new Request(input, init), headers = new Headers(request.headers);
        const row = { url: request.url, method: request.method, headers, redirect: request.redirect, signal: request.signal, body: await request.text() };
        calls.requests.push(row);
        if (headers.has(header('Session-Token'))) {
            const proof = await canonicalAuth.verifyLetbuyyInternalSessionHeaders({ sessionToken: headers.get(header('Session-Token')),
                timestamp: headers.get(header('Timestamp')), jti: headers.get(header('JTI')), signature: headers.get(header('Signature')),
                secret: syntheticSecret, nowMs: clock.now });
            if (!proof.accepted || calls.consumed.has(headers.get(header('JTI')))) {
                return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'One-use proof rejected' } }, { status: 401 });
            }
            calls.consumed.add(headers.get(header('JTI')));
        }
        if (request.url.endsWith('/redirect')) return new Response(null, { status: 307, headers: { Location: 'https://attacker.invalid/collect' } });
        return Response.json({ success: true, data: request.url.includes('/library') ? { themes: [] } : { accepted: true } });
    };
    const exports = {};
    const code = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, Headers, Request, URL, fetch: network,
        process: { env: { LETBUYY_API_URL: configured, INTERNAL_API_SECRET: secret } }, require(id) {
            if (id === 'server-only') return {};
            if (id === 'next/headers') return { cookies: async () => { calls.cookieReads++; return { get: () => token === undefined || token === null ? undefined : { value: token } }; } };
            if (id === '@letbuyy/auth-core') return { ...canonicalAuth, createLetbuyyInternalSessionHeaders: async (...args) => {
                calls.signs++;
                return bridgeExpired ? { ok: false, status: 'expired', reason: 'Canonical session expired' }
                    : canonicalAuth.createLetbuyyInternalSessionHeaders(args[0], args[1], clock.now);
            } };
            if (id === '@letbuyy/api-client') return { ...sdk, createLetbuyyApiClient: captured => {
                options = captured;
                return sdk.createLetbuyyApiClient({ ...captured, fetch: captured.fetch ?? network });
            } };
            throw new Error('Unexpected dependency: ' + id);
        } });
    return { create: exports.createThemeMarketplaceApiClient, calls, clock, network, options: () => options };
}

test('real SDK install, library read and concurrent reads each get a fresh canonical one-use proof without changing intent', async () => {
    const f = actualTransport(), client = await f.create({ requireSession: true });
    const body = { store_id: '7b669c70-f000-4000-8000-000000000001', expected_version: '2.0.0' };
    await client.themes.install('letbuyy-sense', body, { idempotencyKey: 'synthetic-same-add-intent', headers: { 'X-Caller-Trace': 'preserved' } });
    await client.themes.listSiteLibrary(body.store_id);
    await Promise.all([client.themes.listSiteLibrary(body.store_id), client.themes.listSiteLibrary(body.store_id)]);
    assert.equal(f.calls.requests.length, 4);
    const first = f.calls.requests[0];
    assert.equal(first.method, 'POST'); assert.deepEqual(JSON.parse(first.body), body);
    assert.equal(first.headers.get('Content-Type'), 'application/json');
    assert.equal(first.headers.get('X-Idempotency-Key'), 'synthetic-same-add-intent');
    assert.equal(first.headers.get('X-Caller-Trace'), 'preserved');
    assert.equal(new Set(f.calls.requests.map(row => row.headers.get(header('JTI')))).size, 4);
    assert.equal(new Headers(f.options().headers).has(header('Session-Token')), false);
    const replay = await f.network(new Request(first.url, { headers: first.headers }));
    assert.equal(replay.status, 401, 'captured proof remains single-use');
});

test('an authenticated client signs at request time after idle and captured expired proof remains rejected', async () => {
    const f = actualTransport(), client = await f.create({ requireSession: true });
    f.clock.now += canonicalAuth.LETBUYY_INTERNAL_AUTH_MAX_AGE_MS + 1;
    await client.themes.listSiteLibrary('7b669c70-f000-4000-8000-000000000001');
    const first = f.calls.requests[0];
    assert.equal(first.headers.get(header('Timestamp')), String(f.clock.now));
    f.clock.now += canonicalAuth.LETBUYY_INTERNAL_AUTH_MAX_AGE_MS + 1;
    assert.equal((await f.network(new Request(first.url, { headers: first.headers }))).status, 401);
    await client.themes.listSiteLibrary('7b669c70-f000-4000-8000-000000000001');
});

test('authenticated SDK overrides and foreign Request inputs cannot receive private proof outside the configured API origin and base path', async () => {
    const f = actualTransport(), client = await f.create({ requireSession: true });
    for (const baseUrl of ['https://attacker.invalid/gateway', 'http://127.0.0.1:9011/gateway', 'http://127.0.0.1:9010/other', 'http://127.0.0.1:9010/gateway-lookalike']) {
        await assert.rejects(client.withOptions({ baseUrl }).themes.listSiteLibrary('synthetic-site'));
    }
    await assert.rejects(client.requestData('https://attacker.invalid/collect'));
    assert.equal(typeof f.options().fetch, 'function');
    for (const input of [new Request('https://attacker.invalid/collect'), new URL('http://127.0.0.1:9010/other'), 'http://user:password@127.0.0.1:9010/gateway/v1/themes']) {
        await assert.rejects(f.options().fetch(input));
    }
    assert.equal(f.calls.requests.length, 0);
    assert.equal(f.calls.signs, 1, 'only local preflight occurs; no foreign request is signed');
});

test('missing, malformed, canonically expired or unconfigured authentication fails before network; public discovery never reads cookies', async () => {
    for (const input of [{ token: null }, { token: 'short' }, { secret: '' }, { bridgeExpired: true }, { configured: '' }]) {
        const f = actualTransport(input);
        await assert.rejects(f.create({ requireSession: true }));
        assert.equal(f.calls.requests.length, 0);
    }
    const publicClient = actualTransport({ token: 'invalid-stale-cookie', secret: '' });
    await (await publicClient.create()).themes.get('letbuyy-sense');
    assert.equal(publicClient.calls.cookieReads, 0); assert.equal(publicClient.calls.signs, 0);
    assert.equal(publicClient.calls.requests[0].headers.has(header('Session-Token')), false);
});

test('guarded fetch preserves standard Request body, headers and signal and refuses automatic credential-bearing redirects', async () => {
    const f = actualTransport(); const client = await f.create({ requireSession: true });
    assert.equal(typeof f.options().fetch, 'function');
    const controller = new AbortController();
    const input = new Request(base + '/v1/transport', { method: 'PATCH', body: 'exact request bytes', signal: controller.signal,
        headers: { 'Content-Type': 'text/plain', 'X-Caller-Trace': 'kept', 'X-Idempotency-Key': 'same-intent' } });
    await f.options().fetch(input);
    const row = f.calls.requests[0];
    assert.equal(row.method, 'PATCH'); assert.equal(row.body, 'exact request bytes');
    assert.equal(row.headers.get('X-Caller-Trace'), 'kept'); assert.equal(row.headers.get('X-Idempotency-Key'), 'same-intent');
    assert.equal(row.headers.get('Content-Type'), 'text/plain');
    controller.abort(); assert.equal(row.signal.aborted, true);
    const result = await f.options().fetch(new URL(base + '/v1/redirect'));
    assert.equal(result.status, 307); assert.equal(f.calls.requests.at(-1).redirect, 'manual');
    await assert.rejects(client.requestData('/redirect'), error => error.status === 307);
    assert.equal(f.calls.requests.length, 3, 'no redirected foreign network request');
});
test('session lookup explicitly uses the authenticated client rather than the public discovery path', () => {
    const service = readFileSync(new URL('../src/lib/theme-service.ts', import.meta.url), 'utf8');
    assert.match(service, /async getSessionUser\(\)[\s\S]*?getThemeApi\(true\)/);
});
