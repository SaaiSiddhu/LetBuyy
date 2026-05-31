import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import type { InventoryLevelQuery } from '@letbuyy/api-client'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const { searchParams } = new URL(request.url)
        const query: InventoryLevelQuery = {
            store_id: resolved.storeId,
            page: Number(searchParams.get('page') || '1'),
            limit: Number(searchParams.get('limit') || '100'),
        }

        if (searchParams.get('product_id')) query.product_id = searchParams.get('product_id')!
        if (searchParams.get('low_stock')) query.low_stock = searchParams.get('low_stock') === 'true'

        const inventory = await createWorkerApiClient().inventory.levels(query)

        return NextResponse.json({
            data: inventory.data,
            meta: {
                total: inventory.total,
                page: inventory.page,
                per_page: inventory.limit,
                has_next: inventory.has_more,
            },
        })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load inventory')
    }
}
