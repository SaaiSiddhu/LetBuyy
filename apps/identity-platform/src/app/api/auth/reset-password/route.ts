import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateToken } from '@/lib/auth/tokens'
import { validatePasswordStrength } from '@/lib/auth/password'
import { createSession, destroyAllUserSessions } from '@/lib/auth/session'
import { setSessionCookie, addAccount } from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice } from '@/lib/auth/device'
import { validateCsrf } from '@/lib/auth/csrf'
import { sendPasswordChangedEmail } from '@/lib/email/resend'
import { getAdminDashboardUrl } from '@/lib/config/urls'

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

        // Get user
        const userResponse = await identityApiRequest('/auth/custom/users/by-email', {
            method: 'POST',
            body: JSON.stringify({ email: result.email }),
        })
        const userPayload = await userResponse.json().catch(() => null) as {
            data?: {
                id: string
                email: string
                full_name: string | null
                avatar_url: string | null
            } | null
        } | null
        const user = userPayload?.data || null

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const passwordResponse = await identityApiRequest('/auth/custom/users/set-password', {
            method: 'POST',
            body: JSON.stringify({
                user_id: user.id,
                email: user.email,
                password,
            }),
        })
        if (!passwordResponse.ok) {
            return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
        }

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
        const storesResponse = await identityApiRequest('/stores?limit=1', {
            method: 'GET',
            requireSession: true,
            sessionToken,
        })
        const storesPayload = await storesResponse.json().catch(() => null) as {
            data?: Array<{ subdomain: string }>
        } | null
        const store = storesResponse.ok ? storesPayload?.data?.[0] : null

        const redirectTo = store?.subdomain
            ? getAdminDashboardUrl(store.subdomain)
            : '/onboarding'

        return NextResponse.json({ success: true, redirectTo })
    } catch (error) {
        console.error('Reset password error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
