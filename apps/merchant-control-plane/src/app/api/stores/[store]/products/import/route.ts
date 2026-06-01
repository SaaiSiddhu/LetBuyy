import { NextRequest, NextResponse } from 'next/server'
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
        const payload = await createMerchantApiClient().products.importCsv({
            store_id: resolved.storeId,
            csv: body.csv,
        })

        return NextResponse.json({ data: payload }, { status: 201 })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to import products')
    }
}
