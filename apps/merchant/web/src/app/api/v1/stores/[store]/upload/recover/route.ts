import { NextRequest, NextResponse } from 'next/server'
import { PublicUploadRecoveryInputSchema } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

/** Versioned browser boundary (CODE-R8), over the existing Gateway receipt. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
    try {
        const scope = await merchantSecurityScope(request, params)
        if (scope.error) return scope.error
        const input = PublicUploadRecoveryInputSchema.safeParse(await request.json())
        if (!input.success || input.data.store_id !== scope.storeId || input.data.folder !== `${scope.storeId}/products`
            || input.data.idempotency_key !== scope.headers['X-Idempotency-Key']) {
            return privateSecurityResponse(NextResponse.json({ error: 'The original upload context is required.' }, { status: 400 }))
        }
        const data = await createMerchantApiClient(scope.storeId).upload.recover(input.data, { headers: scope.headers, idempotencyKey: scope.headers['X-Idempotency-Key'] })
        return privateSecurityResponse(NextResponse.json({ data }))
    } catch (error) { return privateSecurityResponse(merchantApiErrorResponse(error, 'Upload remains unconfirmed. Keep the original request.')) }
}
