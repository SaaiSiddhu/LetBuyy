import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { getSessionCookie } from '@/lib/auth/cookies'

/**
 * GET /api/auth/session
 * Get the current authenticated user's session data.
 * Used by client components to check auth state.
 */
export async function GET() {
    try {
        const sessionToken = await getSessionCookie()

        if (!sessionToken) {
            return NextResponse.json({ authenticated: false })
        }

        const session = await validateSession(sessionToken)

        if (!session) {
            return NextResponse.json({ authenticated: false })
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                id: session.userId,
                email: session.email,
                fullName: session.fullName,
                avatarUrl: session.avatarUrl,
            },
        })
    } catch (error) {
        console.error('Session check error:', error)
        return NextResponse.json({ authenticated: false })
    }
}
