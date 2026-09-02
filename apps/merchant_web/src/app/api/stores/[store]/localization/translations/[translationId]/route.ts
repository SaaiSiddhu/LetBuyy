import { NextRequest, NextResponse } from 'next/server'
import type { UpdateStorefrontTranslationInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// PATCH /api/stores/:store/localization/translations/:translationId
//   → PATCH /v1/stores/:id/localization/translations/:translationId
// Body: { translated_text?, source_text?, status?, metadata? }
//
// RISK-DUAL-N01: writes to storefront_translations (instance data) only.
// Never writes to section_definitions, LiquidThemeSectionSchema, or any bundle schema.
// Tenancy: resolveOwnedStoreId verifies the merchant session owns the store before any write.
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; translationId: string }> }
) {
    try {
        const { store, translationId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = (await request.json().catch(() => ({}))) as UpdateStorefrontTranslationInput
        const data = await createMerchantApiClient().stores.localization.updateTranslation(
            resolved.storeId,
            translationId,
            body,
        )
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update translation')
    }
}

// DELETE /api/stores/:store/localization/translations/:translationId
//   → DELETE /v1/stores/:id/localization/translations/:translationId
//
// RISK-DUAL-N01: soft-deletes a storefront_translations row only.
// Never touches section_definitions.
// Tenancy: resolveOwnedStoreId verifies the merchant session owns the store before deletion.
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; translationId: string }> }
) {
    try {
        const { store, translationId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const data = await createMerchantApiClient().stores.localization.deleteTranslation(
            resolved.storeId,
            translationId,
        )
        return NextResponse.json({ data })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to delete translation')
    }
}
