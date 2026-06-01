import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createSession } from '@/lib/auth/session'
import { setSessionCookie, addAccount } from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice } from '@/lib/auth/device'
import { identityApiRequest } from '@/lib/api/client'
import { getAdminDashboardUrl } from '@/lib/config/urls'

/**
 * GET /auth/callback
 * OAuth callback handler (Google, Apple, etc.).
 *
 * After Supabase Auth exchanges the code for a session, this route:
 * 1. Gets or creates a `users_custom` entry for the OAuth user
 * 2. Creates a custom session (lb_session cookie) — the app-wide auth system
 * 3. Adds the account to the multi-account cookie
 * 4. Redirects to admin dashboard (if store exists) or onboarding
 */
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
        return NextResponse.redirect(`${origin}/lookup?error=auth_failed`)
    }

    try {
        // Step 1: Exchange OAuth code for Supabase Auth session
        const supabaseAuth = await createClient()
        const { data, error } = await supabaseAuth.auth.exchangeCodeForSession(code)

        if (error || !data.user) {
            console.error('OAuth code exchange failed:', error)
            return NextResponse.redirect(`${origin}/lookup?error=auth_failed`)
        }

        const oauthUser = data.user
        const oauthEmail = oauthUser.email?.toLowerCase().trim()

        if (!oauthEmail) {
            return NextResponse.redirect(`${origin}/lookup?error=no_email`)
        }

        // Determine OAuth provider
        const provider = oauthUser.app_metadata?.provider || 'oauth'

        const fullName = oauthUser.user_metadata?.full_name || oauthUser.user_metadata?.name || null
        const avatarUrl = oauthUser.user_metadata?.avatar_url || oauthUser.user_metadata?.picture || null

        const userResponse = await identityApiRequest('/auth/custom/users/ensure', {
            method: 'POST',
            body: JSON.stringify({
                email: oauthEmail,
                email_verified: true,
                full_name: fullName,
                avatar_url: avatarUrl,
                auth_provider: provider,
            }),
        })
        const userPayload = await userResponse.json().catch(() => null) as {
            data?: {
                id: string
                full_name: string | null
                avatar_url: string | null
            }
            error?: {
                message?: string
            }
        } | null

        if (!userResponse.ok || !userPayload?.data) {
            console.error('Failed to create users_custom entry:', userPayload?.error?.message || userResponse.statusText)
            return NextResponse.redirect(`${origin}/lookup?error=account_creation_failed`)
        }

        const userId = userPayload.data.id
        const resolvedFullName = userPayload.data.full_name || fullName
        const resolvedAvatarUrl = userPayload.data.avatar_url || avatarUrl

        // Step 3: Create custom session + device fingerprint
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const fingerprint = generateDeviceFingerprint(new Headers(request.headers), ip)
        const userAgent = request.headers.get('user-agent') || ''
        const { deviceId } = await getOrCreateDevice(userId, fingerprint, userAgent)
        const sessionToken = await createSession(userId, deviceId)

        // Step 4: Set cookies
        await setSessionCookie(sessionToken)
        await addAccount({
            email: oauthEmail,
            name: resolvedFullName,
            avatar: resolvedAvatarUrl,
            lastLogin: new Date().toISOString(),
        })

        // Step 5: Check if user has a store → redirect appropriately
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
            : `${origin}/onboarding`

        return NextResponse.redirect(redirectTo)
    } catch (err) {
        console.error('OAuth callback error:', err)
        return NextResponse.redirect(`${origin}/lookup?error=auth_failed`)
    }
}
