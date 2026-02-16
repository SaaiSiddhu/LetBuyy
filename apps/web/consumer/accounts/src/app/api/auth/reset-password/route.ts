import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateToken } from '@/lib/auth/tokens'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { createSession, destroyAllUserSessions } from '@/lib/auth/session'
import { setSessionCookie, addAccount } from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice } from '@/lib/auth/device'
import { validateCsrf } from '@/lib/auth/csrf'
import { sendPasswordChangedEmail } from '@/lib/email/resend'

/**
 * POST /api/auth/reset-password
 * Reset password using a valid reset token.
 * Creates a fresh session after password reset.
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

        const { token, password } = await request.json()

        if (!token || !password) {
            return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
        }

        // Validate password strength
        const strength = validatePasswordStrength(password)
        if (!strength.isValid) {
            return NextResponse.json({ error: 'Password does not meet requirements', rules: strength.rules }, { status: 400 })
        }

        // Validate reset token
        const result = await validateToken(token, 'password_reset')
        if (!result) {
            return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
        }

        const supabase = await createServerClient()

        // Get user
        const { data: user } = await supabase
            .from('users_custom')
            .select('id, email, full_name, avatar_url')
            .eq('email', result.email)
            .single()

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Hash and update password
        const passwordHash = await hashPassword(password)
        await supabase
            .from('users_custom')
            .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
            .eq('id', user.id)

        // Invalidate all existing sessions (security: force re-login everywhere)
        await destroyAllUserSessions(user.id)

        // Create new session on this device
        const fingerprint = generateDeviceFingerprint(request.headers, ip)
        const userAgent = request.headers.get('user-agent') || ''
        const { deviceId } = await getOrCreateDevice(user.id, fingerprint, userAgent)
        const sessionToken = await createSession(user.id, deviceId)

        // Set cookies
        await setSessionCookie(sessionToken)
        await addAccount({
            email: user.email,
            name: user.full_name,
            avatar: user.avatar_url,
            lastLogin: new Date().toISOString(),
        })

        // Security alert: password changed (fire-and-forget)
        sendPasswordChangedEmail(user.email).catch(() => { })

        // Check if user has a store → redirect appropriately
        const { data: store } = await supabase
            .from('sites')
            .select('subdomain')
            .eq('custom_user_id', user.id)
            .limit(1)
            .single()

        const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000'
        const redirectTo = store?.subdomain
            ? `${adminUrl}/${store.subdomain}/dashboard`
            : '/onboarding'

        return NextResponse.json({ success: true, redirectTo })
    } catch (error) {
        console.error('Reset password error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
