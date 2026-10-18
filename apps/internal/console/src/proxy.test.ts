import {createConsoleSessionCookieValue,identityUnitConfig} from './__tests__/identity-issuer-fixture';
// Phase 2 auth hardening (Section 6): proves the confirmed defect is closed at the actual middleware
// entry point -- Next.js 16 renamed `middleware.ts` to `proxy.ts` (tests/launch/lb1-storefront-
// middleware.test.mjs); this IS the real, live request-gating function, not a pure helper standing in
// for it. Exercises `proxy()` directly with a constructed NextRequest, the same object shape Next.js
// itself builds per request -- no mocking of the function under test.
//
// Confirmed defect (reproduced by this file's own "before the fix" case, see the first test): a
// session cookie's JWT is self-contained (signature + exp only) and says nothing about whether the
// operator's email is STILL on PLATFORM_CONSOLE_ALLOWED_EMAILS right now. Without a per-request
// re-check, removing an email from the allowlist (then redeploying) does not affect anyone already
// holding a valid, unexpired session cookie -- they keep full console access for up to
// CONSOLE_SESSION_MAX_AGE_SECONDS (8 hours). The fix re-evaluates isConsoleEmailAllowed(session.email)
// against the CURRENT env value on every request.

import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { CONSOLE_SESSION_COOKIE, readConsoleSession } from './lib/console-session';

const SESSION_SECRET = 'test-only-console-session-secret-not-a-real-value-0123456789';
const BASE_URL = 'https://console.letbuyy.test';

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
    // Transport-only unit fixture. Real persistence/role/race/revocation proof is
    // the Gateway owned-db platform-console-session suite, not this response.
    vars = { PLATFORM_CONSOLE_API_TOKEN: 'synthetic-proxy-unit-bridge', PLATFORM_CONSOLE_API_BASE_URL: 'http://127.0.0.1:59999/v1', ...vars };
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        assert.equal(url, 'http://127.0.0.1:59999/v1/internal/console/sessions/current', 'unit fixture must never reach another endpoint');
        const headers = new Headers(init?.headers);
        const payload = await readConsoleSession(headers.get('X-Platform-Console-Session'));
        assert.ok(payload?.sessionId);
        return Response.json({ success: true, data: { session_id: payload.sessionId,
            actor_id: '0e4851f5-2c96-416d-ae42-25fe5ff01ea4', mfa_verified: payload.mfaVerified } });
    };
    vars={...identityUnitConfig,...vars};
    const previous: Record<string, string | undefined> = {};
    for (const key of Object.keys(vars)) previous[key] = process.env[key];
    for (const [key, value] of Object.entries(vars)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    try {
        // Awaiting here (not just returning the promise) is load-bearing: fn crosses several real
        // await points (token signing, proxy()'s own async cookie verification), and the env vars
        // must stay in place for every one of them, not just until fn's first suspension point.
        return await fn();
    } finally {
        globalThis.fetch = previousFetch;
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

async function requestFor(path: string, cookieValue?: string): Promise<NextRequest> {
    const headers = new Headers();
    if (cookieValue) headers.set('Cookie', `${CONSOLE_SESSION_COOKIE}=${cookieValue}`);
    return new NextRequest(new URL(path, BASE_URL), { headers });
}

async function sessionCookieFor(email: string, mfaVerified: boolean): Promise<string> {
    return withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET }, async () => {
        const value = await createConsoleSessionCookieValue({ email, mfaVerified });
        assert.ok(value, 'precondition: session token creation must succeed');
        return value as string;
    });
}

test('an allowed operator with an active Gateway response passes the proxy (unit transport)', async () => {
    const cookie = await sessionCookieFor('active-operator@example.test', true);
    await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: 'active-operator@example.test' }, async () => {
        const res = await proxy(await requestFor('/dashboard', cookie));
        assert.equal(res.status, 200, 'NextResponse.next() reports as a 200 pass-through in tests');
        assert.equal(res.headers.get('location'), null);
    });
});

test('an unavailable durable session cannot loop from login back to a protected page', async () => {
    const cookie = await sessionCookieFor('active-operator@example.test', true);
    await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: 'active-operator@example.test',
        PLATFORM_CONSOLE_API_TOKEN: undefined }, async () => {
        const page = await proxy(await requestFor('/dashboard', cookie));
        assert.ok(page.headers.get('location')?.includes('/login?error=session_unavailable'));
        assert.equal(page.headers.get('set-cookie'), null, 'an unavailable verifier must preserve the retry credential');
        const login = await proxy(await requestFor('/login', cookie));
        assert.equal(login.status, 200);
        assert.equal(login.headers.get('location'), null);
    });
});

test('THE CONFIRMED DEFECT, closed: an operator removed from the allowlist is denied a protected page even with a fully valid, unexpired, MFA-verified session cookie', async () => {
    // The cookie was minted while the operator was still allowed -- this simulates exactly the
    // real-world sequence: valid login, then revocation, then a later request on the SAME cookie.
    const cookie = await sessionCookieFor('removed-operator@example.test', true);
    await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: 'someone-else@example.test' }, async () => {
        const res = await proxy(await requestFor('/dashboard', cookie));
        assert.equal(res.status, 307, 'a revoked operator must be redirected, not served the page');
        const location = res.headers.get('location');
        assert.ok(location?.includes('/login'), `expected a redirect to /login, got ${location}`);
        assert.ok(location?.includes('error=access_revoked'), `expected the revoked-access error code, got ${location}`);
        const setCookie = res.headers.get('set-cookie') || '';
        assert.match(setCookie, new RegExp(`${CONSOLE_SESSION_COOKIE}=;`), 'the dead session cookie must be cleared on the way out');
    });
});

test('a revoked operator is denied every protected path, not only the one tested above', async () => {
    const cookie = await sessionCookieFor('removed-operator@example.test', true);
    await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: '' }, async () => {
        for (const path of ['/operations', '/employees', '/audit-logs', '/settings']) {
            const res = await proxy(await requestFor(path, cookie));
            assert.equal(res.status, 307, `${path} must deny a revoked operator`);
            assert.ok(res.headers.get('location')?.includes('/login'), `${path} must redirect to /login`);
        }
    });
});

test('a revoked operator cannot complete MFA on their old session either -- /mfa itself is denied, not just the dashboard', async () => {
    const cookie = await sessionCookieFor('removed-operator@example.test', false);
    await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: '' }, async () => {
        const res = await proxy(await requestFor('/mfa', cookie));
        assert.equal(res.status, 307);
        assert.ok(res.headers.get('location')?.includes('/login'));
    });
});

test('an unauthenticated request to a protected path is redirected to login, independent of the allowlist', async () => {
    await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: 'active-operator@example.test' }, async () => {
        const res = await proxy(await requestFor('/dashboard'));
        assert.equal(res.status, 307);
        assert.ok(res.headers.get('location')?.includes('/login') || res.headers.get('location')?.includes('/lookup'));
    });
});

test('removing ONE operator from the allowlist does not affect a different, still-allowed operator', async () => {
    const removedCookie = await sessionCookieFor('removed-operator@example.test', true);
    const activeCookie = await sessionCookieFor('active-operator@example.test', true);
    await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: 'active-operator@example.test' }, async () => {
        const removedResult = await proxy(await requestFor('/dashboard', removedCookie));
        const activeResult = await proxy(await requestFor('/dashboard', activeCookie));
        assert.equal(removedResult.status, 307, 'the removed operator must be denied');
        assert.equal(activeResult.status, 200, 'a different, still-allowed operator must be entirely unaffected');
    });
});
