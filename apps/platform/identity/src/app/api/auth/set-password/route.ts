import { NextRequest, NextResponse } from 'next/server'
import { PasswordUpdateSchema } from '@letbuyy/auth-core'
import { identityApiRequest } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { validatePasswordStrength } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import {
    addAccount,
    clearPasswordSetIntentCookie,
    getPasswordSetIntentCookie,
    setSessionCookie,
} from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice } from '@/lib/auth/device'
import { validateCsrf } from '@/lib/auth/csrf'
import { consumePasswordSetIntent } from '@/lib/auth/password-set-intent'
import { approveMobileFlow, mobileFailure, MobileAuthError } from '@/lib/auth/mobile'

/** Advisory form readiness only. POST consumes and validates the server intent. */
export async function GET() {
    const intentId = await getPasswordSetIntentCookie()
    return NextResponse.json({ canSetPassword: Boolean(intentId) }, {
        status: intentId ? 200 : 403,
        headers: { 'Cache-Control': 'private, no-store' },
    })
}

/**
 * POST /api/auth/set-password
 * Set password for a newly verified account (after OTP verification).
 * Consumes the server-side OTP/email verification intent cookie.
 * Creates a session and returns redirect to onboarding.
 */
export async function POST(request: NextRequest) {
    let savedEmail: string | null = null
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

        const parsed = PasswordUpdateSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return NextResponse.json({ error: 'Password must meet all requirements, including the 128-character limit.' }, { status: 400 })
        const { password } = parsed.data

        if (!password) {
            return NextResponse.json({ error: 'Password is required' }, { status: 400 })
        }

        const intentId = await getPasswordSetIntentCookie()
        if (!intentId) {
            return NextResponse.json({ error: 'Email verification session expired. Please verify your email again.' }, { status: 403 })
        }

        // Validate password strength
        const strength = validatePasswordStrength(password)
        if (!strength.isValid) {
            return NextResponse.json({ error: 'Password does not meet requirements', rules: strength.rules }, { status: 400 })
        }

        let intent: Awaited<ReturnType<typeof consumePasswordSetIntent>>
        try {
            intent = await consumePasswordSetIntent(intentId)
        } catch {
            await clearPasswordSetIntentCookie()
            return NextResponse.json({ error: 'Email verification session expired. Please verify your email again.' }, { status: 403 })
        }

        const passwordResponse = await identityApiRequest('/auth/custom/users/set-password', {
            method: 'POST',
            body: JSON.stringify({
                user_id: intent.user_id,
                email: intent.email,
                password,
            }),
        })
        const passwordPayload = await passwordResponse.json().catch(() => null) as {
            data?: {
                id: string
                email: string
            }
            error?: {
                message?: string
            }
        } | null

        if (!passwordResponse.ok || !passwordPayload?.data) {
            await clearPasswordSetIntentCookie()
            return NextResponse.json(
                { error: passwordPayload?.error?.message || 'Failed to set password' },
                { status: passwordResponse.status }
            )
        }
        const user = passwordPayload.data
        savedEmail = intent.email

        // Email proof permits password setup, never bypass of an enrolled factor.
        const proof = await identityApiRequest('/auth/custom/users/authenticate', { method: 'POST', body: JSON.stringify({ email: intent.email, password }) })
        const proofPayload = await proof.json() as { data?: { id: string }; mfa_required?: boolean } | null
        if (!proof.ok || proofPayload?.data?.id !== intent.user_id) {
            await clearPasswordSetIntentCookie()
            return NextResponse.json({ success: true, signInRequired: true, redirectTo: `/login?choose_account=1&email=${encodeURIComponent(intent.email)}` }, { headers: { 'Cache-Control': 'private, no-store' } })
        }

        // Create device fingerprint + session
        const userAgent = request.headers.get('user-agent') || ''
        const fingerprint = generateDeviceFingerprint(request.headers, ip)
        const device = await getOrCreateDevice(intent.user_id, fingerprint, userAgent)
        const sessionToken = await createSession(intent.user_id, device.deviceId)
        const nativeContinuation = await approveMobileFlow(sessionToken)

        // Set session cookie
        const response = NextResponse.json({
            success: true,
            redirectTo: '/onboarding',
            ...nativeContinuation,
        })

        await setSessionCookie(sessionToken)
        await clearPasswordSetIntentCookie()

        // Update accounts cookie
        await addAccount({
            email: user.email,
            name: null,
            avatar: null,
            lastLogin: new Date().toISOString(),
        })

        return response
    } catch (error) {
        if (error instanceof MobileAuthError) return mobileFailure(error)
        console.error(JSON.stringify({ level: 'error', service: 'accounts', reason: 'password_setup_unavailable' }))
        if (savedEmail) {
            await clearPasswordSetIntentCookie()
            return NextResponse.json({ success: true, signInRequired: true, redirectTo: `/login?choose_account=1&email=${encodeURIComponent(savedEmail)}` }, { headers: { 'Cache-Control': 'private, no-store' } })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
