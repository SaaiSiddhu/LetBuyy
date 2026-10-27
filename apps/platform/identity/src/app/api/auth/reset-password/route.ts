import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { validatePasswordStrength } from '@/lib/auth/password'
import { MerchantPasswordResetSchema } from '@letbuyy/auth-core'
import { clearSessionCookie } from '@/lib/auth/cookies'
import { validateCsrf } from '@/lib/auth/csrf'
import { sendPasswordChangedEmail } from '@/lib/email/resend'

/**
 * POST /api/auth/reset-password
 * Reset password using a valid reset token.
 * Requires normal Merchant sign-in and enrolled MFA after password reset.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        // Rate limit
        const rl = await checkRateLimit('reset-password', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many attempts.', retryAfter: rl.retryAfter },
                { status: 429 }
            )
        }

        // CSRF validation
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const parsed = MerchantPasswordResetSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) {
            return NextResponse.json({ error: 'Use the newest reset link and a password meeting every requirement.' }, { status: 400 })
        }
        const strength = validatePasswordStrength(parsed.data.password)
        if (!strength.isValid) {
            return NextResponse.json({ error: 'Password does not meet requirements', rules: strength.rules }, { status: 400 })
        }

        // One canonical transaction binds the token's user and current email, changes
        // the hash, consumes reset links and revokes sessions. Failures commit nothing.
        const passwordResponse = await identityApiRequest('/auth/custom/users/set-password', {
            method: 'POST',
            body: JSON.stringify({ ...parsed.data, purpose: 'password_reset' }),
        })
        const payload = await passwordResponse.json().catch(() => null) as {
            data?: { id: string; email: string } | null
        } | null
        if (!passwordResponse.ok || !payload?.data) {
            return NextResponse.json({ error: passwordResponse.status >= 500
                ? 'Unable to reset your password right now. Please try again.'
                : 'Invalid or expired reset link' }, { status: passwordResponse.status >= 500 ? 503 : 400 })
        }
        const user = payload.data

        // Recovery proves the email address, not the Merchant's enrolled MFA.
        // Require normal password + MFA sign-in before granting any Merchant session.
        await clearSessionCookie()
        sendPasswordChangedEmail(user.email).catch(() => {})
        const redirectTo = '/login'

        return NextResponse.json({ success: true, redirectTo })
    } catch {
        console.error(JSON.stringify({level:'error',service:'accounts',reason:'password_reset_unavailable'}))
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
