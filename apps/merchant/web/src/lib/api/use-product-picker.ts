'use client'

import { useCallback, useState } from 'react'
import { useReadRequest } from './use-read-request'

/** Rich product/variant data is requested only by an opened inventory form. */
export function useProductPicker<T extends { id: string }>(store: string) {
    const [state, setState] = useState({ store, items: [] as T[], page: 0, hasMore: false })
    const [loadingStore, setLoadingStore] = useState<string | null>(null)
    const [errorStore, setErrorStore] = useState<string | null>(null)
    const beginRead = useReadRequest(store)
    const load = useCallback(async (reset = true) => {
        const request = beginRead()
        const page = reset ? 1 : state.page + 1
        setLoadingStore(store)
        setErrorStore(null)
        try {
            const query = new URLSearchParams({ page: String(page), limit: '100', status: 'all' })
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products?${query}`, { cache: 'no-store', signal: request.signal })
            const payload = await response.json()
            if (!request.isCurrent()) return false
            if (!response.ok || !Array.isArray(payload.data)) throw new Error('Product options unavailable')
            setState(previous => ({ store, page, hasMore: payload.meta?.has_next === true,
                items: [...new Map<string, T>((reset || previous.store !== store ? [] : previous.items).concat(payload.data as T[]).map(item => [item.id, item])).values()],
            }))
            return true
        } catch {
            if (request.isCurrent()) setErrorStore(store)
            return false
        } finally {
            if (request.isCurrent()) setLoadingStore(null)
        }
    }, [store, state.page, beginRead])
    return { items: state.store === store ? state.items : [], hasMore: state.store === store && state.hasMore, loading: loadingStore === store, error: errorStore === store, load }
}
