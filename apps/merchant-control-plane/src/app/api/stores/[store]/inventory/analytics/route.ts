import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import type { InventoryAnalyticsQuery } from '@letbuyy/api-client'

type RouteParams = { params: Promise<{ store: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const query: InventoryAnalyticsQuery = {
            store_id: resolved.storeId,
        }

        const result = await createMerchantApiClient().inventory.analytics(query)

        return NextResponse.json({ data: result })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load inventory analytics')
    }
}
