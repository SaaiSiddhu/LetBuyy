import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { z } from 'zod'

const LogQuerySchema = z.object({
    channel: z.enum(['email', 'in_app', 'sms', 'push', 'whatsapp']).optional(),
    status: z.enum(['queued', 'sent', 'failed', 'suppressed']).optional(),
    page: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().safe().max(10_000)),
    limit: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().safe().max(100)),
})

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
        const parsed = LogQuerySchema.safeParse({
            channel: sp.get('channel') || undefined,
            status: sp.get('status') || undefined,
            page: sp.get('page') ?? '1',
            limit: sp.get('limit') ?? '25',
        })
        if (!parsed.success) {
            return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid delivery log filters' } }, { status: 400 })
        }

        const payload = await createMerchantApiClient().notifications.deliveryLogs({
            site_id: resolved.storeId,
            ...parsed.data,
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
        }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load delivery logs')
    }
}
