import { NextRequest, NextResponse } from 'next/server'
import { createSession, destroySession } from '@/lib/auth/session'
import { getSessionCookie, setSessionCookie, addAccount } from '@/lib/auth/cookies'
import { generateDeviceFingerprint, getOrCreateDevice } from '@/lib/auth/device'
import { validateCsrf } from '@/lib/auth/csrf'
import { accountWorkerFetch } from '@/lib/api/worker-client'
import { getAdminDashboardUrl } from '@/lib/config/urls'

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

        // Find the target user
        const userResponse = await accountWorkerFetch('/auth/custom/users/by-email', {
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
        const storeResponse = await accountWorkerFetch('/auth/custom/users/first-store', {
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
