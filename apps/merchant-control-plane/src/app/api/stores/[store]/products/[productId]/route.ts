import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

type RouteParams = {
    params: Promise<{
        store: string
        productId: string
    }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
        const { store, productId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const product = await createMerchantApiClient().products.get(productId)

        if (!product || product.store_id !== resolved.storeId) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        return NextResponse.json({ data: product })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load product')
    }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { store, productId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const product = await createMerchantApiClient().products.update(productId, body)

        return NextResponse.json({ data: product })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update product')
    }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    try {
        const { store, productId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().products.remove(productId)

        return NextResponse.json({ data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to delete product')
    }
}
