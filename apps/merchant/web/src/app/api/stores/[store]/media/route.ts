import { NextRequest, NextResponse } from 'next/server'
import type { MediaListQuery } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const searchParams = request.nextUrl.searchParams
        const page = searchParams.get('page') || '1'
        const limit = searchParams.get('limit') || '100'
        const folder = searchParams.get('folder')
        const type = searchParams.get('type')
        const query: MediaListQuery = {
            store_id: resolved.storeId,
            page: Number(page),
            limit: Number(limit),
        }

        if (folder) query.folder = folder
        if (type === 'image' || type === 'video' || type === 'audio' || type === 'document' || type === 'other' || type === 'all') {
            query.type = type
        }

        const payload = await createMerchantApiClient().media.list(query)

        return NextResponse.json({
            data: payload.data,
            meta: {
                total: payload.total,
                page: payload.page,
                per_page: payload.limit,
                has_next: payload.has_more,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load media')
    }
}
