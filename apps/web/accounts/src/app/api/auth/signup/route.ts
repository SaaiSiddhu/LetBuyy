import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { createVerificationToken } from '@/lib/auth/tokens'
import { sendVerificationEmail } from '@/lib/email/resend'
import { validateCsrf } from '@/lib/auth/csrf'

/**
 * POST /api/auth/signup
 * Create a new user account and send verification email.
 * Protected by: Rate Limit + Turnstile
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        // Rate limit
        const rl = await checkRateLimit('signup', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many signup attempts. Please try again later.', retryAfter: rl.retryAfter },
                { status: 429 }
            )
        }

        // CSRF validation
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const { email, turnstileToken } = await request.json()

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        // Verify Turnstile (bot protection)
        const isHuman = await verifyTurnstileToken(turnstileToken || '', ip)
        if (!isHuman) {
            return NextResponse.json({ error: 'Bot verification failed. Please try again.' }, { status: 403 })
        }

        const normalizedEmail = email.toLowerCase().trim()

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(normalizedEmail)) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
        }

        const supabase = await createServerClient()

        // Check if user already exists
        const { data: existing } = await supabase
            .from('users_custom')
            .select('id, email_verified')
            .eq('email', normalizedEmail)
            .single()

        if (existing) {
            if (existing.email_verified) {
                return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
            }
            // If exists but unverified, resend verification
            const token = await createVerificationToken(normalizedEmail, 'email_verify', existing.id)
            await sendVerificationEmail(normalizedEmail, token)
            return NextResponse.json({ success: true, message: 'Verification email sent' })
        }

        // Create new user
        const { data: newUser, error: createError } = await supabase
            .from('users_custom')
            .insert({ email: normalizedEmail })
            .select('id')
            .single()

        if (createError || !newUser) {
            console.error('User creation error:', createError)
            return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
        }

        // Create verification token and send email
        const token = await createVerificationToken(normalizedEmail, 'email_verify', newUser.id)
        const emailResult = await sendVerificationEmail(normalizedEmail, token)

        if (!emailResult.success) {
            return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Verification email sent' })
    } catch (error) {
        console.error('Signup error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
