import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createSession, destroySession } from '@/lib/auth/session'
import { getSessionCookie, setSessionCookie, addAccount } from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice } from '@/lib/auth/device'
import { validateCsrf } from '@/lib/auth/csrf'

/**
 * POST /api/auth/switch
 * Switch to a different saved account.
 * The email must be in the encrypted accounts cookie.
 * Creates a new session for the target account (if they have an active session).
 */
export async function POST(request: NextRequest) {
    try {
        // CSRF validation
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const { email } = await request.json()

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const normalizedEmail = email.toLowerCase().trim()

        // Destroy current session
        const currentToken = await getSessionCookie()
        if (currentToken) {
            await destroySession(currentToken)
        }

        const supabase = await createServerClient()

        // Find the target user
        const { data: user } = await supabase
            .from('users_custom')
            .select('id, email, full_name, avatar_url, email_verified')
            .eq('email', normalizedEmail)
            .single()

        if (!user || !user.email_verified) {
            return NextResponse.json({ error: 'Account not found or not verified' }, { status: 404 })
        }

        // Create new session for target account
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
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
        const { data: store } = await supabase
            .from('sites')
            .select('subdomain')
            .eq('custom_user_id', user.id)
            .limit(1)
            .single()

        const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000'
        const redirectTo = store?.subdomain
            ? `${adminUrl}/${store.subdomain}/dashboard`
            : '/onboarding'

        return NextResponse.json({ success: true, redirectTo })
    } catch (error) {
        console.error('Account switch error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
