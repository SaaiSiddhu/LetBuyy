import { NextRequest, NextResponse } from 'next/server'
import { MediaMetadataUpdateSchema, UuidSchema } from '@letbuyy/shared-types'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'
type Context = { params: Promise<{ store: string; mediaId: string }> }
async function mutate(request: NextRequest, context: Context, removing: boolean) {
    try {
        const scope = await merchantSecurityScope(request, context.params)
        if (scope.error) return scope.error
        const id = UuidSchema.safeParse((await context.params).mediaId)
        if (!id.success) return privateSecurityResponse(NextResponse.json({ error: 'Invalid Media identity.' }, { status: 400 }))
        const client = createMerchantApiClient(scope.storeId)
        if (removing) return privateSecurityResponse(NextResponse.json({ data: await client.media.remove(id.data, { headers: scope.headers, idempotencyKey: scope.headers['X-Idempotency-Key'] }) }))
        const input = MediaMetadataUpdateSchema.safeParse(await request.json())
        if (!input.success) return privateSecurityResponse(NextResponse.json({ error: 'Invalid media metadata.' }, { status: 400 }))
        return privateSecurityResponse(NextResponse.json({ data: await client.media.update(id.data, input.data, { headers: scope.headers, idempotencyKey: scope.headers['X-Idempotency-Key'] }) }))
    } catch (error) { return privateSecurityResponse(merchantApiErrorResponse(error, 'Media change remains unconfirmed.')) }
}
export const PATCH = (request: NextRequest, context: Context) => mutate(request, context, false)
export const DELETE = (request: NextRequest, context: Context) => mutate(request, context, true)
