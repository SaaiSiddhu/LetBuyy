import { NextRequest, NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth/session'
import { getSessionCookie, clearSessionCookie } from '@/lib/auth/cookies'
import { getAccountsUrl, getAdminUrl } from '@/lib/config/urls'

function getAllowedOrigins(): Set<string> {
    return new Set(
        [
            getAdminUrl(),
            getAccountsUrl(),
            process.env.ADMIN_ORIGIN,
            process.env.NEXT_PUBLIC_ADMIN_URL,
            process.env.NEXT_PUBLIC_ACCOUNTS_URL,
        ].filter((origin): origin is string => Boolean(origin))
    )
}

function corsHeaders(request: NextRequest) {
    const origin = request.headers.get('origin') || ''
    const headers: Record<string, string> = {}
    if (getAllowedOrigins().has(origin)) {
        headers['Access-Control-Allow-Origin'] = origin
        headers['Access-Control-Allow-Credentials'] = 'true'
    }
    return headers
}

/**
 * POST /api/auth/logout
 * Destroy the current session and clear cookies.
 * No CSRF validation — logout is idempotent and safe.
 * Supports cross-origin calls from the admin app.
 */
export async function POST(request: NextRequest) {
    const cors = corsHeaders(request)

    try {
        const sessionToken = await getSessionCookie()

        if (sessionToken) {
            await destroySession(sessionToken)
        }

        await clearSessionCookie()

        return NextResponse.json({ success: true, redirectTo: '/lookup' }, { headers: cors })
    } catch (error) {
        console.error('Logout error:', error)
        // Still clear cookies even if DB fails
        await clearSessionCookie()
        return NextResponse.json({ success: true, redirectTo: '/lookup' }, { headers: cors })
    }
}

/**
 * OPTIONS /api/auth/logout
 * Handle CORS preflight for cross-origin logout requests.
 */
export async function OPTIONS(request: NextRequest) {
    const origin = request.headers.get('origin') || ''
    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    if (getAllowedOrigins().has(origin)) {
        headers['Access-Control-Allow-Origin'] = origin
        headers['Access-Control-Allow-Credentials'] = 'true'
    }
    return new NextResponse(null, { status: 204, headers })
}
