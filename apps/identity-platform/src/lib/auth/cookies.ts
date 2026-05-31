import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { LETBUYY_MERCHANT_SESSION_COOKIE } from '@letbuyy/auth-core'

const AUTH_SECRET = process.env.AUTH_SECRET || ''
const secret = new TextEncoder().encode(AUTH_SECRET)

// Cookie names
export const COOKIE_NAMES = {
    session: LETBUYY_MERCHANT_SESSION_COOKIE,
    csrf: 'lb_csrf',
    accounts: 'lb_accounts',
    device: 'lb_device',
} as const

/**
 * In production, set cookies on the parent domain (.letbuyy.store)
 * so they are shared across all subdomains:
 *   accounts.letbuyy.store  (sets the cookie)
 *   admin.letbuyy.store     (reads the cookie)
 *   *.letbuyy.store         (any future subdomains)
 * 
 * In development, omit domain so cookies work on localhost.
 */
const COOKIE_DOMAIN =
    process.env.NODE_ENV === 'production' ? '.letbuyy.store' : undefined

// Cookie options shared across all auth cookies
const BASE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
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
        .sign(secret)
}

/**
 * Decrypt the accounts cookie JWT back into the accounts list.
 */
async function decryptAccounts(token: string): Promise<AccountEntry[]> {
    try {
        const { payload } = await jwtVerify(token, secret)
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
