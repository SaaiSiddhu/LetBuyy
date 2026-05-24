import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { getSessionCookie } from '@/lib/auth/cookies'
import { accountWorkerFetch } from '@/lib/api/worker-client'

/**
 * GET /api/auth/stores
 * Get the current authenticated user's stores/sites.
 * Used by the /select page to determine where to redirect.
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

        const storesResponse = await accountWorkerFetch('/stores?limit=50', {
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

        return NextResponse.json({
            authenticated: true,
            user: {
                id: session.userId,
                email: session.email,
                fullName: session.fullName,
            },
            stores: storesResponse.ok ? storesPayload?.data || [] : [],
        })
    } catch (error) {
        console.error('Stores fetch error:', error)
        return NextResponse.json({ authenticated: false })
    }
}
