// APPID-P4b — the first-party authorization request a storefront sends identity-platform.
//
// Shape only. Whether the callback belongs to a LetBuyy store is the gateway's to decide (it resolves
// the host with the storefront's own resolver), and identity-platform never redirects anywhere the
// gateway has not accepted. What this rejects never leaves identity-platform at all: an error is shown
// on identity-platform's own page, because redirecting an error to an unchecked address is itself an
// open redirect.

import { LETBUYY_STOREFRONT_CLIENT_ID } from '@letbuyy/auth-core'

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
    if (clientId !== LETBUYY_STOREFRONT_CLIENT_ID) return null
    if (!redirectUri || redirectUri.length > 2048) return null
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

/// Where the hosted pages may send a buyer back to after signing in or recovering a password: only
/// identity-platform's own authorize page. Anything else would make a sign-in form an open redirect.
export function safeContinuePath(value: string | null | undefined): string | null {
    if (!value || !value.startsWith('/buyer/authorize?') || value.startsWith('//') || value.includes('\\')) return null
    return value
}
