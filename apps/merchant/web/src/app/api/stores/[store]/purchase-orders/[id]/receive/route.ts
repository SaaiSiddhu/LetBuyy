import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import type { ReceivePurchaseOrderInput } from '@letbuyy/api-client'

type RouteParams = { params: Promise<{ store: string; id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { store, id } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json() as ReceivePurchaseOrderInput
        const data = await createMerchantApiClient().inventory.purchaseOrders.receive(
            decodeURIComponent(id),
            body,
        )
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to receive purchase order')
    }
}
