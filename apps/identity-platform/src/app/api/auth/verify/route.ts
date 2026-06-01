import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateToken } from '@/lib/auth/tokens'
import { createSession } from '@/lib/auth/session'
import { setSessionCookie, addAccount } from '@/lib/auth/cookies'
import { identityApiRequest } from '@/lib/api/client'
import { generateDeviceFingerprint, getOrCreateDevice } from '@/lib/auth/device'
import { getAdminDashboardUrl } from '@/lib/config/urls'

/**
 * GET /api/auth/verify?token=xxx&type=email_verify|magic_link
 * Verify email or process magic link login.
 * Redirects to appropriate page after verification.
 */
export async function GET(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'

        // Rate limit
        const rl = await checkRateLimit('verify', ip)
        if (!rl.allowed) {
            return NextResponse.redirect(new URL('/lookup?error=rate_limit', request.url))
        }

        const { searchParams } = new URL(request.url)
        const token = searchParams.get('token')
        const type = searchParams.get('type') as 'email_verify' | 'magic_link'

        if (!token || !type || !['email_verify', 'magic_link'].includes(type)) {
            return NextResponse.redirect(new URL('/lookup?error=invalid_link', request.url))
        }

        // Validate token (marks as used)
        const result = await validateToken(token, type)
        if (!result) {
            const errorPage = type === 'email_verify' ? '/signup' : '/lookup'
            return NextResponse.redirect(new URL(`${errorPage}?error=expired_link`, request.url))
        }

        if (type === 'email_verify') {
            // Mark user as verified
            await identityApiRequest('/auth/custom/users/verify-email', {
                method: 'POST',
                body: JSON.stringify({ email: result.email }),
            })

            // Create a temporary session for password setting
            if (result.user_id) {
                const fingerprint = generateDeviceFingerprint(request.headers, ip)
                const userAgent = request.headers.get('user-agent') || ''
                const { deviceId } = await getOrCreateDevice(result.user_id, fingerprint, userAgent)
                const sessionToken = await createSession(result.user_id, deviceId)
                await setSessionCookie(sessionToken)
            }

            return NextResponse.redirect(new URL('/set-password', request.url))
        }

        if (type === 'magic_link') {
            // Get user for magic link login
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
                    email_verified: boolean
                } | null
            } | null
            const user = userPayload?.data || null

            if (!user) {
                return NextResponse.redirect(new URL('/lookup?error=user_not_found', request.url))
            }

            // Ensure email is verified
            if (!user.email_verified) {
                await identityApiRequest('/auth/custom/users/verify-email', {
                    method: 'POST',
                    body: JSON.stringify({ user_id: user.id }),
                })
            }

            // Create session
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

            return NextResponse.redirect(new URL(redirectTo, request.url))
        }

        return NextResponse.redirect(new URL('/lookup', request.url))
    } catch (error) {
        console.error('Verify error:', error)
        return NextResponse.redirect(new URL('/lookup?error=verification_failed', request.url))
    }
}
