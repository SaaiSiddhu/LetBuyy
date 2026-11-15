import { startMerchantBuyerConnection,confirmMerchantBuyerConnection,cancelMerchantBuyerConnection } from '@/lib/auth/merchant-buyer-http'
import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest, getIdentityApiFailureMessage } from '@/lib/api/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { createSession } from '@/lib/auth/session'
import { setSessionCookie, addAccount } from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice, parseDeviceName } from '@/lib/auth/device'
import { validateCsrf } from '@/lib/auth/csrf'
import { sendNewDeviceLoginEmail } from '@/lib/email/resend'
import { getAdminDashboardUrl } from '@/lib/config/urls'
import { SignInSchema } from '@letbuyy/auth-core'
import { z } from 'zod'
import { approveMobileFlow, mobileFailure, MobileAuthError } from '@/lib/auth/mobile'

/**
 * POST /api/auth/login
 * Authenticate user with email and password.
 * Protected by: Rate Limit + Turnstile
 */
export async function POST(request: NextRequest) {
    const connectionIntent=request.headers.get('X-LetBuyy-Account-Intent')
    if(connectionIntent==='connect-buyer-start')return startMerchantBuyerConnection(request)
    if(connectionIntent==='connect-buyer-confirm')return confirmMerchantBuyerConnection(request)
    if(connectionIntent==='connect-buyer-cancel')return cancelMerchantBuyerConnection(request)
    if(connectionIntent)return NextResponse.json({error:'Invalid account action.'},{status:400})
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

        const parsed = SignInSchema.extend({ turnstileToken: z.string().max(4096).optional(), mfaCode: z.string().max(16).optional(), recoveryCode: z.string().trim().max(40).optional() }).safeParse(await request.json().catch(() => null))
        if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 })
        const { email, password, turnstileToken, mfaCode, recoveryCode } = parsed.data

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
        }

        // Verify Turnstile
        const isHuman = await verifyTurnstileToken(turnstileToken || '', ip)
        if (!isHuman) {
            return NextResponse.json({ error: 'Bot verification failed.' }, { status: 403 })
        }

        const normalizedEmail = email.toLowerCase().trim()

        const userResponse = await identityApiRequest('/auth/custom/users/authenticate', {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail, password, mfa_code: mfaCode || undefined, recovery_code: recoveryCode || undefined }),
        })
        const userPayload = await userResponse.json().catch(() => null) as {
            data?: {
                id: string
                email: string
                email_verified: boolean
                full_name: string | null
                avatar_url: string | null
            } | null
            error?: {
                code?: string
                message?: string
            }
            mfa_required?: boolean
        } | null

        if (!userResponse.ok) {
            if (userPayload?.mfa_required || userPayload?.error?.code === 'MFA_REQUIRED') {
                return NextResponse.json({
                    error: userPayload?.error?.message || 'Enter your authenticator code to continue',
                    mfaRequired: true,
                }, { status: 403 })
            }
            const fallback = userResponse.status === 401
                ? 'Invalid email or password'
                : userResponse.status === 403
                    ? 'Please verify your email first'
                    : 'Auth service is unavailable. Please try again.'
            const message = getIdentityApiFailureMessage(userPayload, fallback)
            return NextResponse.json({ error: message }, { status: userResponse.status >= 500 ? 503 : userResponse.status })
        }

        const user = userPayload?.data || null

        if (!user) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
        }

        // Create device fingerprint and session
        const fingerprint = generateDeviceFingerprint(request.headers, ip)
        const userAgent = request.headers.get('user-agent') || ''
        const { deviceId, isNew: isNewDevice } = await getOrCreateDevice(user.id, fingerprint, userAgent)
        const sessionToken = await createSession(user.id, deviceId)

        // Fresh password + required MFA has completed. Bind this exact browser session
        // before returning to the app; a signed remembered-email cookie is not proof.
        const nativeContinuation = await approveMobileFlow(sessionToken)

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

        if (nativeContinuation) return NextResponse.json({ success: true, ...nativeContinuation }, { headers: { 'Cache-Control': 'private, no-store' } })

        // CHECK IF USER HAS COMPLETED ONBOARDING (store exists?)
        const storesResponse = await identityApiRequest('/stores?limit=2', {
            method: 'GET',
            requireSession: true,
            sessionToken,
        })
        const storesPayload = await storesResponse.json().catch(() => null) as {
            data?: Array<{ subdomain: string }>
        } | null
        if (!storesResponse.ok || !Array.isArray(storesPayload?.data)) {
            return NextResponse.json({ success: true, discoveryUnavailable: true, redirectTo: '/select' }, { headers: { 'Cache-Control': 'private, no-store' } })
        }
        const stores = storesPayload.data

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
        if (error instanceof MobileAuthError) return mobileFailure(error)
        console.error(JSON.stringify({ level: 'error', service: 'accounts', reason: 'login_unavailable' }))
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
