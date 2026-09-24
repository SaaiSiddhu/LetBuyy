import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; orderId: string }> }
) {
    try {
        const { store, orderId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const order = await createMerchantApiClient().orders.get(orderId)

        return NextResponse.json({ data: order })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load order')
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; orderId: string }> }
) {
    try {
        const { store, orderId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const order = await createMerchantApiClient().orders.update(orderId, {
            idempotency_key: body.idempotency_key,
            status: body.status,
            tracking_number: body.tracking_number,
            carrier: body.carrier,
            cancellation_reason: body.cancellation_reason,
            notes: body.notes,
        })

        return NextResponse.json({ data: order })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update order')
    }
}
