import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// GET — gift card audit trail (ledger + order-linked redemptions).
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; id: string }> }
) {
    try {
        const { store, id } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const transactions = await createMerchantApiClient().products.giftCards.transactions(
            decodeURIComponent(id),
            { store_id: resolved.storeId },
        )

        return NextResponse.json({ data: transactions })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load gift card transactions')
    }
}

// PATCH — fraud control (hold / disable / reactivate a gift card).
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; id: string }> }
) {
    try {
        const { store, id } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const giftCard = await createMerchantApiClient().products.giftCards.setStatus(
            decodeURIComponent(id),
            { status: body.status, reason: body.reason ?? null, store_id: resolved.storeId },
        )

        return NextResponse.json({ data: giftCard })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update gift card')
    }
}
