import { NextRequest, NextResponse } from 'next/server'
import { identityApiRequest } from '@/lib/api/client'
import { getSessionCookie, setSessionCookie } from '@/lib/auth/cookies'
import { createMerchantSessionRead } from '@/lib/auth/session-http'
import { nativeBearer, sameAccountsOrigin, readMobileFlow, MobileAuthError } from '@/lib/auth/mobile'

export const dynamic = 'force-dynamic'

/** Browser and native callers share the canonical denial/outage classifier. */
export async function GET(request: NextRequest) {
    try {
        if (!sameAccountsOrigin(request)) return NextResponse.json({ error: 'Request denied' }, { status: 403 })
        const bearer = nativeBearer(request)
        return await createMerchantSessionRead({
            getSessionCookie: () => bearer ? Promise.resolve(bearer) : getSessionCookie(),
            setSessionCookie,
            includeRotatedToken: Boolean(bearer),
            deniedStatus: bearer ? 401 : 200,
            requestSession: sessionToken => identityApiRequest('/auth/custom/session', {
                method: 'GET', requireSession: true, sessionToken,
            }),
            continuation: async () => !bearer && await readMobileFlow()
                ? { continuation: 'native', redirectTo: '/mobile' } : {},
        })()
    } catch (error) {
        return NextResponse.json(error instanceof MobileAuthError && error.status === 401
            ? { authenticated: false } : { error: { code: 'SESSION_UNAVAILABLE', message: 'Sign-in could not be confirmed. Please retry.' } },
        { status: error instanceof MobileAuthError && error.status === 401 ? 401 : 503,
            headers: { 'Cache-Control': 'private, no-store' } })
    }
}
