import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; zoneId: string }> }
) {
    try {
        const { store, zoneId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const workerResponse = await workerFetch(`/shipping-tax/shipping/zones/${encodeURIComponent(zoneId)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to update shipping zone' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; zoneId: string }> }
) {
    try {
        const { store, zoneId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const workerResponse = await workerFetch(`/shipping-tax/shipping/zones/${encodeURIComponent(zoneId)}`, {
            method: 'DELETE',
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to delete shipping zone' },
            { status: 500 }
        )
    }
}
