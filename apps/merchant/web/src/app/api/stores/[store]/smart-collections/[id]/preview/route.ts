import { NextRequest, NextResponse } from 'next/server'
import { UuidSchema } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'
type Params = { params: Promise<{ store: string; id: string }> }
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const scope = await merchantSecurityScope(request, params, false)
        if (scope.error) return scope.error
        const id = UuidSchema.safeParse((await params).id)
        if (!id.success) return privateSecurityResponse(NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Choose a valid collection.' } }, { status: 400 }))
        return privateSecurityResponse(NextResponse.json({ data: await createMerchantApiClient(scope.storeId).smartCollections.preview(id.data, { store_id: scope.storeId }) }))
    } catch (error) { return privateSecurityResponse(merchantApiErrorResponse(error, 'The saved rule preview could not be confirmed.')) }
}
