import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const {searchParams}=new URL(request.url)
        const data = await createMerchantApiClient().commerceAnalytics.warehouseMetrics({
            store_id: resolved.storeId,
            page: Number(searchParams.get('page') || '1'),
            limit: Number(searchParams.get('limit') || '20'),
        })
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load warehouse metrics')
    }
}
