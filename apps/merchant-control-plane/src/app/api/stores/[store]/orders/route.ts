import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
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
        }

        if (searchParams.get('search')) query.search = searchParams.get('search')!
        if (searchParams.get('sort')) query.sort = searchParams.get('sort')!
        if (searchParams.get('order')) query.order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'

        const orders = await createWorkerApiClient().orders.list(query)

        return NextResponse.json({
            data: orders.data,
            meta: {
                total: orders.total,
                page: orders.page,
                per_page: orders.limit,
                has_next: orders.has_more,
            },
        })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load orders')
    }
}
