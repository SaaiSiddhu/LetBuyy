import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import type { InventoryReservationListQuery } from '@letbuyy/api-client'

type RouteParams = { params: Promise<{ store: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const { searchParams } = new URL(request.url)

        const query: InventoryReservationListQuery = {
            store_id: resolved.storeId,
            page: Number(searchParams.get('page') || '1'),
            limit: Number(searchParams.get('limit') || '20'),
        }

        const status = searchParams.get('status')
        if (status) query.status = status

        const productId = searchParams.get('product_id')
        if (productId) query.product_id = productId

        const result = await createMerchantApiClient().inventory.reservations.list(query)

        return NextResponse.json({
            data: result.data,
            meta: {
                store_id: resolved.storeId,
                total: result.total,
                page: result.page,
                per_page: result.limit,
                has_next: result.has_more,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load inventory reservations')
    }
}
