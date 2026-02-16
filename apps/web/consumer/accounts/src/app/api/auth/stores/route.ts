import { NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth/session'
import { getSessionCookie } from '@/lib/auth/cookies'
import { createServerClient } from '@/lib/supabase/server'

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

        const supabase = await createServerClient()

        const { data: stores } = await supabase
            .from('sites')
            .select('id, name, store_name, subdomain, site_type, status')
            .eq('custom_user_id', session.userId)
            .order('created_at', { ascending: false })

        return NextResponse.json({
            authenticated: true,
            user: {
                id: session.userId,
                email: session.email,
                fullName: session.fullName,
            },
            stores: stores || [],
        })
    } catch (error) {
        console.error('Stores fetch error:', error)
        return NextResponse.json({ authenticated: false })
    }
}
