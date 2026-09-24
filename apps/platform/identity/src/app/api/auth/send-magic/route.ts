import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest, getIdentityApiFailureMessage } from '@/lib/api/client'
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

        const userResponse = await identityApiRequest('/auth/custom/users/by-email', {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail }),
        })
        const userPayload = await userResponse.json().catch(() => null) as {
            data?: {
                id: string
                email_verified: boolean
            } | null
            error?: {
                code?: string
                message?: string
            }
        } | null

        if (!userResponse.ok) {
            const message = getIdentityApiFailureMessage(userPayload, 'Auth service is unavailable. Please try again.')
            return NextResponse.json({ error: message }, { status: userResponse.status >= 500 ? 503 : userResponse.status })
        }

        const user = userPayload?.data || null

        // Always return success (don't reveal if email exists)
        if (!user) {
            return NextResponse.json({ success: true })
        }

        // If user hasn't verified yet, re-send verification email instead
        if (!user.email_verified) {
            const token = await createVerificationToken(normalizedEmail, 'email_verify', user.id)
            const { sendVerificationEmail } = await import('@/lib/email/resend')
            const emailResult = await sendVerificationEmail(normalizedEmail, token)
            if (!emailResult.success) {
                return NextResponse.json({ error: 'Unable to send verification email right now. Please try again later.' }, { status: 502 })
            }
            return NextResponse.json({ success: true })
        }

        const token = await createVerificationToken(normalizedEmail, 'magic_link', user.id)
        const emailResult = await sendMagicLinkEmail(normalizedEmail, token)
        if (!emailResult.success) {
            return NextResponse.json({ error: 'Unable to send login email right now. Please try again later.' }, { status: 502 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Send magic link error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
