import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; rateId: string }> }
) {
    try {
        const { store, rateId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().shipping.rates.remove(rateId)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to delete shipping rate')
    }
}
