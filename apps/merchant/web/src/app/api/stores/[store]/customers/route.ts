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
        }
        if (searchParams.get('search')) query.search = searchParams.get('search')!
        if (searchParams.get('has_orders')) query.has_orders = searchParams.get('has_orders') === 'true'

        const customers = await createMerchantApiClient().customers.list(query)

        return NextResponse.json({
            data: customers.data,
            meta: {
                total: customers.total,
                page: customers.page,
                per_page: customers.limit,
                has_next: customers.has_more,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load customers')
    }
}
