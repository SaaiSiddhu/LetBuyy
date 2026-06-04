import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { LETBUYY_MERCHANT_SESSION_COOKIE } from '@letbuyy/auth-core'

/**
 * POST /api/auth/logout
 * Admin-side logout route.
 * - Reads lb_session from cookie
 * - Delegates session destruction to the accounts app
 * - Clears the lb_session cookie
 * - Returns redirect URL to accounts login
 */
export async function POST() {
    try {
        const cookieStore = await cookies()
        const sessionToken = cookieStore.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value
        const accountsUrl =
            process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.staging.letbuyy.store'

        if (sessionToken) {
            await fetch(`${accountsUrl}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    Cookie: `${LETBUYY_MERCHANT_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
                    Origin: process.env.NEXT_PUBLIC_ADMIN_URL || 'https://merchant.staging.letbuyy.store',
                },
                cache: 'no-store',
            }).catch(() => null)
        }

        // Clear the session cookie
        const isProduction = process.env.NODE_ENV === 'production'
        const cookieDomain = isProduction ? (process.env.COOKIE_DOMAIN || '.letbuyy.store') : undefined
        cookieStore.set(LETBUYY_MERCHANT_SESSION_COOKIE, '', {
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

        return NextResponse.json({
            success: true,
            redirectTo: `${accountsUrl}/lookup`,
        })
    } catch (error) {
        console.error('Logout error:', error)
        // Even if DB delete fails, still redirect
        const accountsUrl =
            process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.staging.letbuyy.store'
        return NextResponse.json({
            success: true,
            redirectTo: `${accountsUrl}/lookup`,
        })
    }
}
