import { NextRequest, NextResponse } from 'next/server'
import { accountWorkerFetch, getAccountWorkerFailureMessage } from '@/lib/api/worker-client'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateOTPToken } from '@/lib/auth/tokens'
import { validateCsrf } from '@/lib/auth/csrf'

/**
 * POST /api/auth/verify-otp
 * Verify a 6-digit OTP code for email verification during signup.
 * On success, marks the email as verified and returns { verified: true }.
 * The client then proceeds to the password-set step.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        // Rate limit (stricter for OTP — 5 attempts per 15 min)
        const rl = await checkRateLimit('verify_otp', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many attempts. Please request a new code.', retryAfter: rl.retryAfter },
                { status: 429 }
            )
        }

        // CSRF validation
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request.' }, { status: 403 })
        }

        const { email, otp } = await request.json()

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        if (!otp || typeof otp !== 'string' || otp.length !== 6) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
        }

        // Validate OTP
        const result = await validateOTPToken(email.toLowerCase().trim(), otp)

        if (!result?.user_id) {
            return NextResponse.json(
                { error: 'Invalid or expired verification code' },
                { status: 400 }
            )
        }

        // Mark email as verified
        const verifyResponse = await accountWorkerFetch('/auth/custom/users/verify-email', {
            method: 'POST',
            body: JSON.stringify({ user_id: result.user_id, email: result.email }),
        })
        const verifyPayload = await verifyResponse.json().catch(() => null) as {
            data?: {
                id: string
                email: string
                email_verified: boolean
            } | null
            error?: {
                message?: string
            }
        } | null

        if (!verifyResponse.ok || !verifyPayload?.data) {
            const message = getAccountWorkerFailureMessage(
                verifyPayload,
                'Unable to verify email. Please request a new code.'
            )
            return NextResponse.json({ error: message }, { status: verifyResponse.status || 500 })
        }

        return NextResponse.json({
            success: true,
            verified: true,
            userId: result.user_id,
        })
    } catch (error) {
        console.error('Verify OTP error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
