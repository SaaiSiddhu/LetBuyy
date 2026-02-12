import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { createVerificationToken } from '@/lib/auth/tokens'
import { sendPasswordResetEmail } from '@/lib/email/resend'

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

        const supabase = await createServerClient()
        const { data: user } = await supabase
            .from('users_custom')
            .select('id')
            .eq('email', normalizedEmail)
            .single()

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
