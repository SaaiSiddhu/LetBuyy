import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'
import { ReplaceCollectionMembershipSchema } from '@letbuyy/shared-types'

type Params = { params: Promise<{ store: string; collectionId: string }> }
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const scope = await merchantSecurityScope(request, params, false)
        if (scope.error) return scope.error
        const { collectionId } = await params
        const result = await createMerchantApiClient().products.collections.listProducts(
            decodeURIComponent(collectionId), { storeId: scope.storeId })
        return privateSecurityResponse(NextResponse.json({ data: result }))
    } catch (error) { return privateSecurityResponse(merchantApiErrorResponse(error, 'Unable to load collection products')) }
}
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const scope = await merchantSecurityScope(request, params)
        if (scope.error) return scope.error
        const { collectionId } = await params
        const parsed = ReplaceCollectionMembershipSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return privateSecurityResponse(NextResponse.json({ error: { code: 'VALIDATION', message: 'An explicit product list, current membership version and save key are required.' } }, { status: 400 }))
        if (parsed.data.idempotency_key !== scope.headers!['X-Idempotency-Key']) return privateSecurityResponse(NextResponse.json({ error: { code: 'COLLECTION_MEMBERSHIP_KEY_MISMATCH', message: 'The saved request key changed. Reload this page.' } }, { status: 400 }))
        const result = await createMerchantApiClient().products.collections.replaceProducts(
            decodeURIComponent(collectionId), parsed.data, { storeId: scope.storeId })
        return privateSecurityResponse(NextResponse.json({ data: result }))
    } catch (error) { return privateSecurityResponse(merchantApiErrorResponse(error, 'Unable to update collection products')) }
}
