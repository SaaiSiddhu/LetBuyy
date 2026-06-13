import { NextRequest, NextResponse } from 'next/server'
import type { CreateShippingRateInput } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const payload = await createMerchantApiClient().shipping.rates.create(
            body as CreateShippingRateInput
        )

        return NextResponse.json({ success: true, data: payload }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to create shipping rate')
    }
}
