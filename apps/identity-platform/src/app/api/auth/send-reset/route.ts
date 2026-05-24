import { NextRequest, NextResponse } from 'next/server'
import { accountWorkerFetch } from '@/lib/api/worker-client'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { createVerificationToken } from '@/lib/auth/tokens'
import { sendPasswordResetEmail } from '@/lib/email/resend'
import { validateCsrf } from '@/lib/auth/csrf'

/**
 * POST /api/auth/send-reset
 * Send a password reset email.
 * Protected by: Rate Limit + Turnstile
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        // Rate limit
        const rl = await checkRateLimit('send-reset', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
                { status: 429 }
            )
        }

        // CSRF validation
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const { email, turnstileToken } = await request.json()

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        // Verify Turnstile
        const isHuman = await verifyTurnstileToken(turnstileToken || '', ip)
        if (!isHuman) {
            return NextResponse.json({ error: 'Bot verification failed.' }, { status: 403 })
        }

        const normalizedEmail = email.toLowerCase().trim()

        const userResponse = await accountWorkerFetch('/auth/custom/users/by-email', {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail }),
        })
        const userPayload = await userResponse.json().catch(() => null) as {
            data?: {
                id: string
            } | null
        } | null
        const user = userPayload?.data || null

        // Always return success (don't reveal if email exists)
        if (!user) {
            return NextResponse.json({ success: true })
        }

        const token = await createVerificationToken(normalizedEmail, 'password_reset', user.id)
        await sendPasswordResetEmail(normalizedEmail, token)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Send reset error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
