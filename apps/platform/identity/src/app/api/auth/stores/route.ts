import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { getSessionCookie } from '@/lib/auth/cookies'
import { identityApiRequest } from '@/lib/api/client'

/**
 * GET /api/auth/stores
 * Get the current authenticated user's stores/sites.
 * Used by the /select page to determine where to redirect.
 */
export async function GET() {
    try {
        const sessionToken = await getSessionCookie()

        if (!sessionToken) {
            return NextResponse.json({ authenticated: false }, { status: 401 })
        }

        const session = await validateSession(sessionToken)

        if (!session) {
            return NextResponse.json({ authenticated: false }, { status: 401 })
        }

        const storesResponse = await identityApiRequest('/stores?limit=50', {
            method: 'GET',
            requireSession: true,
        })
        const storesPayload = await storesResponse.json().catch(() => null) as {
            data?: Array<{
                id: string
                name: string
                store_name: string
                subdomain: string
                site_type: string
                status: string
            }>
        } | null

        if (!storesResponse.ok || !Array.isArray(storesPayload?.data)) {
            return NextResponse.json({ error: 'Unable to load your stores. Please retry.', code: 'STORE_DISCOVERY_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                id: session.userId,
                email: session.email,
                fullName: session.fullName,
            },
            stores: storesPayload.data,
        })
    } catch (error) {
        console.error(JSON.stringify({ level: 'error', service: 'accounts', reason: 'store_discovery_unavailable' }))
        return NextResponse.json({ error: 'Unable to load your stores. Please retry.', code: 'STORE_DISCOVERY_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
    }
}
