import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { setSessionCookie, addAccount } from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice, parseDeviceName } from '@/lib/auth/device'
import { validateCsrf } from '@/lib/auth/csrf'
import { sendNewDeviceLoginEmail } from '@/lib/email/resend'

/**
 * POST /api/auth/login
 * Authenticate user with email and password.
 * Protected by: Rate Limit + Turnstile
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        // Rate limit by IP + email
        const rl = await checkRateLimit('login', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many login attempts. Please try again later.', retryAfter: rl.retryAfter },
                { status: 429 }
            )
        }

        // CSRF validation
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const { email, password, turnstileToken } = await request.json()

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
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
            .select('id, email, password_hash, email_verified, full_name, avatar_url')
            .eq('email', normalizedEmail)
            .single()

        if (!user || !user.password_hash) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
        }

        if (!user.email_verified) {
            return NextResponse.json({ error: 'Please verify your email first' }, { status: 403 })
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password_hash)
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
        }

        // Create device fingerprint and session
        const fingerprint = generateDeviceFingerprint(request.headers, ip)
        const userAgent = request.headers.get('user-agent') || ''
        const { deviceId, isNew: isNewDevice } = await getOrCreateDevice(user.id, fingerprint, userAgent)
        const sessionToken = await createSession(user.id, deviceId)

        // Set cookies
        await setSessionCookie(sessionToken)
        await addAccount({
            email: user.email,
            name: user.full_name,
            avatar: user.avatar_url,
            lastLogin: new Date().toISOString(),
        })

        // Security alert: new device login (fire-and-forget)
        if (isNewDevice) {
            sendNewDeviceLoginEmail(user.email, {
                device: parseDeviceName(userAgent),
                ip: ip || 'Unknown',
            }).catch(() => { }) // Don't fail login if email fails
        }

        // CHECK IF USER HAS COMPLETED ONBOARDING (store exists?)
        const { data: store } = await supabase
            .from('sites')
            .select('subdomain')
            .eq('custom_user_id', user.id)
            .limit(1)
            .single()

        const adminUrl =
            process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'

        // If user has a store → admin dashboard, otherwise → onboarding
        const redirectTo = store?.subdomain
            ? `${adminUrl}/${store.subdomain}/dashboard`
            : '/onboarding'

        return NextResponse.json({ success: true, redirectTo })
    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
