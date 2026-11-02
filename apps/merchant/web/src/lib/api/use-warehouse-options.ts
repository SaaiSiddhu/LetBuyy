'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { WarehouseLocationPageSchema, WarehouseSupplierPageSchema } from '@letbuyy/shared-types'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import { useReadRequest } from './use-read-request'

type PageMeta = { store_id: string; page: number; per_page: number; total: number; has_next: boolean }
type Choice = { id: string; status: string }
type State<T> = { identity: string; search: string; page: number; items: T[]; total: number | null; more: boolean; loading: boolean; error: boolean }
export type WarehouseOptionControls = {
    loading: boolean; error: boolean; hasMore: boolean; total: number | null; search: string;
    load: (reset?: boolean, search?: string) => Promise<boolean>;
}

function useWarehouseOptions<T extends Choice>(store: string, resource: string, eager: boolean,
    parse: (body: unknown) => { data: T[]; meta: PageMeta }) {
    const { actorId, siteId } = useMerchantSecurityContext(store)
    const identity = `${actorId}:${siteId ?? ''}:${store}:${resource}:${eager}`
    const beginRead = useReadRequest(identity)
    const empty = useCallback((search = '', loading = false): State<T> => ({
        identity, search, page: 0, items: [], total: null, more: false, loading, error: false,
    }), [identity])
    const [state, setState] = useState<State<T>>(() => empty('', eager))
    const snapshot = useRef(state)
    const publish = useCallback((next: State<T>) => { snapshot.current = next; setState(next) }, [])
    useLayoutEffect(() => { publish(empty('', eager)) }, [empty, eager, publish])
    const load = useCallback(async (reset = true, search?: string): Promise<boolean> => {
        const prior = snapshot.current
        if (!reset && (prior.identity !== identity || !prior.more || prior.loading)) return false
        const term = search ?? (prior.identity === identity ? prior.search : '')
        const page = reset ? 1 : prior.page + 1
        const previous = reset ? [] : prior.items
        const request = beginRead()
        publish({ ...(!reset ? prior : empty(term)), search: term, loading: true, error: false })
        try {
            const query = new URLSearchParams({ page: String(page), limit: '20', status: 'active', sort: 'name_asc', search: term })
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/${resource}?${query}`, {
                cache: 'no-store', signal: request.signal, headers: { 'X-LetBuyy-Merchant-Context': actorId },
            })
            const body: unknown = await response.json()
            if (!request.isCurrent()) return false
            if (!response.ok) throw new Error('Warehouse choices unavailable')
            const parsed = parse(body)
            if (parsed.meta.store_id !== siteId || parsed.meta.page !== page || parsed.meta.per_page !== 20 ||
                parsed.data.some(row => row.status !== 'active')) throw new Error('Warehouse choices unverified')
            const items = [...previous, ...parsed.data]
            if (new Set(items.map(row => row.id)).size !== items.length ||
                (!reset && prior.total !== parsed.meta.total)) throw new Error('Warehouse choices changed; reload')
            publish({ identity, search: term, page, items, total: parsed.meta.total, more: parsed.meta.has_next, loading: false, error: false })
            return true
        } catch {
            if (request.isCurrent()) publish({ ...empty(term), error: true })
            return false
        }
    }, [actorId, siteId, identity, resource, store, beginRead, empty, parse, publish])
    useEffect(() => { if (eager) void load(true, '') }, [eager, load])
    const visible = state.identity === identity
    return { items: visible ? state.items : [], loading: visible ? state.loading : eager,
        error: visible && state.error, hasMore: visible && state.more, total: visible ? state.total : null,
        search: visible ? state.search : '', load }
}

const parseLocations = (body: unknown) => WarehouseLocationPageSchema.parse(body)
const parseSuppliers = (body: unknown) => WarehouseSupplierPageSchema.parse(body)
export const useWarehouseLocations = (store: string) => useWarehouseOptions(store, 'inventory-locations', true, parseLocations)
export const useWarehouseSuppliers = (store: string, open: boolean) => useWarehouseOptions(store, 'suppliers', open, parseSuppliers)
