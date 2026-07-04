import { NextRequest, NextResponse } from 'next/server'
import type { UpdateStoreLocalizationInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// GET /api/stores/:store/localization → GET /v1/stores/:id/localization
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const data = await createMerchantApiClient().stores.localization.get(resolved.storeId)
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load localization settings')
    }
}

// PATCH /api/stores/:store/localization → PATCH /v1/stores/:id/localization
// Body: { default_locale?, currency?, timezone? }
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = (await request.json().catch(() => ({}))) as UpdateStoreLocalizationInput
        const data = await createMerchantApiClient().stores.localization.update(resolved.storeId, body)
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update localization settings')
    }
}
