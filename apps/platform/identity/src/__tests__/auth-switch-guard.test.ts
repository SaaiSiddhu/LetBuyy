import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const switchRouteSource = readFileSync(
    new URL('../app/api/auth/switch/route.ts', import.meta.url),
    'utf8',
)
const rateLimitSource = readFileSync(
    new URL('../lib/rate-limit.ts', import.meta.url),
    'utf8',
)

/**
 * Wave 0 regression tests for the /api/auth/switch hardening (SEC-C1 / SEC-H7).
 *
 * The structural guards (required valid session + target-in-signed-accounts-cookie)
 * are additionally enforced by `scripts/governance/identity-security-gate.mjs`. The full
 * route-level contract test (no-session → 401, unproven-target → 403,
 * proven-target → 200) is specified in
 * docs/auth/2026-06-09-identity-execution-recovery/TEST_COVERAGE_REPORT.md and
 * belongs in the route integration suite (requires next/headers + fetch mocks).
 */
test('switch has a dedicated strict rate-limit configuration (SEC-H7)', () => {
    assert.match(
        rateLimitSource,
        /switch:\s*\{\s*limit:\s*5,\s*window:\s*'15 m',\s*prefix:\s*'rl:switch'\s*\}/,
        'switch must keep a dedicated 5-per-15m rate-limit bucket',
    )
})

test('switch is no looser than login (credential-grade throttling)', () => {
    const loginLimit = Number(rateLimitSource.match(/login:\s*\{\s*limit:\s*(\d+)/)?.[1])
    const switchLimit = Number(rateLimitSource.match(/switch:\s*\{\s*limit:\s*(\d+)/)?.[1])

    assert.ok(Number.isFinite(loginLimit), 'login rate-limit must be present')
    assert.ok(Number.isFinite(switchLimit), 'switch rate-limit must be present')
    assert.ok(switchLimit <= loginLimit, 'switch limit must not exceed login limit')
})

test('switch requires a valid current session before resolving the target account', () => {
    const currentTokenIndex = switchRouteSource.indexOf('const currentToken = await getSessionCookie()')
    const validateSessionIndex = switchRouteSource.indexOf('await validateSession(currentToken)')
    const unauthorizedIndex = switchRouteSource.indexOf('{ status: 401 }')
    const savedAccountsIndex = switchRouteSource.indexOf('const savedAccounts = await getAccounts()')
    const targetProofIndex = switchRouteSource.indexOf('reauthenticationRequired: true')

    assert.ok(currentTokenIndex > -1, 'switch route must read the current session cookie')
    assert.ok(validateSessionIndex > currentTokenIndex, 'switch route must validate the current session token')
    assert.ok(unauthorizedIndex > validateSessionIndex, 'anonymous switch requests must return 401 before target lookup')
    assert.ok(savedAccountsIndex > unauthorizedIndex, 'saved account proof must run only after current session proof')
    assert.ok(targetProofIndex > savedAccountsIndex, 'target reauthentication must follow both current-session and saved-account guards')
})

test('switch requires fresh target credentials and cannot mint from a remembered email', () => {
    const savedAccountsIndex = switchRouteSource.indexOf('const savedAccounts = await getAccounts()')
    const isProvenAccountIndex = switchRouteSource.indexOf('const isProvenAccount = savedAccounts.some')
    const forbiddenIndex = switchRouteSource.indexOf('{ status: 403 }', isProvenAccountIndex)
    const targetProofIndex = switchRouteSource.indexOf('reauthenticationRequired: true')

    assert.ok(savedAccountsIndex > -1, 'switch route must read the signed saved-accounts cookie')
    assert.ok(isProvenAccountIndex > savedAccountsIndex, 'switch route must verify the target against saved accounts')
    assert.ok(forbiddenIndex > isProvenAccountIndex, 'unproven target switch requests must return 403')
    assert.ok(targetProofIndex > forbiddenIndex)
    assert.doesNotMatch(switchRouteSource, /await createSession\(/, 'remembered metadata cannot mint a target session')
    assert.doesNotMatch(switchRouteSource, /await destroySession\(/, 'a failed or cancelled switch must preserve the working session')
})
