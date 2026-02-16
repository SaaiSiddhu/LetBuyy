import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/logout
 * Admin-side logout route.
 * - Reads lb_session from cookie
 * - Deletes session from sessions table
 * - Clears the lb_session cookie
 * - Returns redirect URL to accounts login
 *
 * This avoids cross-origin fetch to accounts app which would
 * require CORS headers and credentials handling.
 */
export async function POST() {
    try {
        const cookieStore = await cookies()
        const sessionToken = cookieStore.get('lb_session')?.value

        if (sessionToken) {
            const supabase = await createClient()

            // Delete session from DB
            await supabase
                .from('sessions')
                .delete()
                .eq('token', sessionToken)
        }

        // Clear the session cookie
        const isProduction = process.env.NODE_ENV === 'production'
        const cookieDomain = isProduction ? (process.env.COOKIE_DOMAIN || '.letbuyy.store') : undefined
        cookieStore.set('lb_session', '', {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            ...(cookieDomain ? { domain: cookieDomain } : {}),
            path: '/',
            maxAge: 0, // Expire immediately
        })

        // NOTE: Do NOT clear lb_accounts here — it stores the multi-account
        // picker list and should persist across logouts so the lookup page
        // can display previously used accounts.

        const accountsUrl =
            process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000'

        return NextResponse.json({
            success: true,
            redirectTo: `${accountsUrl}/lookup`,
        })
    } catch (error) {
        console.error('Logout error:', error)
        // Even if DB delete fails, still redirect
        const accountsUrl =
            process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'http://localhost:3000'
        return NextResponse.json({
            success: true,
            redirectTo: `${accountsUrl}/lookup`,
        })
    }
}
