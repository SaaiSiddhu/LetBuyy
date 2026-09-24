import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { validateCsrf } from '@/lib/auth/csrf'
import { createIdentityIssuedBuyerSessionToken } from '@/lib/auth/identity-issued-session'
import { setBuyerSessionCookie } from '@/lib/auth/buyer-session'

/**
 * POST /api/buyer/login — authenticate a marketplace buyer (D-8).
 *
 * The gateway verifies the credential and answers identically for a missing account, an account with
 * no password, and a wrong password. This route must preserve that: it returns ONE generic failure
 * for all of them. Reporting "no such account" separately would turn the pair into an
 * email-enumeration oracle, undoing the property BUYER-3 exists to hold.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        const rl = await checkRateLimit('buyer-login', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many login attempts. Please try again later.', retryAfter: rl.retryAfter },
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

        const verified = await identityApiRequest('/storefront/buyer/verify-credentials', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        })
        const payload = await verified.json().catch(() => null) as {
            data?: { buyer?: { id: string; email: string; status: string } | null } | null
        } | null

        // One outcome for every failure mode, including a disabled account: the gateway answers 403
        // there, and distinguishing it here would tell an attacker the address is registered.
        const buyer = verified.ok ? payload?.data?.buyer : null
        if (!buyer?.id) {
            return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
        }

        const token = await createIdentityIssuedBuyerSessionToken({ buyerAccountId: buyer.id })
        if (token) await setBuyerSessionCookie(token)

        return NextResponse.json({ buyer: { id: buyer.id, email: buyer.email, status: buyer.status } })
    } catch {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }
}
