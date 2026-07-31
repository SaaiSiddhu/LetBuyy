import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import type { UpdateSmartCollectionInput } from '@letbuyy/api-client'

type RouteParams = { params: Promise<{ store: string; id: string }> }

export async function PATCH(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const { store, id } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json() as UpdateSmartCollectionInput
        const data = await createMerchantApiClient().smartCollections.update(id, body)

        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update smart collection')
    }
}
