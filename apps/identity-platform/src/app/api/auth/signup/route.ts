import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest, getIdentityApiFailureMessage } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { createOTPToken } from '@/lib/auth/tokens'
import { sendOTPEmail } from '@/lib/email/resend'
import { validateCsrf } from '@/lib/auth/csrf'

/**
 * POST /api/auth/signup
 * Create a new user account (unverified) and send a 6-digit OTP via email.
 * The user then enters OTP on the signup page to verify their email.
 * Protected by: Rate Limit + Turnstile + CSRF
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

        // Check if user already exists
        const existingResponse = await identityApiRequest('/auth/custom/users/by-email', {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail }),
        })
        const existingPayload = await existingResponse.json().catch(() => null) as {
            data?: {
                id: string
                email_verified: boolean
            } | null
            error?: {
                code?: string
                message?: string
            }
        } | null

        if (!existingResponse.ok) {
            const message = getIdentityApiFailureMessage(existingPayload, 'Unable to check account status')
            return NextResponse.json({ error: message }, { status: existingResponse.status })
        }

        const existing = existingPayload?.data || null

        if (existing) {
            if (existing.email_verified) {
                // Already verified — redirect to login
                return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
            }
            // If exists but unverified, resend OTP
            const otp = await createOTPToken(normalizedEmail, existing.id)
            await sendOTPEmail(normalizedEmail, otp)
            return NextResponse.json({
                success: true,
                needsVerification: true,
                message: 'Verification code sent to your email',
            })
        }

        const createResponse = await identityApiRequest('/auth/custom/users/ensure', {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail }),
        })
        const createPayload = await createResponse.json().catch(() => null) as {
            data?: {
                id: string
            } | null
            error?: {
                message?: string
            }
        } | null

        if (!createResponse.ok || !createPayload?.data) {
            console.error('User creation error:', createPayload?.error?.message || createResponse.statusText)
            const message = getIdentityApiFailureMessage(createPayload, 'Failed to create account')
            return NextResponse.json({ error: message }, { status: createResponse.status || 500 })
        }
        const newUser = createPayload.data

        // Create OTP and send via email
        const otp = await createOTPToken(normalizedEmail, newUser.id)
        const emailResult = await sendOTPEmail(normalizedEmail, otp)

        if (!emailResult.success) {
            return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            needsVerification: true,
            message: 'Verification code sent to your email',
        })
    } catch (error) {
        console.error('Signup error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
