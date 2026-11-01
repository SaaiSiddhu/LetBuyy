import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import type { OrderListQuery } from '@letbuyy/api-client'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const { searchParams } = new URL(request.url)
        const query: OrderListQuery = {
            store_id: resolved.storeId,
            status: searchParams.get('status') || 'all',
            payment_status: searchParams.get('payment_status') || 'all',
            page: Number(searchParams.get('page') || '1'),
            limit: Number(searchParams.get('limit') || '50'),
            withCount: searchParams.get('withCount') === 'true',
        }

        if (searchParams.get('search')) query.search = searchParams.get('search')!
        if (searchParams.get('sort')) query.sort = searchParams.get('sort')!
        if (searchParams.get('order')) query.order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'

        const orders = await createMerchantApiClient().orders.list(query)

        return NextResponse.json({
            data: orders.data,
            meta: {
                total: orders.total,
                page: orders.page,
                per_page: orders.limit,
                has_next: orders.has_more,
                total_is_exact: orders.total_is_exact,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load orders')
    }
}
