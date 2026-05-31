import { NextRequest, NextResponse } from 'next/server'
import type { CreateShippingZoneInput } from '@letbuyy/api-client'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const apiClient = createWorkerApiClient()
        const [zones, rates] = await Promise.all([
            apiClient.shipping.zones.list({ store_id: resolved.storeId }),
            apiClient.shipping.rates.list({ store_id: resolved.storeId }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                zones,
                rates,
            },
        })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to load shipping zones')
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
        const payload = await createWorkerApiClient().shipping.zones.create({
            ...body,
            store_id: resolved.storeId,
        } as CreateShippingZoneInput)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return workerErrorResponse(err, 'Unable to save shipping zone')
    }
}
