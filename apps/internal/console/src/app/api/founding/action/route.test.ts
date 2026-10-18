import {createConsoleSessionCookieValue,identityUnitConfig} from '../../../../__tests__/identity-issuer-fixture';
// Auth hardening follow-up, Section 13: founding/action and founding/export had NO session check at
// all -- reachable by anyone who could reach the console app's HTTP surface, using only the shared
// PLATFORM_CONSOLE_API_TOKEN service credential. These tests prove the fix directly, at the real
// Route Handler function, without needing a working gateway behind it: the whole point is that an
// unauthorized caller must never reach fetchConsoleApi (and therefore never reach the gateway) at all.

import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { CONSOLE_SESSION_COOKIE } from '../../../../lib/console-session';

const SESSION_SECRET = 'test-only-console-session-secret-for-founding-route-tests-0123456789';

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
    vars={...identityUnitConfig,...vars};
    const previous: Record<string, string | undefined> = {};
    for (const key of Object.keys(vars)) previous[key] = process.env[key];
    for (const [key, value] of Object.entries(vars)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    try {
        return await fn();
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

async function sessionCookieFor(email: string, mfaVerified: boolean): Promise<string> {
    return withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET }, async () => {
        const value = await createConsoleSessionCookieValue({ email, mfaVerified });
        assert.ok(value);
        return value as string;
    });
}

function requestWithCookie(cookieValue?: string): NextRequest {
    const headers = new Headers();
    if (cookieValue) headers.set('Cookie', `${CONSOLE_SESSION_COOKIE}=${cookieValue}`);
    return new NextRequest('https://console.letbuyy.test/api/founding/action', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'pause', reason: 'test' }),
    });
}

test('POST /api/founding/action: no session cookie at all is refused with 401, never reaching the gateway', async () => {
    const { POST } = await import('./route');
    const res = await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: 'operator@example.test' }, () =>
        POST(requestWithCookie()));
    assert.equal(res.status, 401);
});

test('POST /api/founding/action: a session for an email no longer on the allowlist is refused with 403 -- the exact static-token-bypass this pass closes', async () => {
    const cookie = await sessionCookieFor('removed-operator@example.test', true);
    const { POST } = await import('./route');
    const res = await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: 'someone-else@example.test' }, () =>
        POST(requestWithCookie(cookie)));
    assert.equal(res.status, 403);
});

test('POST /api/founding/action: a valid session without MFA verified is refused with 401', async () => {
    const cookie = await sessionCookieFor('operator@example.test', false);
    const { POST } = await import('./route');
    const res = await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: 'operator@example.test' }, () =>
        POST(requestWithCookie(cookie)));
    assert.equal(res.status, 401);
});

test('POST /api/founding/action: a signed MFA cookie cannot grant access when durable session verification is unconfigured', async () => {
    const cookie = await sessionCookieFor('operator@example.test', true);
    const { POST } = await import('./route');
    const res = await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: 'operator@example.test', PLATFORM_CONSOLE_API_TOKEN: undefined }, () =>
        POST(requestWithCookie(cookie)));
    assert.equal(res.status, 401, 'the cookie signature alone is no longer current session authority');
});
