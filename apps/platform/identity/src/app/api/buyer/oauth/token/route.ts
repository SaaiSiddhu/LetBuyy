import { NextRequest, NextResponse } from 'next/server'
import { LETBUYY_STOREFRONT_SESSION_TTL_SECONDS } from '@letbuyy/auth-core'
import { identityApiRequest } from '@/lib/api/client'
import { createIdentityIssuedStorefrontSessionToken } from '@/lib/auth/identity-issued-session'

/**
 * POST /api/buyer/oauth/token — a storefront's server exchanges a code and its PKCE verifier for the
 * buyer's session at that store (APPID-P4b, RFC 6749 §4.1.3 with RFC 7636).
 *
 * No cookie is read or written here, so there is nothing for CSRF to protect: the code and the
 * verifier are the whole credential, the code lives 60 seconds, and the database burns it on any
 * failed attempt. It is not rate limited by address, because every storefront shares a few server
 * addresses and one noisy store would lock every other store's buyers out.
 *
 * Errors use RFC 6749's shape, and every refused code is `invalid_grant`, whatever the reason.
 */
const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }
const oauthError = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE })

async function readParams(request: NextRequest): Promise<Record<string, unknown> | null> {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/x-www-form-urlencoded')) {
        const form = new URLSearchParams(await request.text())
        return Object.fromEntries(form.entries())
    }
    return await request.json().catch(() => null) as Record<string, unknown> | null
}

export async function POST(request: NextRequest) {
    try {
        const params = await readParams(request)
        if (!params) return oauthError('invalid_request', 400)
        if (params.grant_type !== 'authorization_code') return oauthError('unsupported_grant_type', 400)

        const { code, code_verifier: codeVerifier, client_id: clientId, redirect_uri: redirectUri } = params
        if (typeof code !== 'string' || typeof codeVerifier !== 'string' || typeof clientId !== 'string' || typeof redirectUri !== 'string') {
            return oauthError('invalid_request', 400)
        }

        const redeemed = await identityApiRequest('/storefront/buyer/authorization-codes/redeem', {
            method: 'POST',
            body: JSON.stringify({ code, code_verifier: codeVerifier, client_id: clientId, redirect_uri: redirectUri }),
        })
        const payload = await redeemed.json().catch(() => null) as {
            data?: { buyer?: { id?: string } | null; site_id?: string; session_epoch?: number } | null
        } | null

        if (redeemed.status === 400) return oauthError('invalid_grant', 400)
        const buyerId = payload?.data?.buyer?.id
        const siteId = payload?.data?.site_id
        const sessionEpoch = payload?.data?.session_epoch
        if (!redeemed.ok || !buyerId || !siteId || typeof sessionEpoch !== 'number') {
            return oauthError('temporarily_unavailable', 503)
        }

        const accessToken = await createIdentityIssuedStorefrontSessionToken({ buyerAccountId: buyerId, siteId, sessionEpoch })
        if (!accessToken) return oauthError('temporarily_unavailable', 503)

        return NextResponse.json(
            { access_token: accessToken, token_type: 'Bearer', expires_in: LETBUYY_STOREFRONT_SESSION_TTL_SECONDS, site_id: siteId },
            { headers: NO_STORE },
        )
    } catch {
        return oauthError('temporarily_unavailable', 503)
    }
}
