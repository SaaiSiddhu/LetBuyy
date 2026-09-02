import { NextRequest, NextResponse } from 'next/server'
import type { CreateStorefrontLocaleInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// POST /api/stores/:store/localization/locales → POST /v1/stores/:id/localization/locales
// Body: { locale, name, status?, is_default? }
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = (await request.json().catch(() => ({}))) as CreateStorefrontLocaleInput
        const data = await createMerchantApiClient().stores.localization.createLocale(resolved.storeId, body)
        return NextResponse.json({ data }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to add language')
    }
}
