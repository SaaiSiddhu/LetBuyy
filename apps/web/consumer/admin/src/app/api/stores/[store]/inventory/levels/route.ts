import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerErrorResponse, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const { searchParams } = new URL(request.url)
        const query = new URLSearchParams({
            store_id: resolved.storeId,
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '100',
        })

        if (searchParams.get('product_id')) query.set('product_id', searchParams.get('product_id')!)
        if (searchParams.get('low_stock')) query.set('low_stock', searchParams.get('low_stock')!)

        const workerResponse = await workerFetch(`/inventory/levels?${query.toString()}`)
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load inventory')
    }
}
