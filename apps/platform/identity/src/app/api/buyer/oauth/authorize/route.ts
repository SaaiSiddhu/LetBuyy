import { NextRequest, NextResponse } from 'next/server'
import { LETBUYY_BUYER_SESSION_HEADER } from '@letbuyy/auth-core'
import { identityApiRequest } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCsrf } from '@/lib/auth/csrf'
import { clearBuyerSessionCookie, getBuyerSessionCookie } from '@/lib/auth/buyer-session'
import { gatewayErrorCode } from '@/lib/auth/buyer-email-code'
import { callbackWithCode, parseAuthorizationRequest } from '@/lib/auth/buyer-authorization'

/**
 * POST /api/buyer/oauth/authorize — the signed-in buyer chose to continue to a store (APPID-P4b).
 *
 * The only way a code is issued. It takes a CSRF-checked POST from identity-platform's own authorize
 * page, never a GET: a code issued on arrival would let any page bounce a signed-in buyer through here
 * to its own store's callback and learn who they are without their knowing. The response carries the
 * callback URL with the code; the page then navigates there. The gateway has already refused any
 * callback that is not a published LetBuyy store's own address.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const rl = await checkRateLimit('buyer-oauth-authorize', ip)
        if (!rl.allowed) {
            return NextResponse.json({ error: 'Too many attempts. Please try again later.', retryAfter: rl.retryAfter }, { status: 429 })
        }

        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const token = await getBuyerSessionCookie()
        if (!token) {
            return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 })
        }

        const body = await request.json().catch(() => null) as Record<string, unknown> | null
        const authorization = body ? parseAuthorizationRequest(body) : null
        if (!authorization) {
            return NextResponse.json({ error: 'This sign-in link is not valid. Go back to the store and try again.' }, { status: 400 })
        }

        const issued = await identityApiRequest('/storefront/buyer/authorization-codes', {
            method: 'POST',
            headers: { [LETBUYY_BUYER_SESSION_HEADER]: token },
            body: JSON.stringify({
                client_id: authorization.clientId,
                redirect_uri: authorization.redirectUri,
                code_challenge: authorization.codeChallenge,
                code_challenge_method: authorization.codeChallengeMethod,
            }),
        })
        const payload = await issued.json().catch(() => null) as { data?: { code?: string } | null } | null

        if (!issued.ok) {
            const code = gatewayErrorCode(payload)
            if (issued.status === 401) {
                await clearBuyerSessionCookie()
                return NextResponse.json({ error: 'Your session has ended. Sign in again.' }, { status: 401 })
            }
            if (code === 'BUYER_DISABLED') return NextResponse.json({ error: 'This account is disabled.' }, { status: 403 })
            if (issued.status === 400) {
                return NextResponse.json({ error: 'This sign-in link is not from a LetBuyy store.' }, { status: 400 })
            }
            return NextResponse.json({ error: 'Something went wrong. Try again in a moment.' }, { status: 503 })
        }

        const code = payload?.data?.code
        if (!code) return NextResponse.json({ error: 'Something went wrong. Try again in a moment.' }, { status: 503 })

        return NextResponse.json(
            { redirect: callbackWithCode(authorization.redirectUri, code, authorization.state) },
            { headers: { 'Cache-Control': 'no-store' } },
        )
    } catch {
        return NextResponse.json({ error: 'Something went wrong. Try again in a moment.' }, { status: 503 })
    }
}
