import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ store: string; policyId: string }> }
) {
    try {
        const { store, policyId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const body = await request.json()
        const payload = await createMerchantApiClient().pages.policies.update(policyId, body)
        return NextResponse.json({ success: true, data: payload })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to update policy')
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ store: string; policyId: string }> }
) {
    try {
        const { store, policyId } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const payload = await createMerchantApiClient().pages.policies.remove(policyId)
        return NextResponse.json({ success: true, data: payload })
    } catch (error) {
        return merchantApiErrorResponse(error, 'Unable to delete policy')
    }
}
