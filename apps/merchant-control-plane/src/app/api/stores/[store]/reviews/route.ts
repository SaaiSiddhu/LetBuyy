import { NextRequest, NextResponse } from 'next/server'
import type { ProductReviewListQuery } from '@letbuyy/api-client'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

function normalizeReviewStatus(value: string | null): ProductReviewListQuery['status'] {
    return value === 'pending' || value === 'approved' || value === 'rejected' ? value : 'all'
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const searchParams = request.nextUrl.searchParams
        const page = Number(searchParams.get('page') || '1')
        const limit = Number(searchParams.get('limit') || '100')
        const payload = await createMerchantApiClient().reviews.list({
            store_id: resolved.storeId,
            page,
            limit,
            status: normalizeReviewStatus(searchParams.get('status')),
        })

        return NextResponse.json({
            success: true,
            data: payload.data,
            meta: {
                page: payload.page,
                per_page: payload.limit,
                total: payload.total,
                total_pages: Math.ceil(payload.total / Math.max(payload.limit, 1)),
                has_next: payload.has_more,
                has_prev: payload.page > 1,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load reviews')
    }
}
