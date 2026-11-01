import { identityApiRequest } from '@/lib/api/client'
import { getSessionCookie, setSessionCookie } from '@/lib/auth/cookies'
import { createMerchantSessionRead } from '@/lib/auth/session-http'

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
