import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerErrorResponse, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; orderId: string }> }
) {
    try {
        const { store, orderId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const workerResponse = await workerFetch(`/orders/${encodeURIComponent(orderId)}`)
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load order')
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
        const workerResponse = await workerFetch(`/orders/${encodeURIComponent(orderId)}`, {
            method: 'PATCH',
            body: JSON.stringify({
                idempotency_key: body.idempotency_key,
                status: body.status,
                tracking_number: body.tracking_number,
                carrier: body.carrier,
                cancellation_reason: body.cancellation_reason,
                notes: body.notes,
            }),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return workerErrorResponse(err, 'Unable to update order')
    }
}
