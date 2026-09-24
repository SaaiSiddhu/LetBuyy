import { NextRequest, NextResponse } from 'next/server'
import { LETBUYY_BUYER_SESSION_HEADER } from '@letbuyy/auth-core'
import { identityApiRequest } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCsrf } from '@/lib/auth/csrf'
import { clearBuyerSessionCookie, getBuyerSessionCookie } from '@/lib/auth/buyer-session'
import { buyerEmailCodeFailure } from '@/lib/auth/buyer-email-code'

/**
 * POST /api/buyer/verify-email/send — email the signed-in buyer a code that proves their address
 * (APPID-P4a).
 *
 * The gateway generates the code, emails it to the account's own address and never returns it, so
 * this route cannot see the code either. Until the address is proven, a buyer can shop but cannot link
 * a store's existing customer record or claim orders placed with that address (migration 255).
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const rl = await checkRateLimit('buyer-verify-send', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
                { status: 429 },
            )
        }

        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const token = await getBuyerSessionCookie()
        if (!token) {
            return NextResponse.json({ error: 'Sign in to verify your email.' }, { status: 401 })
        }

        const started = await identityApiRequest('/storefront/buyer/email-verification/start', {
            method: 'POST',
            headers: { [LETBUYY_BUYER_SESSION_HEADER]: token },
            body: JSON.stringify({}),
        })
        const payload = await started.json().catch(() => null) as {
            data?: { sent?: boolean; already_verified?: boolean; expires_at?: string } | null
        } | null

        if (!started.ok) {
            const failure = buyerEmailCodeFailure(payload, { signedIn: true })
            if (failure.status === 401) await clearBuyerSessionCookie()
            return NextResponse.json({ error: failure.error }, { status: failure.status })
        }

        if (payload?.data?.already_verified) {
            return NextResponse.json({ success: true, alreadyVerified: true })
        }
        return NextResponse.json({ success: true, alreadyVerified: false, expiresAt: payload?.data?.expires_at ?? null })
    } catch {
        return NextResponse.json({ error: 'Something went wrong. Try again in a moment.' }, { status: 503 })
    }
}
