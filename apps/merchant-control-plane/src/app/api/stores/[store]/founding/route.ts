import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// Proxy: merchant's own Founding Merchant status (gateway is the DB owner; this app
// never reads the DB directly — route-ownership lockstep).
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const apiClient = createMerchantApiClient()
        const founding = await apiClient.foundingProgram.me({ store_id: resolved.storeId })

        return NextResponse.json({ data: founding })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load founding status')
    }
}
