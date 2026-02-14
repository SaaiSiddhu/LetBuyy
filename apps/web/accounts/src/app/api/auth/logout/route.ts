import { NextRequest, NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth/session'
import { getSessionCookie, clearSessionCookie } from '@/lib/auth/cookies'
import { validateCsrf } from '@/lib/auth/csrf'

/**
 * POST /api/auth/logout
 * Destroy the current session and clear cookies.
 */
export async function POST(request: NextRequest) {
    try {
        // CSRF validation
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const sessionToken = await getSessionCookie()

        if (sessionToken) {
            await destroySession(sessionToken)
        }

        await clearSessionCookie()

        return NextResponse.json({ success: true, redirectTo: '/lookup' })
    } catch (error) {
        console.error('Logout error:', error)
        // Still clear cookies even if DB fails
        await clearSessionCookie()
        return NextResponse.json({ success: true, redirectTo: '/lookup' })
    }
}
