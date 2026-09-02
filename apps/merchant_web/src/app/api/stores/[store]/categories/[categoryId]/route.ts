import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; categoryId: string }> }
) {
    try {
        const { store, categoryId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const category = await createMerchantApiClient().categories.update(categoryId, body)

        return NextResponse.json({ data: category })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to update category')
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; categoryId: string }> }
) {
    try {
        const { store, categoryId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().categories.remove(categoryId)

        return NextResponse.json({ data: payload })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to delete category')
    }
}
