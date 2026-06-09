import { NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'
import { setSessionCookie } from '@/lib/auth/cookies'

/**
 * GET /api/auth/session
 * Get the current authenticated user's session data.
 * Used by client components to check auth state.
 */
export async function GET() {
    try {
        const response = await identityApiRequest('/auth/custom/session', {
            method: 'GET',
            requireSession: true,
        })

        if (!response.ok) {
            return NextResponse.json({ authenticated: false })
        }

        const payload = await response.json() as {
            rotated_session_token?: string
            [key: string]: unknown
        } | null
        if (payload?.rotated_session_token) {
            await setSessionCookie(payload.rotated_session_token)
            delete payload.rotated_session_token
        }
        return NextResponse.json(payload)
    } catch (error) {
        console.error('Session check error:', error)
        return NextResponse.json({ authenticated: false })
    }
}
