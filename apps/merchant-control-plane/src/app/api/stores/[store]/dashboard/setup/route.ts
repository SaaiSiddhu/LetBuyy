import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const apiClient = createWorkerApiClient()
        const [productsPayload, shippingPayload, pagesPayload] = await Promise.all([
            apiClient.products.list({ store_id: resolved.storeId, limit: 1 }).catch(() => null),
            apiClient.shipping.zones.list({ store_id: resolved.storeId }).catch(() => null),
            apiClient.pages.list({ store_id: resolved.storeId, limit: 1 }).catch(() => null),
        ])

        return NextResponse.json({
            data: {
                productsCount: productsPayload?.total || 0,
                shippingZonesCount: shippingPayload?.length || 0,
                pagesCount: pagesPayload?.total || 0,
            },
        })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load dashboard setup data')
    }
}
