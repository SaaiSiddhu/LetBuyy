import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { LETBUYY_MERCHANT_SESSION_COOKIE } from '@letbuyy/auth-core'
import { isProductionIdentityRuntime } from '@/lib/dev-auth-bypass'

/**
 * Resolve the JWT signing key for the encrypted accounts cookie. SECURITY: never fall
 * back to an empty/weak key — an empty key makes signed cookies forgeable while still
 * "verifying". In production a missing/short ACCOUNTS_COOKIE_SECRET is a hard failure;
 * in development a clearly-marked insecure key is used so local work needs no secrets.
 */
function getSigningKey(): Uint8Array {
    const value = process.env.ACCOUNTS_COOKIE_SECRET?.trim() || ''
    if (value.length < 16) {
        // SEC-H3 (Wave 0): refuse the weak dev key in ANY production-like runtime
        // (NODE_ENV/APP_ENV/VERCEL_ENV/NEXT_PUBLIC_ENV) — not just NODE_ENV=production.
        // The previous NODE_ENV-only gate let a non-prod NODE_ENV deploy sign the
        // PII-bearing lb_accounts cookie with a public literal.
        if (isProductionIdentityRuntime(process.env)) {
            throw new Error('ACCOUNTS_COOKIE_SECRET is missing or too short (min 16 chars); refusing to sign/verify with a weak key')
        }
        return new TextEncoder().encode('dev-only-insecure-accounts-cookie-secret-set-ACCOUNTS_COOKIE_SECRET-in-prod')
    }
    return new TextEncoder().encode(value)
}

/**
 * S1 W2 (SEC-R7 de-sharing / IDN-R2 dual-read drain): the accounts cookie used
 * to sign directly with the cross-domain AUTH_SECRET. A cookie already issued
 * under that key must keep verifying until it is re-issued under the
 * dedicated ACCOUNTS_COOKIE_SECRET or its 90-day TTL expires -- this resolver
 * is VERIFY-ONLY (see decryptAccounts) and must never be used to sign. Unlike
 * getSigningKey, a missing/short AUTH_SECRET does not throw: this is an
 * optional drain path, not the primary key, so its absence just means the
 * legacy branch is skipped, never that the whole cookie fails closed.
 */
function getLegacySigningKey(): Uint8Array | null {
    const value = process.env.AUTH_SECRET?.trim() || ''
    if (value.length < 16) return null
    return new TextEncoder().encode(value)
}
const PASSWORD_SET_INTENT_COOKIE = 'lb_password_set_intent'
const PASSWORD_SET_INTENT_TTL_SECONDS = 15 * 60
const ACCOUNTS_COOKIE_TTL_SECONDS = 90 * 24 * 60 * 60

// Cookie names
export const COOKIE_NAMES = {
    session: LETBUYY_MERCHANT_SESSION_COOKIE,
    csrf: 'letbuyy_csrf',
    accounts: 'lb_accounts',
    device: 'lb_device',
    passwordSetIntent: PASSWORD_SET_INTENT_COOKIE,
} as const

/**
 * Platform (merchant/staff/partner) session realm.
 *
 * Two-domain split — see docs/governance/domain-topology-governance.md §3:
 *   • Platform apps (accounts/admin/apps/themes/developer/console/team) share
 *     this cookie via the parent domain, so one login at the accounts app is
 *     valid across all of them (SSO).
 *   • Storefronts use HOST-ONLY customer cookies in a separate realm
 *     (apps/storefront-runtime/src/lib/session.ts — no `domain` attribute).
 *     The two realms never share a cookie; that is the tenant-isolation guarantee.
 *     NEVER set a parent-domain attribute on a storefront cookie.
 *
 * COOKIE_DOMAIN is env-driven so the realm activates without a code change: it
 * must always match the apex the platform apps are actually served from. The
 * secret store owns that value in production; leaving it unset makes cookies
 * host-only, which is safer than a stale code-level domain fallback.
 */
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN?.trim() || undefined

// Cookie options shared across all auth cookies
// In local dev (HTTP) Secure must be false — browsers silently drop Secure
// cookies on non-HTTPS origins, breaking cross-port redirects.
const BASE_OPTIONS = {
    httpOnly: true,
    secure: isProductionIdentityRuntime(process.env),
    path: '/',
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
} as const

/**
 * Account entry stored in the encrypted accounts cookie.
 */
export interface AccountEntry {
    email: string
    name: string | null
    avatar: string | null
    lastLogin: string
}

// --- Session Cookie ---

export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAMES.session, token, {
        ...BASE_OPTIONS,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    })
}

export async function getSessionCookie(): Promise<string | undefined> {
    const cookieStore = await cookies()
    return cookieStore.get(COOKIE_NAMES.session)?.value
}

export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAMES.session, '', {
        ...BASE_OPTIONS,
        sameSite: 'lax',
        maxAge: 0,
    })
}

export async function clearAccountsCookie(): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAMES.accounts, '', {
        ...BASE_OPTIONS,
        sameSite: 'lax',
        maxAge: 0,
    })
}

// --- Password Set Intent Cookie ---

export async function setPasswordSetIntentCookie(intentId: string): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAMES.passwordSetIntent, intentId, {
        ...BASE_OPTIONS,
        sameSite: 'strict',
        maxAge: PASSWORD_SET_INTENT_TTL_SECONDS,
    })
}

export async function getPasswordSetIntentCookie(): Promise<string | undefined> {
    const cookieStore = await cookies()
    return cookieStore.get(COOKIE_NAMES.passwordSetIntent)?.value
}

export async function clearPasswordSetIntentCookie(): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAMES.passwordSetIntent, '', {
        ...BASE_OPTIONS,
        sameSite: 'strict',
        maxAge: 0,
    })
}

// --- CSRF Cookie ---

export async function setCsrfCookie(token: string): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAMES.csrf, token, {
        ...BASE_OPTIONS,
        httpOnly: false, // Must be readable client-side for CSRF headers
        sameSite: 'strict',
        maxAge: 60 * 60, // 1 hour
    })
}

export async function getCsrfCookie(): Promise<string | undefined> {
    const cookieStore = await cookies()
    return cookieStore.get(COOKIE_NAMES.csrf)?.value
}

// --- Device Cookie ---

export async function setDeviceCookie(deviceId: string): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAMES.device, deviceId, {
        ...BASE_OPTIONS,
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60, // 90 days
    })
}

export async function getDeviceCookie(): Promise<string | undefined> {
    const cookieStore = await cookies()
    return cookieStore.get(COOKIE_NAMES.device)?.value
}

// --- Accounts Cookie (encrypted multi-account list) ---

/**
 * Encrypt the accounts list into a JWT for safe cookie storage. Always signs
 * with the dedicated ACCOUNTS_COOKIE_SECRET -- never AUTH_SECRET (SEC-R7).
 */
export async function encryptAccounts(accounts: AccountEntry[]): Promise<string> {
    return new SignJWT({ accounts })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(`${ACCOUNTS_COOKIE_TTL_SECONDS}s`)
        .sign(getSigningKey())
}

type DecryptAccountsResult = {
    accounts: AccountEntry[]
    verifiedWithLegacyKey: boolean
}

/**
 * Decrypt the accounts cookie JWT back into the accounts list. Tries the
 * dedicated key first; on failure, tries the legacy AUTH_SECRET-signed form
 * so already-issued cookies keep working through the IDN-R2 drain window.
 * verifiedWithLegacyKey tells the caller to re-issue the cookie under the
 * dedicated key and record the drain telemetry.
 */
export async function decryptAccounts(token: string): Promise<DecryptAccountsResult> {
    try {
        const { payload } = await jwtVerify(token, getSigningKey())
        return { accounts: (payload.accounts as AccountEntry[]) || [], verifiedWithLegacyKey: false }
    } catch {
        const legacyKey = getLegacySigningKey()
        if (!legacyKey) return { accounts: [], verifiedWithLegacyKey: false }

        try {
            const { payload } = await jwtVerify(token, legacyKey)
            return { accounts: (payload.accounts as AccountEntry[]) || [], verifiedWithLegacyKey: true }
        } catch {
            return { accounts: [], verifiedWithLegacyKey: false }
        }
    }
}

/**
 * Get the list of saved accounts from the encrypted cookie. A cookie that
 * only verifies under the legacy AUTH_SECRET key is re-issued under the
 * dedicated key on read (IDN-R2 dual-read drain) and the legacy verification
 * is logged -- SKIP-IDN-R2-DRAIN-TELEMETRY's measurement. Both real callers
 * (app/api/auth/accounts, app/api/auth/switch) are Route Handlers, so setting
 * a cookie here is a valid Next.js write context.
 */
export async function getAccounts(): Promise<AccountEntry[]> {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAMES.accounts)?.value
    if (!token) return []

    const { accounts, verifiedWithLegacyKey } = await decryptAccounts(token)
    if (!verifiedWithLegacyKey) return accounts

    console.log(JSON.stringify({
        level: 'info',
        service: 'letbuyy-identity',
        route: 'auth.accounts.cookie',
        reason: 'legacy_auth_secret_verification',
    }))

    const reissued = await encryptAccounts(accounts)
    cookieStore.set(COOKIE_NAMES.accounts, reissued, {
        ...BASE_OPTIONS,
        sameSite: 'lax',
        maxAge: ACCOUNTS_COOKIE_TTL_SECONDS,
    })

    return accounts
}

/**
 * Add or update an account in the multi-account cookie.
 * Max 10 accounts. Most recent login is always first.
 */
export async function addAccount(account: AccountEntry): Promise<void> {
    const accounts = await getAccounts()

    // Remove existing entry for this email (if any)
    const filtered = accounts.filter((a) => a.email !== account.email)

    // Add to front (most recent first), cap at 10
    const updated = [account, ...filtered].slice(0, 10)

    const token = await encryptAccounts(updated)
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAMES.accounts, token, {
        ...BASE_OPTIONS,
        sameSite: 'lax',
        maxAge: ACCOUNTS_COOKIE_TTL_SECONDS,
    })
}

/**
 * Remove an account from the multi-account cookie.
 */
export async function removeAccount(email: string): Promise<void> {
    const accounts = await getAccounts()
    const filtered = accounts.filter((a) => a.email !== email)
    const token = await encryptAccounts(filtered)
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAMES.accounts, token, {
        ...BASE_OPTIONS,
        sameSite: 'lax',
        maxAge: ACCOUNTS_COOKIE_TTL_SECONDS,
    })
}
