import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import type { InventoryAdjustInput } from '@letbuyy/api-client'

type InventoryAdjustBody = {
    product_id?: string
    variant_id?: string | null
    location_id?: string | null
    adjustment?: number
    reason?: string
    notes?: string | null
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json() as InventoryAdjustBody
        const payload = await createWorkerApiClient().inventory.adjust({
            product_id: body.product_id,
            variant_id: body.variant_id || null,
            location_id: body.location_id || undefined,
            adjustment: body.adjustment,
            reason: body.reason || 'correction',
            notes: body.notes || null,
        } as InventoryAdjustInput)

        return NextResponse.json({ data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to adjust inventory')
    }
}
