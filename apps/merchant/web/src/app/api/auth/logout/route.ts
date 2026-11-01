import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { LETBUYY_MERCHANT_SESSION_COOKIE } from '@letbuyy/auth-core'
import { getAccountsUrl, getAdminUrl } from '@/lib/public-urls'

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
        const accountsUrl = getAccountsUrl()

        if (sessionToken) {
            await fetch(`${accountsUrl}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    Cookie: `${LETBUYY_MERCHANT_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
                    Origin: getAdminUrl(),
                },
                cache: 'no-store',
                // Revocation is already best effort on network failure. Bound
                // this wait so clearing the local cookie cannot hang forever.
                signal: AbortSignal.timeout(5_000),
            }).catch(() => null)
        }

        // Clear the session cookie
        const isProduction = process.env.NODE_ENV === 'production'
        const cookieDomain = isProduction ? (process.env.COOKIE_DOMAIN || '.letbuyy.com') : undefined
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
            redirectTo: getAccountsUrl('/lookup'),
        }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
        console.error('Logout error:', error)
        return NextResponse.json({
            success: false,
            error: { code: 'LOGOUT_UNCONFIRMED', message: 'Session cleanup could not be confirmed.' },
        }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
    }
}
