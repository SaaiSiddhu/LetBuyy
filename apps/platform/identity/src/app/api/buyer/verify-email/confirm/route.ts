import { NextRequest, NextResponse } from 'next/server'
import { LETBUYY_BUYER_SESSION_HEADER } from '@letbuyy/auth-core'
import { identityApiRequest } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCsrf } from '@/lib/auth/csrf'
import { clearBuyerSessionCookie, getBuyerSessionCookie } from '@/lib/auth/buyer-session'
import { BUYER_EMAIL_CODE_PATTERN, buyerEmailCodeFailure } from '@/lib/auth/buyer-email-code'

/**
 * POST /api/buyer/verify-email/confirm — prove the signed-in buyer's address with the emailed code
 * (APPID-P4a).
 *
 * The code is checked against the SESSION's account; the body carries only the code. A code works
 * once, dies after 10 minutes or 5 wrong tries, and proves nothing if the address changed after it
 * was sent. Those rules live in the database, not here.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const rl = await checkRateLimit('buyer-verify-confirm', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many attempts. Please try again later.', retryAfter: rl.retryAfter },
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

        const body = await request.json().catch(() => null) as { code?: unknown } | null
        const code = typeof body?.code === 'string' ? body.code.trim() : ''
        if (!BUYER_EMAIL_CODE_PATTERN.test(code)) {
            return NextResponse.json({ error: 'Enter the 6-digit code from the email.' }, { status: 400 })
        }

        const confirmed = await identityApiRequest('/storefront/buyer/email-verification/complete', {
            method: 'POST',
            headers: { [LETBUYY_BUYER_SESSION_HEADER]: token },
            body: JSON.stringify({ code }),
        })
        const payload = await confirmed.json().catch(() => null)

        if (!confirmed.ok) {
            const failure = buyerEmailCodeFailure(payload, { signedIn: true })
            if (failure.status === 401) await clearBuyerSessionCookie()
            return NextResponse.json({ error: failure.error }, { status: failure.status })
        }

        return NextResponse.json({ success: true, emailVerified: true })
    } catch {
        return NextResponse.json({ error: 'Something went wrong. Try again in a moment.' }, { status: 503 })
    }
}
