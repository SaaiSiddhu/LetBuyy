import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateToken } from '@/lib/auth/tokens'
import { setPasswordSetIntentCookie } from '@/lib/auth/cookies'
import { identityApiRequest } from '@/lib/api/client'
import { createPasswordSetIntent } from '@/lib/auth/password-set-intent'

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
                const intent = await createPasswordSetIntent(result.user_id, result.email)
                await setPasswordSetIntentCookie(intent.id)

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
                    has_password: boolean
                    mfa_required?: boolean
                } | null
            } | null
            const user = userPayload?.data || null

            if (!user || !result.user_id || user.id !== result.user_id) {
                return NextResponse.redirect(new URL('/lookup?error=user_not_found', request.url))
            }

            // Email possession does not satisfy an enrolled Merchant factor.
            // Missing admission data also fails closed (e.g. an older Gateway).
            // The canonical password flow already owns MFA prompting/validation.
            if (user.mfa_required !== false) {
                return NextResponse.redirect(new URL('/login?reason=mfa_required', request.url))
            }

            // Ensure email is verified
            if (!user.email_verified) {
                await identityApiRequest('/auth/custom/users/verify-email', {
                    method: 'POST',
                    body: JSON.stringify({ user_id: user.id }),
                })
            }

            // A freshly verified passwordless account needs the same single-use
            // password-setting intent as signup, before requiring a full session.
            if (!user.has_password) {
                const intent = await createPasswordSetIntent(user.id, user.email)
                await setPasswordSetIntentCookie(intent.id)
                return NextResponse.redirect(new URL('/set-password', request.url))
            }

            // An email link is not proof of an enrolled authenticator. Existing
            // accounts finish the same password + required MFA journey as login.
            return NextResponse.redirect(new URL(`/login?choose_account=1&email=${encodeURIComponent(user.email)}`, request.url))
        }

        return NextResponse.redirect(new URL('/lookup', request.url))
    } catch (error) {
        console.error(JSON.stringify({ level: 'error', service: 'accounts', reason: 'email_verification_unavailable' }))
        return NextResponse.redirect(new URL('/lookup?error=verification_failed', request.url))
    }
}
