import { identityApiRequest } from '@/lib/api/client'
import { getSessionCookie, setSessionCookie } from '@/lib/auth/cookies'
import { createMerchantSessionRead } from '@/lib/auth/session-http'

// A private session read must never become a build-time or shared response,
// including when an unavailable cookie/transport is caught by the adapter.
export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/session
 * Get the current authenticated user's session data.
 * Used by client components to check auth state.
 */
export const GET = createMerchantSessionRead({
    getSessionCookie,
    setSessionCookie,
    requestSession: (sessionToken) => identityApiRequest('/auth/custom/session', {
        method: 'GET', requireSession: true, sessionToken,
    }),
})
