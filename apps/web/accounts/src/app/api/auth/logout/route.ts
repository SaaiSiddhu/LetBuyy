import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth/session'
import { getSessionCookie, clearSessionCookie } from '@/lib/auth/cookies'

/**
 * POST /api/auth/logout
 * Destroy the current session and clear cookies.
 */
export async function POST() {
    try {
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
