import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

// GET /api/stores/[store]/notifications/delivery-logs
// Returns paginated notification_logs rows for the store.
// Query params: channel?, status?, page?, limit?
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))
        if (resolved.error) return resolved.error

        const sp = request.nextUrl.searchParams
        const channel = sp.get('channel') || undefined
        const status = sp.get('status') || undefined
        const page = Math.max(parseInt(sp.get('page') || '1'), 1)
        const limit = Math.min(Math.max(parseInt(sp.get('limit') || '25'), 1), 100)

        const payload = await createMerchantApiClient().notifications.deliveryLogs({
            site_id: resolved.storeId,
            channel,
            status,
            page,
            limit,
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
        return merchantApiErrorResponse(err, 'Unable to load delivery logs')
    }
}
