import { NextRequest, NextResponse } from 'next/server'
import { accountWorkerFetch } from '@/lib/api/worker-client'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { createVerificationToken } from '@/lib/auth/tokens'
import { sendMagicLinkEmail } from '@/lib/email/resend'
import { validateCsrf } from '@/lib/auth/csrf'

/**
 * POST /api/auth/send-magic
 * Send a magic link login email.
 * Protected by: Rate Limit + Turnstile
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        // Rate limit
        const rl = await checkRateLimit('send-magic', ip)
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
                email_verified: boolean
            } | null
        } | null
        const user = userPayload?.data || null

        // Always return success (don't reveal if email exists)
        if (!user) {
            return NextResponse.json({ success: true })
        }

        // If user hasn't verified yet, re-send verification email instead
        if (!user.email_verified) {
            const token = await createVerificationToken(normalizedEmail, 'email_verify', user.id)
            const { sendVerificationEmail } = await import('@/lib/email/resend')
            await sendVerificationEmail(normalizedEmail, token)
            return NextResponse.json({ success: true })
        }

        const token = await createVerificationToken(normalizedEmail, 'magic_link', user.id)
        await sendMagicLinkEmail(normalizedEmail, token)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Send magic link error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
