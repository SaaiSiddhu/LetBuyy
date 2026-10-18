import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

type RouteParams = {
    params: Promise<{
        store: string
        productId: string
    }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const scope = await merchantSecurityScope(request, params, false)
        if (scope.error) return scope.error
        const { productId } = await params

        const product = await createMerchantApiClient().products.get(productId, { storeId: scope.storeId })

        if (!product || product.store_id !== scope.storeId) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        return NextResponse.json({ data: product }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load product')
    }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const scope = await merchantSecurityScope(request, params)
        if (scope.error) return scope.error
        const { productId } = await params

        const body = await request.json()
        if (body?.idempotency_key !== scope.headers!['X-Idempotency-Key']) {
            return privateSecurityResponse(NextResponse.json({ error: { code: 'PRODUCT_EDIT_KEY_MISMATCH', message: 'The saved request key changed. Reload this page.' } }, { status: 400 }))
        }
        const product = await createMerchantApiClient().products.update(productId, body, { storeId: scope.storeId })

        return NextResponse.json({ data: product }, { headers: { 'Cache-Control': 'no-store' } })
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
