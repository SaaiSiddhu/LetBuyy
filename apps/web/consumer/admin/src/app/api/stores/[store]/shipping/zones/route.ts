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

        const [zonesResponse, ratesResponse] = await Promise.all([
            workerFetch(`/shipping-tax/shipping/zones?store_id=${resolved.storeId}`),
            workerFetch(`/shipping-tax/shipping?store_id=${resolved.storeId}`),
        ])
        const zonesPayload = await readWorkerJson(zonesResponse)
        const ratesPayload = await readWorkerJson(ratesResponse)

        return NextResponse.json({
            success: true,
            data: {
                zones: Array.isArray(zonesPayload.data) ? zonesPayload.data : [],
                rates: Array.isArray(ratesPayload.data) ? ratesPayload.data : [],
            },
        })
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unable to load shipping zones' },
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
        const workerResponse = await workerFetch('/shipping-tax/shipping/zones', {
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
            { error: err instanceof Error ? err.message : 'Unable to save shipping zone' },
            { status: 500 }
        )
    }
}
