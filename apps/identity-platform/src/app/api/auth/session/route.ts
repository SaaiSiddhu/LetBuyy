import { NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'

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

        const payload = await response.json()
        return NextResponse.json(payload)
    } catch (error) {
        console.error('Session check error:', error)
        return NextResponse.json({ authenticated: false })
    }
}
