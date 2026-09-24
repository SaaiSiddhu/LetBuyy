import { NextRequest, NextResponse } from 'next/server'
import type { CreateStorefrontTranslationInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// POST /api/stores/:store/localization/translations
//   → POST /v1/stores/:id/localization/translations
// Body: { locale, resource_type, resource_id, field, translated_text, source_text?, status? }
//
// RISK-DUAL-N01: writes to storefront_translations (instance data) only.
// Never writes to section_definitions, LiquidThemeSectionSchema, or any bundle schema.
// Tenancy: resolveOwnedStoreId verifies the merchant session owns the store before any write.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = (await request.json().catch(() => ({}))) as CreateStorefrontTranslationInput
        const data = await createMerchantApiClient().stores.localization.createTranslation(resolved.storeId, body)
        return NextResponse.json({ data }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to save translation')
    }
}
