import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export interface SessionUser {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
}

/**
 * Validate the lb_session cookie and return the authenticated user.
 * This is the admin app's equivalent of the accounts app's session system.
 *
 * For now, it queries the sessions → users_custom tables using
 * the Supabase service role client.
 *
 * Returns null if no valid session is found.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
    try {
        const cookieStore = await cookies()
        const sessionToken = cookieStore.get('lb_session')?.value

        if (!sessionToken) return null

        const supabase = await createClient()

        // Query session → user
        const { data: session } = await supabase
            .from('sessions')
            .select('user_id, expires_at')
            .eq('token', sessionToken)
            .single()

        if (!session) return null

        // Check expiration
        if (new Date(session.expires_at) < new Date()) {
            return null
        }

        // Get user details
        const { data: user } = await supabase
            .from('users_custom')
            .select('id, email, full_name, avatar_url')
            .eq('id', session.user_id)
            .single()

        if (!user) return null

        // Update session last_active
        await supabase
            .from('sessions')
            .update({ last_active: new Date().toISOString() })
            .eq('token', sessionToken)

        return {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            avatarUrl: user.avatar_url,
        }
    } catch {
        return null
    }
}

/**
 * Get the store info for a given store_name/subdomain,
 * and verify the user owns it.
 */
export async function getStoreForUser(
    storeName: string,
    userId: string
): Promise<{
    id: string
    name: string
    store_name: string
    subdomain: string
    site_type: string
    status: string
    trial_ends_at: string | null
    trial_status: string | null
} | null> {
    try {
        const supabase = await createClient()

        const { data } = await supabase
            .from('sites')
            .select('id, name, store_name, subdomain, site_type, status, custom_user_id, trial_ends_at, trial_status')
            .or(`store_name.eq.${storeName},subdomain.eq.${storeName}`)
            .single()

        if (!data) return null

        // Verify ownership
        if (data.custom_user_id !== userId) return null

        return {
            id: data.id,
            name: data.name,
            store_name: data.store_name,
            subdomain: data.subdomain,
            site_type: data.site_type,
            status: data.status,
            trial_ends_at: data.trial_ends_at || null,
            trial_status: data.trial_status || null,
        }
    } catch {
        return null
    }
}
