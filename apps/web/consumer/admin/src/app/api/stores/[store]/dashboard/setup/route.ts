import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const [productsResponse, shippingResponse, pagesResponse] = await Promise.all([
            workerFetch(`/products?store_id=${encodeURIComponent(resolved.storeId)}&limit=1`),
            workerFetch(`/shipping-tax/shipping/zones?store_id=${encodeURIComponent(resolved.storeId)}&limit=1`),
            workerFetch(`/pages?store_id=${encodeURIComponent(resolved.storeId)}&limit=1`),
        ])

        const productsPayload = await readWorkerJson(productsResponse).catch(() => null)
        const shippingPayload = await readWorkerJson(shippingResponse).catch(() => null)
        const pagesPayload = await readWorkerJson(pagesResponse).catch(() => null)

        return NextResponse.json({
            data: {
                productsCount: productsPayload?.meta?.total || 0,
                shippingZonesCount: shippingPayload?.meta?.total || 0,
                pagesCount: pagesPayload?.meta?.total || 0,
            },
        })
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unable to load dashboard setup data' },
            { status: 500 }
        )
    }
}
