import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// Phase-4 fix — the collection edit/delete proxy was missing, so the merchant UI could not rename or
// delete a collection (the browser must hit a same-origin /api/* proxy; the gateway PATCH/DELETE +
// api-client update/remove already existed). Mirrors the products/[productId] proxy: ownership-checked
// via resolveOwnedStoreId, then delegated to the gateway through the merchant api-client.
type RouteParams = {
    params: Promise<{
        store: string
        collectionId: string
    }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { store, collectionId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const collection = await createMerchantApiClient().products.collections.update(
            decodeURIComponent(collectionId),
            body,
        )

        return NextResponse.json({ data: collection })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update collection')
    }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    try {
        const { store, collectionId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().products.collections.remove(
            decodeURIComponent(collectionId),
        )

        return NextResponse.json({ data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to delete collection')
    }
}
