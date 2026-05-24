import { NextRequest, NextResponse } from 'next/server'
import { accountWorkerFetch } from '@/lib/api/worker-client'
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

        // Rate limit (stricter for OTP — 5 attempts per 10 min)
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

        if (!result) {
            return NextResponse.json(
                { error: 'Invalid or expired verification code' },
                { status: 400 }
            )
        }

        // Mark email as verified
        await accountWorkerFetch('/auth/custom/users/verify-email', {
            method: 'POST',
            body: JSON.stringify({ email: result.email }),
        })

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
