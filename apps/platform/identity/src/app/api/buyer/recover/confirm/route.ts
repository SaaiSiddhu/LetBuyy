import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateCsrf } from '@/lib/auth/csrf'
import { prepareIdentityIssuedBuyerSession } from '@/lib/auth/identity-issued-session'
import { buyerSessionEpoch, setBuyerSessionCookie } from '@/lib/auth/buyer-session'
import {
    BUYER_EMAIL_CODE_PATTERN,
    BUYER_PASSWORD_MAX,
    BUYER_PASSWORD_MIN,
    buyerEmailCodeFailure,
} from '@/lib/auth/buyer-email-code'

/**
 * POST /api/buyer/recover/confirm — set a new password with the emailed reset code (APPID-P4a).
 *
 * The reset ends every existing session (the account's session epoch advances in the same database
 * transaction), then this browser is signed in with a token from the new epoch. An address with no
 * account is refused exactly like a wrong code, by the gateway, so this route cannot tell them apart
 * either.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const rl = await checkRateLimit('buyer-recover-confirm', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many attempts. Please try again later.', retryAfter: rl.retryAfter },
                { status: 429 },
            )
        }

        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const body = await request.json().catch(() => null) as { email?: unknown; code?: unknown; password?: unknown } | null
        const code = typeof body?.code === 'string' ? body.code.trim() : ''
        if (typeof body?.email !== 'string' || !body.email.trim() || typeof body.password !== 'string') {
            return NextResponse.json({ error: 'Email, code and new password are required' }, { status: 400 })
        }
        if (!BUYER_EMAIL_CODE_PATTERN.test(code)) {
            return NextResponse.json({ error: 'Enter the 6-digit code from the email.' }, { status: 400 })
        }
        if (body.password.length < BUYER_PASSWORD_MIN || body.password.length > BUYER_PASSWORD_MAX) {
            return NextResponse.json({ error: `Password must be ${BUYER_PASSWORD_MIN} to ${BUYER_PASSWORD_MAX} characters` }, { status: 400 })
        }

        const issueSession = await prepareIdentityIssuedBuyerSession()
        const reset = await identityApiRequest('/storefront/buyer/password-recovery/complete', {
            method: 'POST',
            body: JSON.stringify({ email: body.email, code, password: body.password }),
        })
        const payload = await reset.json().catch(() => null) as {
            data?: { buyer?: { id: string; email: string; status: string; session_epoch?: number } | null } | null
        } | null

        if (!reset.ok) {
            const failure = buyerEmailCodeFailure(payload, { signedIn: false })
            return NextResponse.json({ error: failure.error }, { status: failure.status })
        }

        const buyer = payload?.data?.buyer
        if (!buyer?.id) {
            return NextResponse.json({ error: 'Something went wrong. Try again in a moment.' }, { status: 503 })
        }

        const token = await issueSession({
            buyerAccountId: buyer.id,
            sessionEpoch: buyerSessionEpoch(buyer.session_epoch),
        })
        await setBuyerSessionCookie(token)

        return NextResponse.json({ buyer: { id: buyer.id, email: buyer.email, status: buyer.status } })
    } catch {
        return NextResponse.json({ error: 'Something went wrong. Try again in a moment.' }, { status: 503 })
    }
}
