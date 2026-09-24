// D-8 — the marketplace buyer session cookie.
//
// Kept out of cookies.ts on purpose. That file owns the PLATFORM realm and sets COOKIE_DOMAIN on its
// cookies so accounts/admin/apps/themes/developer/console share one login. A buyer cookie must never
// pick that attribute up by sitting next to the helpers that apply it — a parent-domain buyer cookie
// would be transmitted to every one of those apps, none of which has any business receiving a
// shopper's credential.
//
// So: host-only, always. No `domain` attribute is set here, and none should ever be added.

import { cookies } from 'next/headers'
import { LETBUYY_BUYER_SESSION_COOKIE, LETBUYY_BUYER_SESSION_TTL_SECONDS } from '@letbuyy/auth-core'

export const BUYER_SESSION_TTL_SECONDS = LETBUYY_BUYER_SESSION_TTL_SECONDS

/// The session epoch to put in a new token, from the buyer record the gateway returned (APPID-P4a).
/// A gateway from before migration 257 returns none, and 1 is then safe: the gateway refuses a token
/// from any epoch but the account's current one, so a wrong value can end a session early but can
/// never keep one alive.
export function buyerSessionEpoch(value: unknown): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : 1
}

export async function getBuyerSessionCookie(): Promise<string | null> {
    const store = await cookies()
    return store.get(LETBUYY_BUYER_SESSION_COOKIE)?.value || null
}

export async function setBuyerSessionCookie(token: string): Promise<void> {
    const store = await cookies()
    store.set(LETBUYY_BUYER_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: BUYER_SESSION_TTL_SECONDS,
        // No `domain`. See the note above — this is the whole point of the file.
    })
}

export async function clearBuyerSessionCookie(): Promise<void> {
    const store = await cookies()
    store.set(LETBUYY_BUYER_SESSION_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    })
}
