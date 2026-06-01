import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { setSessionCookie, addAccount } from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice, parseDeviceName } from '@/lib/auth/device'
import { validateCsrf } from '@/lib/auth/csrf'
import { sendNewDeviceLoginEmail } from '@/lib/email/resend'
import { getAdminDashboardUrl } from '@/lib/config/urls'

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

        const userResponse = await identityApiRequest('/auth/custom/users/by-email', {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail }),
        })
        const userPayload = await userResponse.json().catch(() => null) as {
            data?: {
                id: string
                email: string
                password_hash: string | null
                email_verified: boolean
                full_name: string | null
                avatar_url: string | null
            } | null
        } | null
        const user = userPayload?.data || null

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
        const storesResponse = await identityApiRequest('/stores?limit=2', {
            method: 'GET',
            requireSession: true,
            sessionToken,
        })
        const storesPayload = await storesResponse.json().catch(() => null) as {
            data?: Array<{ subdomain: string }>
        } | null
        const stores = storesResponse.ok ? storesPayload?.data || [] : []

        // Route based on store count: 0 → onboarding, 1 → admin, 2+ → store picker
        let redirectTo: string
        if (!stores || stores.length === 0) {
            redirectTo = '/onboarding'
        } else if (stores.length === 1) {
            redirectTo = getAdminDashboardUrl(stores[0].subdomain)
        } else {
            redirectTo = '/select'
        }

        return NextResponse.json({ success: true, redirectTo })
    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
