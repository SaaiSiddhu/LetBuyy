import { NextRequest, NextResponse } from 'next/server'
import { validateCsrf } from '@/lib/auth/csrf'
import { clearBuyerSessionCookie } from '@/lib/auth/buyer-session'

/**
 * POST /api/buyer/logout — application logout (APPID-P4a).
 *
 * Ends the buyer session in THIS browser by removing its cookie, and nothing else: other devices stay
 * signed in. The token itself is not revoked, so a copy taken from this browser would keep working
 * until it expires. Ending every session, copies included, is /api/buyer/sign-out-everywhere.
 */
export async function POST(request: NextRequest) {
    if (!validateCsrf(request)) {
        return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
    }
    await clearBuyerSessionCookie()
    return NextResponse.json({ success: true })
}
