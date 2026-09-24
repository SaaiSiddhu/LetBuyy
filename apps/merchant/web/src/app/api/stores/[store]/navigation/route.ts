import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const location = request.nextUrl.searchParams.get('location') || 'main'
        const payload = await createMerchantApiClient().pages.navigation.get({
            store_id: resolved.storeId,
            location,
        })
        return NextResponse.json({ success: true, data: payload })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to load navigation')
    }
}
