import { NextRequest, NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth/session'
import { getSessionCookie, clearSessionCookie } from '@/lib/auth/cookies'
import { getAccountsUrl, getAdminUrl } from '@/lib/config/urls'
import { nativeBearer, sameAccountsOrigin } from '@/lib/auth/mobile'

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
        const bearer = nativeBearer(request)
        if (bearer && !sameAccountsOrigin(request)) return NextResponse.json({ error: 'Request denied' }, { status: 403 })
        const sessionToken = bearer || await getSessionCookie()

        if (sessionToken) {
            await destroySession(sessionToken)
        }

        if (!bearer) await clearSessionCookie()

        return NextResponse.json({ success: true, redirectTo: '/lookup' }, { headers: cors })
    } catch (error) {
        console.error(JSON.stringify({ level: 'error', service: 'accounts', reason: 'logout_revoke_unavailable' }))
        // Still clear cookies even if DB fails
        if (!request.headers.has('Authorization')) await clearSessionCookie()
        return NextResponse.json({ success: false, localSignOutAllowed: true, error: 'Signed out locally; server revocation could not be confirmed.' }, { status: 503, headers: { ...cors, 'Cache-Control': 'private, no-store' } })
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
