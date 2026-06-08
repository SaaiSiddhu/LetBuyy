import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { LETBUYY_MERCHANT_SESSION_COOKIE } from '@letbuyy/auth-core'

/**
 * Resolve the JWT signing key for the encrypted accounts cookie. SECURITY: never fall
 * back to an empty/weak key — an empty key makes signed cookies forgeable while still
 * "verifying". In production a missing/short AUTH_SECRET is a hard failure; in
 * development a clearly-marked insecure key is used so local work needs no secrets.
 */
function getSigningKey(): Uint8Array {
    const value = process.env.AUTH_SECRET?.trim() || ''
    if (value.length < 16) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('AUTH_SECRET is missing or too short (min 16 chars); refusing to sign/verify with a weak key')
        }
        return new TextEncoder().encode('dev-only-insecure-auth-secret-set-AUTH_SECRET-in-prod')
    }
    return new TextEncoder().encode(value)
}
const PASSWORD_SET_INTENT_COOKIE = 'lb_password_set_intent'
const PASSWORD_SET_INTENT_TTL_SECONDS = 15 * 60

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
 * COOKIE_DOMAIN is env-driven so the realm activates at cutover WITHOUT a code
 * change: it must always match the apex the platform apps are actually served
 * from. Pre-split that is `.letbuyy.store` (current default). At cutover, when
 * platform apps move to the control-plane apex, update COOKIE_DOMAIN in the
 * secret store. Flipping it
 * ahead of the DNS/Vercel move would break SSO (cookie scoped to a domain the
 * apps aren't served from).
 */
const COOKIE_DOMAIN =
    process.env.COOKIE_DOMAIN?.trim() || (process.env.NODE_ENV === 'production' ? '.letbuyy.store' : undefined)

// Cookie options shared across all auth cookies
const BASE_OPTIONS = {
    httpOnly: true,
    secure: true,
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
 * Encrypt the accounts list into a JWT for safe cookie storage.
 */
async function encryptAccounts(accounts: AccountEntry[]): Promise<string> {
    return new SignJWT({ accounts })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('365d')
        .sign(getSigningKey())
}

/**
 * Decrypt the accounts cookie JWT back into the accounts list.
 */
async function decryptAccounts(token: string): Promise<AccountEntry[]> {
    try {
        const { payload } = await jwtVerify(token, getSigningKey())
        return (payload.accounts as AccountEntry[]) || []
    } catch {
        return []
    }
}

/**
 * Get the list of saved accounts from the encrypted cookie.
 */
export async function getAccounts(): Promise<AccountEntry[]> {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAMES.accounts)?.value
    if (!token) return []
    return decryptAccounts(token)
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
        maxAge: 365 * 24 * 60 * 60, // 1 year
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
        maxAge: 365 * 24 * 60 * 60,
    })
}
