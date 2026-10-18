import {createConsoleSessionCookieValue,identityUnitConfig} from '../../../../__tests__/identity-issuer-fixture';
// Auth hardening follow-up, Section 13 -- see founding/action/route.test.ts for the full context.
// This export route returns founding-allocation data (site IDs, pricing) as a CSV; the same
// unauthenticated-data-exfiltration risk, now closed the same way.

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
    return new NextRequest('https://console.letbuyy.test/api/founding/export', { headers });
}

test('GET /api/founding/export: no session cookie at all is refused with 401, never reaching the gateway or returning any CSV data', async () => {
    const { GET } = await import('./route');
    const res = await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: 'operator@example.test' }, () =>
        GET(requestWithCookie()));
    assert.equal(res.status, 401);
});

test('GET /api/founding/export: a session for an email no longer on the allowlist is refused with 403', async () => {
    const cookie = await sessionCookieFor('removed-operator@example.test', true);
    const { GET } = await import('./route');
    const res = await withEnv({ PLATFORM_CONSOLE_SESSION_SECRET: SESSION_SECRET, PLATFORM_CONSOLE_ALLOWED_EMAILS: 'someone-else@example.test' }, () =>
        GET(requestWithCookie(cookie)));
    assert.equal(res.status, 403);
});
