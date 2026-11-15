import { NextRequest, NextResponse } from 'next/server'
import { SmartCollectionListQuerySchema } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'
import { collectionMetadataMutation } from '@/lib/products/collection-metadata-proxy'
type Params = { params: Promise<{ store: string }> }
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const scope = await merchantSecurityScope(request, params, false)
        if (scope.error) return scope.error
        const query = SmartCollectionListQuerySchema.safeParse({ ...Object.fromEntries(request.nextUrl.searchParams), store_id: scope.storeId })
        if (!query.success) return privateSecurityResponse(NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Choose a valid collection page.' } }, { status: 400 }))
        return privateSecurityResponse(NextResponse.json(await createMerchantApiClient(scope.storeId).smartCollections.list(query.data)))
    } catch (error) { return privateSecurityResponse(merchantApiErrorResponse(error, 'The collection list could not be confirmed.')) }
}
export const POST = (request: NextRequest, { params }: Params) => collectionMetadataMutation(request, params, 'smart', 'create', null)
