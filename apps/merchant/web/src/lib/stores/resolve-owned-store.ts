import { NextResponse } from 'next/server'
import { LetbuyyApiError } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function resolveOwnedStore(storeParam: string) {
    try {
        const apiClient = createMerchantApiClient()
        const store = UUID_RE.test(storeParam)
            ? await apiClient.stores.get(storeParam)
            : await apiClient.stores.getByHandle(storeParam)

        if (store.id) {
            return { storeId: store.id, store }
        }
    } catch (err) {
        if (err instanceof LetbuyyApiError && err.status === 401) {
            return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
        }

        if (err instanceof LetbuyyApiError && (err.status === 403 || err.status === 404)) {
            return { error: NextResponse.json({ error: 'Store not found' }, { status: 404 }) }
        }
        return { error: merchantApiErrorResponse(err, 'The store is temporarily unavailable. Try again.') }
    }

    return { error: NextResponse.json({ error: 'Store not found' }, { status: 404 }) }
}

export async function resolveOwnedStoreId(storeParam: string) {
    const resolved = await resolveOwnedStore(storeParam)
    if (resolved.error) return { error: resolved.error }
    return { storeId: resolved.storeId }
}
