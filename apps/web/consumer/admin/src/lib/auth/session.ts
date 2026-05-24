import { workerFetch, readWorkerJson } from '@/lib/api/worker-client'
import { cache } from 'react'

export interface SessionUser {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
}

interface StoreSummary {
    id: string
    name: string
    store_name: string
    subdomain: string
    site_type: string
    status: string
    trial_ends_at?: string | null
    trial_status?: string | null
    theme_id?: string | null
    theme_settings?: Record<string, unknown> | null
    custom_domain?: string | null
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
    try {
        const response = await workerFetch('/auth/custom/session', {
            method: 'GET',
            requireSession: true,
        })
        const payload = await readWorkerJson(response) as {
            authenticated?: boolean
            user?: {
                id: string
                email: string
                fullName: string | null
            }
        }

        if (!payload.authenticated || !payload.user) return null

        return {
            id: payload.user.id,
            email: payload.user.email,
            fullName: payload.user.fullName,
            avatarUrl: null,
        }
    } catch {
        return null
    }
})

export const getStoreForUser = cache(async (
    storeName: string,
    _userId: string
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
} | null> => {
    try {
        const response = await workerFetch(`/stores/handle/${encodeURIComponent(storeName)}`, {
            method: 'GET',
            requireSession: true,
        })
        const payload = await readWorkerJson(response) as { data?: StoreSummary }
        const data = payload.data

        if (!data) return null

        return {
            id: data.id,
            name: data.name,
            store_name: data.store_name,
            subdomain: data.subdomain,
            site_type: data.site_type,
            status: data.status,
            trial_ends_at: data.trial_ends_at || null,
            trial_status: data.trial_status || null,
            theme_id: data.theme_id || 'modern',
            theme_settings: data.theme_settings || null,
            custom_domain: data.custom_domain || null,
        }
    } catch {
        return null
    }
})

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
        const response = await workerFetch('/stores?limit=50', {
            method: 'GET',
            requireSession: true,
        })
        const payload = await readWorkerJson(response) as { data?: StoreSummary[] }

        return (payload.data || []).map((store) => ({
            id: store.id,
            name: store.name,
            store_name: store.store_name,
            subdomain: store.subdomain,
            site_type: store.site_type,
            status: store.status,
        }))
    } catch {
        return []
    }
})
