import { randomBytes } from 'crypto'
import { createServerClient } from '../supabase/server'

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/**
 * Create a new session for a user. Returns the session token.
 * The token is stored in an HTTP-only cookie by the calling route.
 */
export async function createSession(
    userId: string,
    deviceId?: string
): Promise<string> {
    const supabase = await createServerClient()
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()

    const { error } = await supabase.from('sessions').insert({
        user_id: userId,
        device_id: deviceId || null,
        token,
        expires_at: expiresAt,
    })

    if (error) {
        throw new Error(`Failed to create session: ${error.message}`)
    }

    return token
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
    const supabase = await createServerClient()

    const { data: session, error } = await supabase
        .from('sessions')
        .select('id, user_id, expires_at')
        .eq('token', token)
        .single()

    if (error || !session) return null
    if (new Date(session.expires_at) < new Date()) {
        // Clean up expired session
        await supabase.from('sessions').delete().eq('id', session.id)
        return null
    }

    // Update last_active
    await supabase
        .from('sessions')
        .update({ last_active: new Date().toISOString() })
        .eq('id', session.id)

    // Fetch user data
    const { data: user } = await supabase
        .from('users_custom')
        .select('id, email, full_name, avatar_url')
        .eq('id', session.user_id)
        .single()

    if (!user) return null

    return {
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
    }
}

/**
 * Destroy a specific session (logout current device).
 */
export async function destroySession(token: string): Promise<void> {
    const supabase = await createServerClient()
    await supabase.from('sessions').delete().eq('token', token)
}

/**
 * Destroy all sessions for a user (logout everywhere).
 */
export async function destroyAllUserSessions(userId: string): Promise<void> {
    const supabase = await createServerClient()
    await supabase.from('sessions').delete().eq('user_id', userId)
}
