import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const testDir = dirname(fileURLToPath(import.meta.url))
const srcRoot = join(testDir, '..')

function routeSource(path: string): string {
    return readFileSync(join(srcRoot, path), 'utf8')
}

test('signup returns a verification response after creating or finding an account', () => {
    const source = routeSource('app/api/auth/signup/route.ts')

    assert.match(source, /identityApiRequest\('\/auth\/custom\/users\/by-email'/)
    assert.match(source, /identityApiRequest\('\/auth\/custom\/users\/ensure'/)
    assert.match(source, /createOTPToken\(normalizedEmail,\s*newUser\.id\)/)
    assert.match(source, /sendOTPEmail\(normalizedEmail,\s*otp\)/)
    assert.match(source, /success:\s*true/)
    assert.match(source, /needsVerification:\s*true/)
})

test('verify-otp rejects invalid codes and persists verified email state', () => {
    const source = routeSource('app/api/auth/verify-otp/route.ts')

    assert.match(source, /checkRateLimit\('verify_otp',\s*ip\)/)
    assert.match(source, /validateOTPToken\(email\.toLowerCase\(\)\.trim\(\),\s*otp\)/)
    assert.match(source, /Invalid or expired verification code/)
    assert.match(source, /status:\s*400/)
    assert.match(source, /identityApiRequest\('\/auth\/custom\/users\/verify-email'/)
    assert.match(source, /user_id:\s*result\.user_id/)
    assert.match(source, /!verifyResponse\.ok\s*\|\|\s*!verifyPayload\?\.data/)
    assert.match(source, /createPasswordSetIntent\(result\.user_id,\s*result\.email\)/)
    assert.match(source, /setPasswordSetIntentCookie\(intent\.id\)/)
})

test('set-password creates the authenticated session cookie after OTP verification', () => {
    const source = routeSource('app/api/auth/set-password/route.ts')

    assert.match(source, /getPasswordSetIntentCookie\(\)/)
    assert.match(source, /consumePasswordSetIntent\(intentId\)/)
    assert.match(source, /identityApiRequest\('\/auth\/custom\/users\/set-password'/)
    assert.match(source, /user_id:\s*intent\.user_id/)
    assert.match(source, /email:\s*intent\.email/)
    assert.match(source, /createSession\(intent\.user_id,\s*device\.deviceId\)/)
    assert.match(source, /setSessionCookie\(sessionToken\)/)
    assert.match(source, /clearPasswordSetIntentCookie\(\)/)
    assert.match(source, /addAccount\(/)
    assert.match(source, /redirectTo:\s*'\/onboarding'/)
    assert.doesNotMatch(source, /const \{ password,\s*userId,\s*email \} = await request\.json\(\)/)
})

test('create-store uses the shared api client facade with a required session', () => {
    const source = routeSource('app/api/auth/create-store/route.ts')
    const apiClientSource = routeSource('lib/api/client.ts')

    assert.match(source, /validateSession\(sessionToken\)/)
    assert.match(source, /identityApiRequest\('\/stores'/)
    assert.match(source, /requireSession:\s*true/)
    assert.match(source, /site_type:\s*siteType/)
    assert.match(source, /subdomain:\s*normalizedSubdomain/)
    assert.match(apiClientSource, /createLetbuyyApiClient/)
    assert.match(apiClientSource, /path\.endsWith\('\/v1'\)/)
})
