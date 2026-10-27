import { cache } from 'react'
import { createMerchantApiClient } from '@/lib/api/client'

import { apiErrorStatus, retryMerchantRead } from '@/lib/api/read-retry'
export { isQueryCostRateLimited } from '@/lib/api/read-retry'

export interface SessionUser {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
    try {
        const payload = await retryMerchantRead(() => createMerchantApiClient().auth.session())

        if (!payload.authenticated || !payload.user) return null

        return {
            id: payload.user.id,
            email: payload.user.email,
            fullName: payload.user.fullName ?? null,
            avatarUrl: null,
        }
    } catch (error) {
        // Only genuine auth failures mean "logged out". Transient failures
        // (5xx, network, timeout, unexpected throws) must rethrow so an error
        // boundary renders instead of bouncing a valid merchant to login.
        const status = apiErrorStatus(error)
        if (status === 401 || status === 403) return null
        throw error
    }
})

const getStoreForCurrentSession = cache(async (
    storeName: string
): Promise<{
    id: string
    name: string
    store_name: string
    subdomain: string
    site_type: string
    status: string
    trial_ends_at: string | null
    trial_status: string | null
    theme_id: string
    theme_settings: Record<string, unknown> | null
    custom_domain: string | null
    custom_domain_status: string | null
} | null> => {
    try {
        const data = await retryMerchantRead(() => createMerchantApiClient().stores.getByHandle(storeName))

        if (!data) return null

        return {
            id: data.id,
            name: data.name,
            store_name: data.store_name || data.name,
            subdomain: data.subdomain,
            site_type: data.site_type,
            status: data.status,
            trial_ends_at: data.trial_ends_at || null,
            trial_status: data.trial_status || null,
            theme_id: data.theme_id || 'modern',
            theme_settings: data.theme_settings || null,
            custom_domain: data.custom_domain || null,
            custom_domain_status: data.custom_domain_status || 'none',
        }
    } catch (error) {
        // 401/403 (no access) and 404 (missing store) → not found.
        // 5xx/network/unexpected → rethrow so an error boundary renders
        // instead of faking a 404 for a transient backend failure.
        const status = apiErrorStatus(error)
        if (status === 401 || status === 403 || status === 404) return null
        throw error
    }
})

/** The gateway authorizes the current cookie; user hints never grant access.
 * Cache by handle within this request so layout/page callers share that read. */
export function getStoreForUser(storeName: string, _userId?: string) {
    void _userId // Compatibility only; the current session is the authority.
    return getStoreForCurrentSession(storeName)
}

export const getUserStores = cache(async (
    _userId: string
): Promise<Array<{
    id: string
    name: string
    store_name: string
    subdomain: string
    site_type: string
    status: string
}>> => {
    try {
        const payload = await retryMerchantRead(() => createMerchantApiClient().stores.list({ limit: 50 }))

        return payload.data.map((store) => ({
            id: store.id,
            name: store.name,
            store_name: store.store_name || store.name,
            subdomain: store.subdomain,
            site_type: store.site_type,
            status: store.status,
        }))
    } catch (error) {
        // Only genuine auth failures yield an empty list. Transient failures
        // (5xx, network, timeout, unexpected throws) rethrow so an error
        // boundary renders instead of silently showing "no stores".
        const status = apiErrorStatus(error)
        if (status === 401 || status === 403) return []
        throw error
    }
})
