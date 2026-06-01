import { identityApiRequest } from '@/lib/api/client'

/**
 * Create a new session for a user. Returns the session token.
 * The token is stored in an HTTP-only cookie by the calling route.
 */
export async function createSession(
    userId: string,
    deviceId?: string
): Promise<string> {
    const response = await identityApiRequest('/auth/custom/sessions/create', {
        method: 'POST',
        body: JSON.stringify({
            user_id: userId,
            device_id: deviceId || null,
        }),
    })
    const payload = await response.json().catch(() => null) as {
        data?: {
            token: string
        }
        error?: {
            message?: string
        }
    } | null

    if (!response.ok || !payload?.data?.token) {
        throw new Error(`Failed to create session: ${payload?.error?.message || response.statusText}`)
    }

    return payload.data.token
}

/**
 * Validate a session token. Returns the user data if valid.
 * Also updates `last_active` timestamp for session activity tracking.
 */
export async function validateSession(token: string): Promise<{
    userId: string
    email: string
    fullName: string | null
    avatarUrl: string | null
} | null> {
    const response = await identityApiRequest('/auth/custom/session', {
        method: 'GET',
        requireSession: true,
        sessionToken: token,
    })
    if (!response.ok) return null
    const payload = await response.json().catch(() => null) as {
        authenticated?: boolean
        user?: {
            id: string
            email: string
            fullName: string | null
        }
    } | null

    if (!payload?.authenticated || !payload.user) return null

    return {
        userId: payload.user.id,
        email: payload.user.email,
        fullName: payload.user.fullName,
        avatarUrl: null,
    }
}

/**
 * Destroy a specific session (logout current device).
 */
export async function destroySession(token: string): Promise<void> {
    await identityApiRequest('/auth/custom/sessions/destroy', {
        method: 'POST',
        body: JSON.stringify({ token }),
    })
}

/**
 * Destroy all sessions for a user (logout everywhere).
 */
export async function destroyAllUserSessions(userId: string): Promise<void> {
    await identityApiRequest('/auth/custom/sessions/destroy-all', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
    })
}
