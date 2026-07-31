import { NextRequest, NextResponse } from 'next/server'
import type { CustomerSegmentRules } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json() as Record<string, unknown>
        const preview = await createMerchantApiClient().customers.segments.preview({
            store_id: resolved.storeId,
            rules: (body.rules as CustomerSegmentRules) ?? { tags_any: [] },
        })
        return NextResponse.json({ data: preview })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to preview customer segment')
    }
}
