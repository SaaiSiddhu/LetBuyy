import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { validateSession } from '@/lib/auth/session'
import { getSessionCookie, addAccount } from '@/lib/auth/cookies'
import { validateCsrf } from '@/lib/auth/csrf'

/**
 * POST /api/auth/set-password
 * Set password for a newly verified account.
 * Requires an active session (from email verification redirect).
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

        // Verify session (user must be logged in from email verification)
        const sessionToken = await getSessionCookie()
        if (!sessionToken) {
            return NextResponse.json({ error: 'Session expired. Please verify your email again.' }, { status: 401 })
        }

        const session = await validateSession(sessionToken)
        if (!session) {
            return NextResponse.json({ error: 'Session expired. Please verify your email again.' }, { status: 401 })
        }

        const { password } = await request.json()
        if (!password) {
            return NextResponse.json({ error: 'Password is required' }, { status: 400 })
        }

        // Validate password strength
        const strength = validatePasswordStrength(password)
        if (!strength.isValid) {
            return NextResponse.json({ error: 'Password does not meet requirements', rules: strength.rules }, { status: 400 })
        }

        // Hash and store password
        const passwordHash = await hashPassword(password)
        const supabase = await createServerClient()

        const { error } = await supabase
            .from('users_custom')
            .update({
                password_hash: passwordHash,
                updated_at: new Date().toISOString(),
            })
            .eq('id', session.userId)

        if (error) {
            return NextResponse.json({ error: 'Failed to set password' }, { status: 500 })
        }

        // Update accounts cookie
        await addAccount({
            email: session.email,
            name: session.fullName,
            avatar: session.avatarUrl,
            lastLogin: new Date().toISOString(),
        })

        return NextResponse.json({
            success: true,
            redirectTo: '/onboarding',
        })
    } catch (error) {
        console.error('Set password error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
