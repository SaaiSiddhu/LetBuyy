// APPID-P4b — the first-party authorization request a storefront sends identity-platform, and
// (APPID-P4d) the one the marketplace app sends.
//
// Shape only. Whether the callback belongs to a LetBuyy store is the gateway's to decide (it resolves
// the host with the storefront's own resolver), and identity-platform never redirects anywhere the
// gateway has not accepted. What this rejects never leaves identity-platform at all: an error is shown
// on identity-platform's own page, because redirecting an error to an unchecked address is itself an
// open redirect. The app's callback is one fixed address, so it is compared exactly here as well.

import {
    LETBUYY_MARKETPLACE_APP_CLIENT_ID,
    LETBUYY_MARKETPLACE_APP_REDIRECT_URI,
    LETBUYY_STOREFRONT_CLIENT_ID,
} from '@letbuyy/auth-core'

export interface BuyerAuthorizationRequest {
    clientId: string
    redirectUri: string
    state: string
    codeChallenge: string
    codeChallengeMethod: 'S256'
}

// RFC 7636 unreserved characters. State is the storefront's CSRF value, echoed back untouched; 16 is
// the least that can carry real randomness, and 512 keeps the callback URL within any browser's limit.
const STATE = /^[A-Za-z0-9._~-]{16,512}$/
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/

/// A field given twice (`?state=a&state=b`) arrives as an array and is refused: two values for one
/// parameter is exactly the ambiguity a check can read one way and a redirect another.
export function parseAuthorizationRequest(input: Record<string, unknown>): BuyerAuthorizationRequest | null {
    const field = (name: string) => (typeof input[name] === 'string' ? (input[name] as string) : null)
    const responseType = field('response_type')
    const clientId = field('client_id')
    const redirectUri = field('redirect_uri')
    const state = field('state')
    const codeChallenge = field('code_challenge')
    const codeChallengeMethod = field('code_challenge_method')

    if (responseType !== 'code') return null
    if (clientId !== LETBUYY_STOREFRONT_CLIENT_ID && clientId !== LETBUYY_MARKETPLACE_APP_CLIENT_ID) return null
    if (!redirectUri || redirectUri.length > 2048) return null
    if (clientId === LETBUYY_MARKETPLACE_APP_CLIENT_ID && redirectUri !== LETBUYY_MARKETPLACE_APP_REDIRECT_URI) return null
    if (!state || !STATE.test(state)) return null
    if (!codeChallenge || !CHALLENGE.test(codeChallenge)) return null
    if (codeChallengeMethod !== 'S256') return null

    return { clientId, redirectUri, state, codeChallenge, codeChallengeMethod }
}

/// The callback URL with the code and state added. The redirect URI was accepted by the gateway
/// only if it had no query of its own, so these are its only parameters.
export function callbackWithCode(redirectUri: string, code: string, state: string): string {
    const url = new URL(redirectUri)
    url.searchParams.set('code', code)
    url.searchParams.set('state', state)
    return url.toString()
}

/// What the token endpoint mints for a code the gateway redeemed, decided by the client the DATABASE
/// recorded for the code, never the one the request names (APPID-P4d). A storefront code gets a session
/// at its site; an app code gets a platform buyer session. Anything else, including a client whose
/// site does not fit it, gets nothing.
export type RedeemedGrant =
    | { kind: 'storefront'; buyerAccountId: string; siteId: string; sessionEpoch: number }
    | { kind: 'app'; buyerAccountId: string; sessionEpoch: number }

export function grantForRedemption(data: {
    buyer?: { id?: unknown } | null
    client_id?: unknown
    site_id?: unknown
    session_epoch?: unknown
} | null | undefined): RedeemedGrant | null {
    const buyerAccountId = data?.buyer?.id
    const sessionEpoch = data?.session_epoch
    if (typeof buyerAccountId !== 'string' || !buyerAccountId) return null
    if (typeof sessionEpoch !== 'number' || !Number.isInteger(sessionEpoch) || sessionEpoch < 1) return null
    // A gateway from before APPID-P4d names no client. It could only have redeemed a storefront code
    // (258 allowed no other client), and a storefront code always carries its site, so an app code
    // redeemed through it (site null) still gets nothing. This keeps storefront sign-in working while
    // identity-platform is deployed ahead of the gateway.
    const clientId = data && !('client_id' in data) ? LETBUYY_STOREFRONT_CLIENT_ID : data?.client_id
    if (clientId === LETBUYY_STOREFRONT_CLIENT_ID && typeof data?.site_id === 'string' && data.site_id) {
        return { kind: 'storefront', buyerAccountId, siteId: data.site_id, sessionEpoch }
    }
    if (clientId === LETBUYY_MARKETPLACE_APP_CLIENT_ID && data?.site_id === null) {
        return { kind: 'app', buyerAccountId, sessionEpoch }
    }
    return null
}

/// Where the hosted pages may send a buyer back to after signing in or recovering a password: only
/// identity-platform's own authorize page. Anything else would make a sign-in form an open redirect.
export function safeContinuePath(value: string | null | undefined): string | null {
    if (!value || !value.startsWith('/buyer/authorize?') || value.startsWith('//') || value.includes('\\')) return null
    return value
}
