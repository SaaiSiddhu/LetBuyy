import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = { params: Promise<{ store: string; email: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { store, email } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const decodedEmail = decodeURIComponent(email)
        const customer = await createMerchantApiClient().customers.getByEmail(
            decodedEmail,
            { query: { store_id: resolved.storeId } },
        )
        return NextResponse.json({ data: customer })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load customer')
    }
}
