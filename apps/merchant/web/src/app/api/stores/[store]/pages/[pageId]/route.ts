import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; pageId: string }> }
) {
    try {
        const { store, pageId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const body = await request.json()
        const payload = await createMerchantApiClient().pages.update(pageId, body)

        return NextResponse.json({ success: true, data: payload })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to update page')
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; pageId: string }> }
) {
    try {
        const { store, pageId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().pages.remove(pageId)

        return NextResponse.json({ success: true, data: payload })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to delete page')
    }
}
