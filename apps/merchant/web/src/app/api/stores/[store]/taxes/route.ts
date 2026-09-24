import { NextRequest, NextResponse } from 'next/server'
import type { CreateTaxRateInput } from '@letbuyy/api-client'
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
        const [storePayload, rates] = await Promise.all([
            apiClient.stores.get(resolved.storeId),
            apiClient.taxes.list({ store_id: resolved.storeId }),
        ])

        return NextResponse.json({
            success: true,
            data: {
                tax_inclusive: Boolean(storePayload.tax_inclusive),
                rates,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load tax settings')
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
        const payload = await createMerchantApiClient().stores.update(resolved.storeId, {
            tax_inclusive: Boolean(body.tax_inclusive),
        })

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update tax settings')
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
        const payload = await createMerchantApiClient().taxes.create({
            ...body,
            store_id: resolved.storeId,
        } as CreateTaxRateInput)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to save tax rate')
    }
}
