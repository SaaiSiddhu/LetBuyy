import { NextRequest, NextResponse } from 'next/server'
import { LETBUYY_BUYER_SESSION_HEADER } from '@letbuyy/auth-core'
import { identityApiRequest } from '@/lib/api/client'
import { validateCsrf } from '@/lib/auth/csrf'
import { clearBuyerSessionCookie, getBuyerSessionCookie } from '@/lib/auth/buyer-session'

/**
 * POST /api/buyer/sign-out-everywhere — end every session the buyer has (APPID-P4a).
 *
 * The gateway advances the account's session epoch (migration 257), and from then on it refuses every
 * token issued before, on every device, including copies. This browser's cookie goes too. The account
 * is the one the forwarded session belongs to; nothing in the request can name another.
 */
export async function POST(request: NextRequest) {
    try {
        if (!validateCsrf(request)) {
            return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 })
        }

        const token = await getBuyerSessionCookie()
        if (!token) {
            return NextResponse.json({ error: 'You are not signed in.' }, { status: 401 })
        }

        const revoked = await identityApiRequest('/storefront/buyer/sessions/revoke', {
            method: 'POST',
            headers: { [LETBUYY_BUYER_SESSION_HEADER]: token },
            body: JSON.stringify({}),
        })

        if (revoked.ok) {
            await clearBuyerSessionCookie()
            return NextResponse.json({ success: true })
        }
        if (revoked.status === 401) {
            // This session had already ended, so it cannot prove whose sessions to end.
            await clearBuyerSessionCookie()
            return NextResponse.json({ error: 'Your session has already ended. Sign in again, then sign out everywhere.' }, { status: 401 })
        }
        // Kept signed in on purpose, so the buyer can try again without signing back in first.
        return NextResponse.json({ error: "We couldn't sign you out everywhere. Try again in a moment." }, { status: 503 })
    } catch {
        return NextResponse.json({ error: "We couldn't sign you out everywhere. Try again in a moment." }, { status: 503 })
    }
}
