// APPID-SEC2 — every identity-platform route that sends email is registered here, with the guard
// that stops it sending for a stranger.
//
// identity-platform's email path ends at the gateway's /auth/custom/emails/send, which trusts
// identity-platform's own signature. So an identity-platform route that sends email is, from the
// outside, a way to make LetBuyy send mail. Two such routes (/api/email/store-creation-success and
// -failure) had no guard at all: anyone could name the recipient, and the links and text inserted
// into the message. This registry makes the next such route a deliberate decision: a route that
// imports the email module and is not listed here fails, and a listed route that loses its guard
// fails.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const appDir = join(root, 'apps/platform/identity/src/app');

/// Comments stripped, so a comment describing a guard cannot stand in for the guard.
const code = (source: string) => source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

// Each sender and what makes it safe to expose: CSRF on every one, then either a signed-in session,
// or a rate limit with a bot check, or a rate limit with a single-use token the email itself proved.
const SENDERS: Record<string, { guards: RegExp[]; why: string }> = {
    'api/auth/login/route.ts': {
        guards: [/validateCsrf\(request\)/, /checkRateLimit\('login'/, /verifyTurnstileToken\(/],
        why: 'new-device alert to the account that just proved its password',
    },
    'api/auth/signup/route.ts': {
        guards: [/validateCsrf\(request\)/, /checkRateLimit\('signup'/, /verifyTurnstileToken\(/],
        why: 'verification code to the address being registered',
    },
    'api/auth/send-magic/route.ts': {
        guards: [/validateCsrf\(request\)/, /checkRateLimit\('send-magic'/, /verifyTurnstileToken\(/],
        why: 'sign-in link to an existing account',
    },
    'api/auth/send-reset/route.ts': {
        guards: [/validateCsrf\(request\)/, /checkRateLimit\('send-reset'/, /verifyTurnstileToken\(/],
        why: 'reset link to an existing account',
    },
    'api/auth/reset-password/route.ts': {
        guards: [/validateCsrf\(request\)/, /checkRateLimit\('reset-password'/, /MerchantPasswordResetSchema\.safeParse/, /purpose: 'password_reset'/, /!passwordResponse\.ok \|\| !payload\?\.data/],
        why: 'password-changed notice to the account whose single-use reset token was just redeemed',
    },
    'api/auth/create-store/route.ts': {
        guards: [/validateCsrf\(request\)/, /validateSession\(/],
        why: 'store-created email to the signed-in merchant, for the store this request created',
    },
};

function routeFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return routeFiles(path);
        return name === 'route.ts' ? [path] : [];
    });
}

const senders = routeFiles(appDir)
    .filter((file) => /from '@\/lib\/email\/resend'/.test(code(readFileSync(file, 'utf8'))))
    .map((file) => relative(appDir, file))
    .sort();

test('the sweep finds the senders, so the checks below are not vacuous', () => {
    assert.ok(senders.length >= 5, `found ${senders.length} email-sending routes`);
    assert.ok(senders.includes('api/auth/create-store/route.ts'), 'create-store sends its own email since APPID-SEC2');
});

test('every route that sends email is registered, and every registered route still sends', () => {
    assert.deepEqual(senders, Object.keys(SENDERS).sort());
});

test('every registered sender keeps its guards', () => {
    for (const [route, { guards, why }] of Object.entries(SENDERS)) {
        const source = code(readFileSync(join(appDir, route), 'utf8'));
        for (const guard of guards) {
            assert.match(source, guard, `${route} (${why}) must keep ${guard}`);
        }
    }
});

test('the public email relay is gone, and nothing reaches email by fetching its own origin', () => {
    assert.ok(!existsSync(join(appDir, 'api/email')), 'apps/platform/identity/src/app/api/email must not come back');
    for (const file of routeFiles(appDir)) {
        const source = code(readFileSync(file, 'utf8'));
        assert.ok(
            !/fetch\(\s*new URL\(\s*['"`]\/api\//.test(source),
            `${relative(appDir, file)} calls one of identity-platform's own public routes over HTTP; call the function instead`,
        );
    }
});
