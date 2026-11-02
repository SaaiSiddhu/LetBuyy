import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'
import { setSessionCookie } from '@/lib/auth/cookies'
import { nativeBearer, sameAccountsOrigin, readMobileFlow, MobileAuthError } from '@/lib/auth/mobile'

/**
 * GET /api/auth/session
 * Get the current authenticated user's session data.
 * Used by client components to check auth state.
 */
export async function GET(request: NextRequest) {
    try {
        if (!sameAccountsOrigin(request)) return NextResponse.json({ error: 'Request denied' }, { status: 403 })
        const bearer = nativeBearer(request)
        const response = await identityApiRequest('/auth/custom/session', {
            method: 'GET',
            requireSession: true,
            sessionToken: bearer,
        })

        if (!response.ok) {
            return NextResponse.json(response.status === 401 ? { authenticated: false } : { error: 'Account verification is unavailable', code: 'SESSION_UNAVAILABLE' }, { status: response.status === 401 ? 401 : 503, headers: { 'Cache-Control': 'private, no-store' } })
        }

        const payload = await response.json() as {
            rotated_session_token?: string
            [key: string]: unknown
        } | null
        if (payload?.rotated_session_token) {
            if (!bearer) {
                await setSessionCookie(payload.rotated_session_token)
                delete payload.rotated_session_token
            }
        }
        return NextResponse.json({ ...payload, ...(!bearer && await readMobileFlow() ? { continuation: 'native', redirectTo: '/mobile' } : {}) }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        if (error instanceof MobileAuthError && error.status === 401) return NextResponse.json({ authenticated: false }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
        return NextResponse.json({ error: 'Account verification is unavailable', code: 'SESSION_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
    }
}
