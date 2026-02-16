import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createSession } from '@/lib/auth/session'
import { setSessionCookie, addAccount } from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice } from '@/lib/auth/device'

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

        // Step 2: Get or create users_custom entry (service role for full access)
        const supabase = await createServerClient()

        const { data: existingUser } = await supabase
            .from('users_custom')
            .select('id, email, full_name, avatar_url, email_verified')
            .eq('email', oauthEmail)
            .single()

        let userId: string
        let fullName: string | null = null
        let avatarUrl: string | null = null

        if (existingUser) {
            // Existing user — update if needed
            userId = existingUser.id
            fullName = existingUser.full_name
            avatarUrl = existingUser.avatar_url

            // If user previously signed up with email but hasn't verified,
            // mark as verified now (OAuth confirms the email)
            if (!existingUser.email_verified) {
                await supabase
                    .from('users_custom')
                    .update({
                        email_verified: true,
                        auth_provider: provider,
                        avatar_url: existingUser.avatar_url || oauthUser.user_metadata?.avatar_url || null,
                        full_name: existingUser.full_name || oauthUser.user_metadata?.full_name || null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', userId)
            }
        } else {
            // New user — create users_custom entry
            fullName = oauthUser.user_metadata?.full_name || oauthUser.user_metadata?.name || null
            avatarUrl = oauthUser.user_metadata?.avatar_url || oauthUser.user_metadata?.picture || null

            const { data: newUser, error: insertError } = await supabase
                .from('users_custom')
                .insert({
                    email: oauthEmail,
                    email_verified: true,
                    full_name: fullName,
                    avatar_url: avatarUrl,
                    auth_provider: provider,
                })
                .select('id')
                .single()

            if (insertError || !newUser) {
                console.error('Failed to create users_custom entry:', insertError)
                return NextResponse.redirect(`${origin}/lookup?error=account_creation_failed`)
            }

            userId = newUser.id
        }

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
            name: fullName,
            avatar: avatarUrl,
            lastLogin: new Date().toISOString(),
        })

        // Step 5: Check if user has a store → redirect appropriately
        const { data: store } = await supabase
            .from('sites')
            .select('subdomain')
            .eq('custom_user_id', userId)
            .limit(1)
            .single()

        const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000'
        const redirectTo = store?.subdomain
            ? `${adminUrl}/${store.subdomain}/dashboard`
            : `${origin}/onboarding`

        return NextResponse.redirect(redirectTo)
    } catch (err) {
        console.error('OAuth callback error:', err)
        return NextResponse.redirect(`${origin}/lookup?error=auth_failed`)
    }
}
