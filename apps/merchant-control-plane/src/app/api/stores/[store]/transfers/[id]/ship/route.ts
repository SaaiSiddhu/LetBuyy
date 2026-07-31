import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import type { ShipInventoryTransferInput } from '@letbuyy/api-client'

type RouteParams = { params: Promise<{ store: string; id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { store, id } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json() as Omit<ShipInventoryTransferInput, 'store_id'>
        const data = await createMerchantApiClient().inventory.transfers.ship(
            decodeURIComponent(id),
            { ...body, store_id: resolved.storeId },
        )
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to ship inventory transfer')
    }
}
