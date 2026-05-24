import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const [storeResponse, taxesResponse] = await Promise.all([
            workerFetch(`/stores/${resolved.storeId}`),
            workerFetch(`/shipping-tax/taxes?store_id=${resolved.storeId}`),
        ])
        const storePayload = await readWorkerJson(storeResponse)
        const taxesPayload = await readWorkerJson(taxesResponse)

        return NextResponse.json({
            success: true,
            data: {
                tax_inclusive: Boolean(storePayload.data?.tax_inclusive),
                rates: Array.isArray(taxesPayload.data) ? taxesPayload.data : [],
            },
        })
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to load tax settings' },
            { status: 500 }
        )
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const workerResponse = await workerFetch(`/stores/${resolved.storeId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                tax_inclusive: Boolean(body.tax_inclusive),
            }),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to update tax settings' },
            { status: 500 }
        )
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const workerResponse = await workerFetch('/shipping-tax/taxes', {
            method: 'POST',
            body: JSON.stringify({
                ...body,
                store_id: resolved.storeId,
            }),
        })
        const payload = await readWorkerJson(workerResponse)

        return NextResponse.json(payload)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unable to save tax rate' },
            { status: 500 }
        )
    }
}
