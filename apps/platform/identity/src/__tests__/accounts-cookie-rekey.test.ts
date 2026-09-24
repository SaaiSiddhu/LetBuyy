import assert from 'node:assert/strict'
import test from 'node:test'

import { encryptAccounts, decryptAccounts } from '../lib/auth/cookies'

// Phase S1 W2 (SEC-R7 de-sharing / IDN-R2 dual-read drain): the lb_accounts
// cookie used to sign directly with the cross-domain AUTH_SECRET. It now signs
// with a dedicated ACCOUNTS_COOKIE_SECRET, with a verify-only fallback to
// AUTH_SECRET for already-issued cookies. These tests exercise the crypto/
// dual-read logic directly (encryptAccounts/decryptAccounts are pure aside
// from process.env) rather than through getAccounts(), which requires a
// Next.js Route Handler request context (next/headers cookies()) that a plain
// node:test run does not provide -- see auth-switch-guard.test.ts's own note
// on this same constraint.

const DEDICATED_SECRET = 'dedicated-test-secret-at-least-16-chars-long'
const LEGACY_SECRET = 'legacy-test-secret-at-least-16-chars-long'
const SAMPLE_ACCOUNTS = [
    { email: 'owner@example.test', name: 'Owner', avatar: null, lastLogin: '2026-08-23T00:00:00.000Z' },
]

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
    const saved = new Map<string, string | undefined>()
    for (const key of Object.keys(vars)) saved.set(key, process.env[key])

    for (const [key, value] of Object.entries(vars)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
    }

    return fn().finally(() => {
        for (const [key, value] of saved) {
            if (value === undefined) delete process.env[key]
            else process.env[key] = value
        }
    })
}

test('S1 accounts cookie: a cookie signed with the dedicated secret verifies', async () => {
    await withEnv({ ACCOUNTS_COOKIE_SECRET: DEDICATED_SECRET, AUTH_SECRET: undefined }, async () => {
        const token = await encryptAccounts(SAMPLE_ACCOUNTS)
        const result = await decryptAccounts(token)

        assert.deepEqual(result.accounts, SAMPLE_ACCOUNTS)
        assert.equal(result.verifiedWithLegacyKey, false, 'a dedicated-key cookie must not be reported as a legacy verification')
    })
})

test('S1 accounts cookie: a legacy AUTH_SECRET-signed cookie still verifies and is flagged for re-issue', async () => {
    // Sign under what used to be the only key (AUTH_SECRET), as an
    // already-issued cookie in a browser would be.
    const legacyToken = await withEnv({ ACCOUNTS_COOKIE_SECRET: LEGACY_SECRET, AUTH_SECRET: undefined }, () =>
        encryptAccounts(SAMPLE_ACCOUNTS),
    )

    await withEnv({ ACCOUNTS_COOKIE_SECRET: DEDICATED_SECRET, AUTH_SECRET: LEGACY_SECRET }, async () => {
        const result = await decryptAccounts(legacyToken)

        assert.deepEqual(result.accounts, SAMPLE_ACCOUNTS, 'legacy-signed cookie must still decrypt correctly')
        assert.equal(result.verifiedWithLegacyKey, true, 'legacy verification must be flagged so the caller re-issues + logs it')

        // Simulate what getAccounts() does on a legacy hit: re-issue under the
        // dedicated key, then confirm the re-issued cookie no longer needs the
        // legacy path at all.
        const reissued = await encryptAccounts(result.accounts)
        const reverified = await decryptAccounts(reissued)
        assert.deepEqual(reverified.accounts, SAMPLE_ACCOUNTS)
        assert.equal(reverified.verifiedWithLegacyKey, false, 'a re-issued cookie must verify under the dedicated key alone')
    })
})

test('S1 accounts cookie: a cookie signed with a wrong key fails closed to an empty list', async () => {
    const wrongToken = await withEnv({ ACCOUNTS_COOKIE_SECRET: 'a-completely-different-secret-value', AUTH_SECRET: undefined }, () =>
        encryptAccounts(SAMPLE_ACCOUNTS),
    )

    await withEnv({ ACCOUNTS_COOKIE_SECRET: DEDICATED_SECRET, AUTH_SECRET: LEGACY_SECRET }, async () => {
        const result = await decryptAccounts(wrongToken)

        assert.deepEqual(result.accounts, [], 'a cookie signed by neither the dedicated nor the legacy key must yield []')
        assert.equal(result.verifiedWithLegacyKey, false)
    })
})

test('S1 accounts cookie: production-like runtime with a missing/short dedicated secret throws', async () => {
    await withEnv({ ACCOUNTS_COOKIE_SECRET: undefined, AUTH_SECRET: undefined, APP_ENV: 'production', NODE_ENV: undefined, VERCEL_ENV: undefined, NEXT_PUBLIC_ENV: undefined }, async () => {
        await assert.rejects(
            () => encryptAccounts(SAMPLE_ACCOUNTS),
            /ACCOUNTS_COOKIE_SECRET is missing or too short/,
            'a production-like runtime must refuse to sign with a missing/weak dedicated key',
        )
    })

    await withEnv({ ACCOUNTS_COOKIE_SECRET: 'too-short', AUTH_SECRET: undefined, APP_ENV: 'production', NODE_ENV: undefined, VERCEL_ENV: undefined, NEXT_PUBLIC_ENV: undefined }, async () => {
        await assert.rejects(
            () => encryptAccounts(SAMPLE_ACCOUNTS),
            /ACCOUNTS_COOKIE_SECRET is missing or too short/,
            'a production-like runtime must refuse a dedicated key under 16 characters',
        )
    })
})

test('S1 accounts cookie: no legacy verification is attempted when AUTH_SECRET is absent', async () => {
    await withEnv({ ACCOUNTS_COOKIE_SECRET: LEGACY_SECRET, AUTH_SECRET: undefined }, () => encryptAccounts(SAMPLE_ACCOUNTS)).then(async (legacyToken) => {
        await withEnv({ ACCOUNTS_COOKIE_SECRET: DEDICATED_SECRET, AUTH_SECRET: undefined }, async () => {
            const result = await decryptAccounts(legacyToken)
            assert.deepEqual(result.accounts, [], 'without AUTH_SECRET configured, the legacy path must be skipped, not throw')
            assert.equal(result.verifiedWithLegacyKey, false)
        })
    })
})
