import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { setSessionCookie, addAccount } from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice } from '@/lib/auth/device'
import { validateCsrf } from '@/lib/auth/csrf'

/**
 * POST /api/auth/set-password
 * Set password for a newly verified account (after OTP verification).
 * Accepts userId + email (from the OTP verification step) instead of requiring a session.
 * Creates a session and returns redirect to onboarding.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        // Rate limit
        const rl = await checkRateLimit('set-password', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many attempts. Please try again later.', retryAfter: rl.retryAfter },
                { status: 429 }
            )
        }

        // CSRF validation
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const { password, userId, email } = await request.json()

        if (!password) {
            return NextResponse.json({ error: 'Password is required' }, { status: 400 })
        }
        if (!userId || !email) {
            return NextResponse.json({ error: 'Missing user information' }, { status: 400 })
        }

        // Validate password strength
        const strength = validatePasswordStrength(password)
        if (!strength.isValid) {
            return NextResponse.json({ error: 'Password does not meet requirements', rules: strength.rules }, { status: 400 })
        }

        const supabase = await createServerClient()

        // Verify the user exists and email is verified
        const { data: user } = await supabase
            .from('users_custom')
            .select('id, email, email_verified')
            .eq('id', userId)
            .eq('email', email.toLowerCase().trim())
            .single()

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if (!user.email_verified) {
            return NextResponse.json({ error: 'Email not verified. Please verify your email first.' }, { status: 403 })
        }

        // Hash and store password
        const passwordHash = await hashPassword(password)

        const { error } = await supabase
            .from('users_custom')
            .update({
                password_hash: passwordHash,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userId)

        if (error) {
            return NextResponse.json({ error: 'Failed to set password' }, { status: 500 })
        }

        // Create device fingerprint + session
        const userAgent = request.headers.get('user-agent') || ''
        const fingerprint = generateDeviceFingerprint(request.headers, ip)
        const device = await getOrCreateDevice(userId, fingerprint, userAgent)
        const sessionToken = await createSession(userId, device.deviceId)

        // Set session cookie
        const response = NextResponse.json({
            success: true,
            redirectTo: '/onboarding',
        })

        await setSessionCookie(sessionToken)

        // Update accounts cookie
        await addAccount({
            email: user.email,
            name: null,
            avatar: null,
            lastLogin: new Date().toISOString(),
        })

        return response
    } catch (error) {
        console.error('Set password error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
