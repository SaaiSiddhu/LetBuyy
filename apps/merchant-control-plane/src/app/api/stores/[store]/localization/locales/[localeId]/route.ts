import { NextRequest, NextResponse } from 'next/server'
import type { UpdateStorefrontLocaleInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// PATCH /api/stores/:store/localization/locales/:localeId
//   → PATCH /v1/stores/:id/localization/locales/:localeId
// Body: { name?, status?, is_default? }
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; localeId: string }> }
) {
    try {
        const { store, localeId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = (await request.json().catch(() => ({}))) as UpdateStorefrontLocaleInput
        const data = await createMerchantApiClient().stores.localization.updateLocale(resolved.storeId, localeId, body)
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update language')
    }
}

// DELETE /api/stores/:store/localization/locales/:localeId
//   → DELETE /v1/stores/:id/localization/locales/:localeId
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; localeId: string }> }
) {
    try {
        const { store, localeId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const data = await createMerchantApiClient().stores.localization.deleteLocale(resolved.storeId, localeId)
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to remove language')
    }
}
