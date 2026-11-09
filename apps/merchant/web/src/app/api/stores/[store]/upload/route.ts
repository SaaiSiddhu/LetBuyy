import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

/** Bytes and registration have separate durable receipts. Never swallow a
 * registration failure or reallocate the upload to recover its acknowledgement. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
    try {
        const scope = await merchantSecurityScope(request, params)
        if (scope.error) return scope.error
        const form = await request.formData(), file = form.get('file')
        if (!file || typeof file === 'string') return privateSecurityResponse(NextResponse.json({ error: 'File is required' }, { status: 400 }))
        form.set('folder', `${scope.storeId}/products`)
        form.set('store_id', scope.storeId)
        // The original recoverable fingerprint carries tenant context in the
        // form/header. A redundant URL query creates a different saved request.
        const data = await createMerchantApiClient(scope.storeId).upload.file(form, { headers: scope.headers, idempotencyKey: scope.headers['X-Idempotency-Key'] })
        return privateSecurityResponse(NextResponse.json({ data }, { status: 201 }))
    } catch (error) { return privateSecurityResponse(merchantApiErrorResponse(error, 'Unable to confirm upload')) }
}
