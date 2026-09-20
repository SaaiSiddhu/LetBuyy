import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// Phase-4.5 — rate editing (update price/name/type). The gateway PATCH /shipping-tax/shipping/:id +
// api-client shipping.rates.update already existed; only this proxy verb was missing, so merchants
// could add/delete but not edit a rate. Mirrors the DELETE below + the zones/[zoneId] PATCH proxy.
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; rateId: string }> }
) {
    try {
        const { store, rateId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const rate = await createMerchantApiClient().shipping.rates.update(rateId, resolved.storeId, body)

        return NextResponse.json({ success: true, data: rate })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update shipping rate')
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; rateId: string }> }
) {
    try {
        const { store, rateId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().shipping.rates.remove(rateId, resolved.storeId)

        return NextResponse.json({ success: true, data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to delete shipping rate')
    }
}
