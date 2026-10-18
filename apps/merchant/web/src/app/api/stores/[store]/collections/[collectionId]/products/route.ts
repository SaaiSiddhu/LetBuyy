import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; collectionId: string }> }
) {
    try {
        const { store, collectionId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const result = await createMerchantApiClient().products.collections.listProducts(
            decodeURIComponent(collectionId),
        )

        return NextResponse.json({ data: result })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load collection products')
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; collectionId: string }> }
) {
    try {
        const { store, collectionId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const result = await createMerchantApiClient().products.collections.replaceProducts(
            decodeURIComponent(collectionId),
            { product_ids: body.product_ids ?? [] },
        )

        return NextResponse.json({ data: result })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update collection products')
    }
}
