import { retryMerchantRead } from '@/lib/api/read-retry'
import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import type { CustomerListQuery } from '@letbuyy/api-client'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const searchParams = request.nextUrl.searchParams
        const query: CustomerListQuery = {
            store_id: resolved.storeId,
            page: Number(searchParams.get('page') || '1'),
            limit: Number(searchParams.get('limit') || '100'),
            withCount: searchParams.get('withCount') === 'true',
        }
        if (searchParams.get('search')) query.search = searchParams.get('search')!
        if (searchParams.get('has_orders')) query.has_orders = searchParams.get('has_orders') === 'true'
        if (searchParams.get('view')) query.view = searchParams.get('view') as CustomerListQuery['view']
        if (searchParams.get('sort')) query.sort = searchParams.get('sort')!
        if (searchParams.get('order')) query.order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'

        const customers = await retryMerchantRead(() => createMerchantApiClient().customers.list(query))

        return NextResponse.json({
            data: customers.data,
            meta: {
                total: customers.total,
                page: customers.page,
                per_page: customers.limit,
                has_next: customers.has_more,
                total_is_exact: customers.total_is_exact,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load customers')
    }
}
