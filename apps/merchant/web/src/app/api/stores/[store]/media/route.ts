import { NextRequest, NextResponse } from 'next/server'
import type { MediaListQuery } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { MediaRegistrationInputSchema } from '@letbuyy/shared-types'
import { merchantSecurityScope, privateSecurityResponse } from '@/lib/api/merchant-security-scope'

export async function POST(request: NextRequest, { params }: { params: Promise<{ store: string }> }) {
    try {
        const scope = await merchantSecurityScope(request, params)
        if (scope.error) return scope.error
        const input = MediaRegistrationInputSchema.safeParse(await request.json())
        if (!input.success || input.data.store_id !== scope.storeId) return privateSecurityResponse(NextResponse.json({ error: 'Valid store-bound media is required.' }, { status: 400 }))
        const data = await createMerchantApiClient(scope.storeId).media.create(input.data, { headers: scope.headers, idempotencyKey: scope.headers['X-Idempotency-Key'] })
        return privateSecurityResponse(NextResponse.json({ data }, { status: 201 }))
    } catch (error) { return privateSecurityResponse(merchantApiErrorResponse(error, 'Unable to confirm Media registration')) }
}


export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const scope = await merchantSecurityScope(request, params, false)
        if (scope.error) return scope.error

        const searchParams = request.nextUrl.searchParams
        const page = searchParams.get('page') || '1'
        const limit = searchParams.get('limit') || '100'
        const folder = searchParams.get('folder')
        const type = searchParams.get('type')
        const query: MediaListQuery = {
            store_id: scope.storeId,
            page: Number(page),
            limit: Number(limit),
        }

        const search = searchParams.get('search')
        const cursor = searchParams.get('cursor')
        if (search) query.search = search.slice(0, 200)
        if (cursor) query.cursor = cursor.slice(0, 200)
        if (folder) query.folder = folder
        if (type === 'image' || type === 'video' || type === 'audio' || type === 'document' || type === 'other' || type === 'all') {
            query.type = type
        }

        const payload = await createMerchantApiClient().media.list(query)

        return privateSecurityResponse(NextResponse.json({
            data: payload.data,
            meta: {
                total: payload.total,
                page: payload.page,
                per_page: payload.limit,
                has_next: payload.has_more,
            },
        }))
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load media')
    }
}
