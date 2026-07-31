import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string; id: string }> }

// GET /api/stores/[store]/marketing/campaigns/[id] — get campaign + recipients
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { store, id } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().marketing.emailCampaigns.get(
            id,
            { store_id: resolved.storeId },
        )
        return NextResponse.json({ data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load campaign')
    }
}
