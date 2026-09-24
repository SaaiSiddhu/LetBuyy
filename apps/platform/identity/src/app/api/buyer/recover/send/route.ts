import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { validateCsrf } from '@/lib/auth/csrf'

/**
 * POST /api/buyer/recover/send — email a password reset code to a buyer account (APPID-P4a).
 *
 * One answer for every address. Whether an account exists, is disabled, has asked too often, or could
 * be emailed, the caller sees the same success, and the gateway answers this route the same way. The
 * code goes from the gateway to the account's inbox; neither this route nor its caller ever sees it.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const rl = await checkRateLimit('buyer-recover-send', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
                { status: 429 },
            )
        }

        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const { email, turnstileToken } = await request.json() as { email?: unknown; turnstileToken?: unknown }
        if (typeof email !== 'string' || !email.trim()) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const isHuman = await verifyTurnstileToken(typeof turnstileToken === 'string' ? turnstileToken : '', ip)
        if (!isHuman) {
            return NextResponse.json({ error: 'Bot verification failed.' }, { status: 403 })
        }

        const started = await identityApiRequest('/storefront/buyer/password-recovery/start', {
            method: 'POST',
            body: JSON.stringify({ email }),
        })
        // Only a fault on this side of the gateway changes the answer, and it is the same fault for
        // every address.
        if (!started.ok) {
            return NextResponse.json({ error: 'Password recovery is unavailable right now. Please try again later.' }, { status: 503 })
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Password recovery is unavailable right now. Please try again later.' }, { status: 503 })
    }
}
