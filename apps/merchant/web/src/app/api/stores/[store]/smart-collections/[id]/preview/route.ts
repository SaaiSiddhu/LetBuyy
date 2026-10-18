import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string; id: string }> }

export async function GET(
    _request: NextRequest,
    { params }: RouteParams
) {
    try {
        const { store, id } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const data = await createMerchantApiClient().smartCollections.preview(id, { store_id: resolved.storeId })

        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load smart collection preview')
    }
}
