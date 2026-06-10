import { NextRequest, NextResponse } from 'next/server'
import type { CreateShippingZoneInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const apiClient = createMerchantApiClient()
        const [zones, rates, carrier] = await Promise.all([
            apiClient.shipping.zones.list({ store_id: resolved.storeId }),
            apiClient.shipping.rates.list({ store_id: resolved.storeId }),
            apiClient.shippingLabels.providerMode({ store_id: resolved.storeId }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                zones,
                rates,
                provider_mode: carrier.provider_mode,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load shipping zones')
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
        const payload = await createMerchantApiClient().shipping.zones.create({
            ...body,
            store_id: resolved.storeId,
        } as CreateShippingZoneInput)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to save shipping zone')
    }
}
