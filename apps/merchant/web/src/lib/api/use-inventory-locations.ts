'use client'

import { useCallback, useEffect, useState } from 'react'
import type { InventoryLocation } from '@letbuyy/api-client'
import { useReadRequest } from './use-read-request'

/** Form options must not hold the primary purchase/transfer rows behind a dependency. */
export function useInventoryLocations(store: string) {
    const beginRead = useReadRequest(store)
    const [state, setState] = useState({ store: '', items: [] as InventoryLocation[], loading: true, error: false })
    const load = useCallback(async () => {
        const request = beginRead()
        setState({ store, items: [], loading: true, error: false })
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/inventory-locations`, { cache: 'no-store', signal: request.signal })
            const payload = await response.json()
            if (!request.isCurrent()) return
            if (!response.ok || !Array.isArray(payload.data)) throw new Error('Locations unavailable')
            setState({ store, items: payload.data, loading: false, error: false })
        } catch {
            if (request.isCurrent()) setState({ store, items: [], loading: false, error: true })
        }
    }, [store, beginRead])
    useEffect(() => { void load() }, [load])
    return { items: state.store === store ? state.items : [], loading: state.store !== store || state.loading, error: state.store === store && state.error, load }
}
