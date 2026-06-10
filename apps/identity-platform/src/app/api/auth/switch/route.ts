import { NextRequest, NextResponse } from 'next/server'
import { createSession, destroySession, validateSession } from '@/lib/auth/session'
import { getSessionCookie, setSessionCookie, addAccount, getAccounts } from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice } from '@/lib/auth/device'
import { validateCsrf } from '@/lib/auth/csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { identityApiRequest } from '@/lib/api/client'
import { getAdminDashboardUrl } from '@/lib/config/urls'

/**
 * POST /api/auth/switch
 * Switch to a different *already-proven* account on this device.
 *
 * SECURITY — Wave 0 / SEC-C1 fix.
 * This endpoint previously minted a session for ANY `email_verified` user supplied
 * in the request body, with no proof the caller owned that account. Combined with the
 * JS-readable double-submit CSRF cookie, that was an unauthenticated account-takeover
 * (any verified merchant/staff account). The doc-comment claimed an accounts-cookie
 * check that the code never performed.
 *
 * It now enforces, in order: rate limit (SEC-H7) → CSRF → a VALID current session
 * (you must already be signed in to switch) → the target email must be present in the
 * signed, httpOnly `lb_accounts` cookie (i.e. THIS browser previously authenticated
 * that account). A seamless cross-account session is therefore only granted for
 * accounts already proven on this device; unknown accounts are routed to re-authenticate.
 *
 * Full multi-account linking (per-account sessions via `account_links`) is a
 * frozen-target feature for a later wave; this is the secure interim behavior.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        // Rate limit (SEC-H7): /switch was previously unthrottled.
        const rl = await checkRateLimit('switch', ip)
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
                { status: 429 }
            )
        }

        // CSRF validation
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const { email } = await request.json()
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }
        const normalizedEmail = email.toLowerCase().trim()

        // SEC-C1 (1/2): require an authenticated current session. You can only
        // switch *away from* an account you are already signed into.
        const currentToken = await getSessionCookie()
        const currentSession = currentToken ? await validateSession(currentToken) : null
        if (!currentToken || !currentSession) {
            return NextResponse.json(
                { error: 'You must be signed in to switch accounts.', redirectTo: '/lookup' },
                { status: 401 }
            )
        }

        // SEC-C1 (2/2): the target must be an account already proven on THIS device,
        // i.e. present in the signed httpOnly lb_accounts cookie. This is the check the
        // prior comment described but never enforced — it is what stops a caller from
        // minting a session for an account they have never authenticated.
        const savedAccounts = await getAccounts()
        const isProvenAccount = savedAccounts.some(
            (a) => a.email.toLowerCase().trim() === normalizedEmail
        )
        if (!isProvenAccount) {
            return NextResponse.json(
                {
                    error: 'That account is not available for quick switch on this device. Please sign in.',
                    redirectTo: `/login?email=${encodeURIComponent(normalizedEmail)}`,
                },
                { status: 403 }
            )
        }

        // Switching away from the current account: destroy its session.
        await destroySession(currentToken)

        // Resolve the target user.
        const userResponse = await identityApiRequest('/auth/custom/users/by-email', {
            method: 'POST',
            body: JSON.stringify({ email: normalizedEmail }),
        })
        const userPayload = await userResponse.json().catch(() => null) as {
            data?: {
                id: string
                email: string
                full_name: string | null
                avatar_url: string | null
                email_verified: boolean | null
            } | null
        } | null
        const user = userPayload?.data

        if (!user || !user.email_verified) {
            return NextResponse.json({ error: 'Account not found or not verified' }, { status: 404 })
        }

        // Create new session for target account
        const fingerprint = generateDeviceFingerprint(request.headers, ip)
        const userAgent = request.headers.get('user-agent') || ''
        const { deviceId } = await getOrCreateDevice(user.id, fingerprint, userAgent)
        const sessionToken = await createSession(user.id, deviceId)

        // Update cookies
        await setSessionCookie(sessionToken)
        await addAccount({
            email: user.email,
            name: user.full_name,
            avatar: user.avatar_url,
            lastLogin: new Date().toISOString(),
        })

        // Check if user has a store → redirect appropriately
        const storeResponse = await identityApiRequest('/auth/custom/users/first-store', {
            method: 'POST',
            body: JSON.stringify({ user_id: user.id }),
        })
        const storePayload = await storeResponse.json().catch(() => null) as {
            data?: {
                subdomain?: string | null
            } | null
        } | null
        const store = storeResponse.ok ? storePayload?.data : null

        const redirectTo = store?.subdomain
            ? getAdminDashboardUrl(store.subdomain)
            : '/onboarding'

        return NextResponse.json({ success: true, redirectTo })
    } catch (error) {
        console.error('Account switch error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
