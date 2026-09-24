import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest, getIdentityApiFailureMessage } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { validateCsrf } from '@/lib/auth/csrf'
import { createIdentityIssuedBuyerSessionToken } from '@/lib/auth/identity-issued-session'
import { buyerSessionEpoch, setBuyerSessionCookie } from '@/lib/auth/buyer-session'

/**
 * POST /api/buyer/register — create a marketplace buyer account (D-8).
 *
 * Guards mirror /api/auth/login exactly rather than a lighter path: buyer registration is open to
 * the public by necessity, which makes it more exposed than the merchant flow, not less.
 *
 * The row is created by the gateway (it owns buyer_accounts); this route only mints the session.
 * identity-platform is the sole issuer (ART-05) and holds no database client.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        const rl = await checkRateLimit('buyer-register', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many attempts. Please try again later.', retryAfter: rl.retryAfter },
                { status: 429 },
            )
        }

        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const { email, password, turnstileToken } = await request.json()
        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
        }

        const isHuman = await verifyTurnstileToken(turnstileToken || '', ip)
        if (!isHuman) {
            return NextResponse.json({ error: 'Bot verification failed.' }, { status: 403 })
        }

        // No store_id. A buyer spans sellers; site_id is the tenant boundary and a buyer is not a
        // tenant. If a caller ever needs to pass one here, the buyer model has been misunderstood.
        const created = await identityApiRequest('/storefront/buyer/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        })
        const payload = await created.json().catch(() => null) as {
            data?: { buyer?: { id: string; email: string; status: string; session_epoch?: number } | null } | null
        } | null

        if (!created.ok) {
            const message = getIdentityApiFailureMessage(payload, 'Could not create the account.')
            return NextResponse.json({ error: message }, { status: created.status || 500 })
        }

        const buyer = payload?.data?.buyer
        if (!buyer?.id) {
            return NextResponse.json({ error: 'Could not create the account.' }, { status: 500 })
        }

        const token = await createIdentityIssuedBuyerSessionToken({
            buyerAccountId: buyer.id,
            sessionEpoch: buyerSessionEpoch(buyer.session_epoch),
        })
        if (token) await setBuyerSessionCookie(token)

        return NextResponse.json({ buyer: { id: buyer.id, email: buyer.email, status: buyer.status } }, { status: 201 })
    } catch {
        return NextResponse.json({ error: 'Could not create the account.' }, { status: 500 })
    }
}
