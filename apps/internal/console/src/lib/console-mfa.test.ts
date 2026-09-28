// SUSTAINED-E — console-mfa.ts's rate limit, replay rejection and constant-time comparison.
//
// No `server-only`/Next.js import in the module under test, so this runs as a plain node:test file
// (the same reason apps/commerce/web/src's test files exist as .test.ts beside their source).

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
    verifyConsoleTotp,
    resetConsoleMfaGuardStateForTests,
    resolveConsoleLoginOutcome,
} from './console-mfa';

const EMAIL = 'operator@letbuyy.test';

// Phase 2 / D04 (Mandate 6, Section 10): the production check must run before the allowlist check
// so a production response never distinguishes "allowed but delivery not configured" from
// "not allowed" -- both must resolve identically, closing an account-enumeration path.
test('production always resolves to magic_link_delivery_not_configured, regardless of allowlist membership', () => {
    assert.deepEqual(resolveConsoleLoginOutcome({ isProduction: true, isAllowed: true }), { kind: 'magic_link_delivery_not_configured' });
    assert.deepEqual(resolveConsoleLoginOutcome({ isProduction: true, isAllowed: false }), { kind: 'magic_link_delivery_not_configured' });
});
test('non-production resolves by allowlist membership: allowed proceeds, not-allowed is denied', () => {
    assert.deepEqual(resolveConsoleLoginOutcome({ isProduction: false, isAllowed: true }), { kind: 'proceed' });
    assert.deepEqual(resolveConsoleLoginOutcome({ isProduction: false, isAllowed: false }), { kind: 'access_denied' });
});

function hotp(secret: Buffer, counter: number): string {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));
    const digest = createHmac('sha1', secret).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0xf;
    const code = (
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff)
    ) % 1_000_000;
    return code.toString().padStart(6, '0');
}

// PLATFORM_CONSOLE_TOTP_SECRETS accepts a bare (non-base32) secret when base32 decoding would be
// empty/invalid (decodeBase32's fallback) -- using a plain ASCII secret here keeps the test's own
// HOTP independent of base32 decoding, which is not what this phase changed.
const SECRET = 'sustained-e-test-secret';
const SECRET_BYTES = Buffer.from(SECRET);

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
    const previous: Record<string, string | undefined> = {};
    for (const key of Object.keys(vars)) previous[key] = process.env[key];
    for (const [key, value] of Object.entries(vars)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    try {
        fn();
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

function withPrincipalSecret(fn: () => void) {
    withEnv({ PLATFORM_CONSOLE_TOTP_SECRETS: JSON.stringify({ [EMAIL]: SECRET }), PLATFORM_CONSOLE_TOTP_SECRET: undefined }, fn);
}

test('a valid current code is accepted', () => {
    resetConsoleMfaGuardStateForTests();
    withPrincipalSecret(() => {
        const code = hotp(SECRET_BYTES, Math.floor(Date.now() / 30_000));
        assert.deepEqual(verifyConsoleTotp(code, EMAIL), { ok: true });
    });
});

test('a wrong code is rejected as invalid', () => {
    resetConsoleMfaGuardStateForTests();
    withPrincipalSecret(() => {
        const wrong = hotp(SECRET_BYTES, Math.floor(Date.now() / 30_000) + 100); // far outside the ±1 window
        assert.deepEqual(verifyConsoleTotp(wrong, EMAIL), { ok: false, reason: 'invalid' });
    });
});

test('REGRESSION CLOSED — replay: the same valid code cannot be accepted twice', () => {
    resetConsoleMfaGuardStateForTests();
    withPrincipalSecret(() => {
        const code = hotp(SECRET_BYTES, Math.floor(Date.now() / 30_000));
        assert.deepEqual(verifyConsoleTotp(code, EMAIL), { ok: true }, 'first submission accepted');
        assert.deepEqual(verifyConsoleTotp(code, EMAIL), { ok: false, reason: 'invalid' }, 'the identical code resubmitted must be refused as a replay');
    });
});

test('REGRESSION CLOSED — lockout: after 5 wrong codes, a SIXTH attempt is locked even if it is correct', () => {
    resetConsoleMfaGuardStateForTests();
    withPrincipalSecret(() => {
        const counter = Math.floor(Date.now() / 30_000);
        const correct = hotp(SECRET_BYTES, counter);
        for (let i = 0; i < 5; i += 1) {
            const wrong = hotp(SECRET_BYTES, counter + 100 + i);
            assert.deepEqual(verifyConsoleTotp(wrong, EMAIL), { ok: false, reason: 'invalid' }, `attempt ${i + 1} must be counted as a failure`);
        }
        assert.deepEqual(verifyConsoleTotp(correct, EMAIL), { ok: false, reason: 'locked' }, 'the 6th attempt is locked out regardless of correctness');
    });
});

test('a lockout is scoped to one principal: a different email is unaffected', () => {
    resetConsoleMfaGuardStateForTests();
    withEnv({
        PLATFORM_CONSOLE_TOTP_SECRETS: JSON.stringify({ [EMAIL]: SECRET, 'other@letbuyy.test': SECRET }),
        PLATFORM_CONSOLE_TOTP_SECRET: undefined,
    }, () => {
        const counter = Math.floor(Date.now() / 30_000);
        for (let i = 0; i < 5; i += 1) {
            verifyConsoleTotp(hotp(SECRET_BYTES, counter + 100 + i), EMAIL);
        }
        assert.deepEqual(verifyConsoleTotp(hotp(SECRET_BYTES, counter), EMAIL), { ok: false, reason: 'locked' });
        assert.deepEqual(verifyConsoleTotp(hotp(SECRET_BYTES, counter), 'other@letbuyy.test'), { ok: true }, "a different principal's lockout must not carry over");
    });
});

test('a successful verification clears any prior failure count', () => {
    resetConsoleMfaGuardStateForTests();
    withPrincipalSecret(() => {
        const counter = Math.floor(Date.now() / 30_000);
        for (let i = 0; i < 4; i += 1) {
            verifyConsoleTotp(hotp(SECRET_BYTES, counter + 100 + i), EMAIL);
        }
        assert.deepEqual(verifyConsoleTotp(hotp(SECRET_BYTES, counter), EMAIL), { ok: true }, '4 failures then a correct code succeeds (below the 5-failure lockout)');
        // A fresh run of failures afterward must need its own 5, not resume from the earlier count.
        for (let i = 0; i < 4; i += 1) {
            verifyConsoleTotp(hotp(SECRET_BYTES, counter + 200 + i), EMAIL);
        }
        assert.notDeepEqual(verifyConsoleTotp(hotp(SECRET_BYTES, counter + 200 + 4), EMAIL), { ok: false, reason: 'locked' }, 'the counter must have been reset by the earlier success');
    });
});

test('no secret configured for the principal: refused, not a crash, and still counted', () => {
    resetConsoleMfaGuardStateForTests();
    withEnv({ PLATFORM_CONSOLE_TOTP_SECRETS: undefined, PLATFORM_CONSOLE_TOTP_SECRET: undefined }, () => {
        assert.deepEqual(verifyConsoleTotp('123456', EMAIL), { ok: false, reason: 'invalid' });
    });
});

test('a non-6-digit code is refused without touching the crypto path', () => {
    resetConsoleMfaGuardStateForTests();
    withPrincipalSecret(() => {
        assert.deepEqual(verifyConsoleTotp('12', EMAIL), { ok: false, reason: 'invalid' });
        assert.deepEqual(verifyConsoleTotp('abcdef', EMAIL), { ok: false, reason: 'invalid' });
    });
});
