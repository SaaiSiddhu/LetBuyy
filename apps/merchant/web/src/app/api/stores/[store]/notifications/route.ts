import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { z } from 'zod'

type RouteContext = { params: Promise<{ store: string }> }

const InboxQuerySchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().safe().min(1).max(10_000)),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().safe().min(1).max(50)),
})

async function authorizedStore(context: RouteContext) {
    const { store } = await context.params
    return resolveOwnedStoreId(decodeURIComponent(store))
}

/** The inbox belongs to the signed-in user across their stores, not to an order-age heuristic. */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const resolved = await authorizedStore(context)
        if (resolved.error) return resolved.error

        const query = InboxQuerySchema.safeParse({
            page: request.nextUrl.searchParams.get('page') ?? '1',
            limit: request.nextUrl.searchParams.get('limit') ?? '5',
        })
        if (!query.success) {
            return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid inbox page' } }, { status: 400 })
        }

        const api = createMerchantApiClient()
        const [inbox, unread] = await Promise.all([
            api.notifications.list(query.data),
            api.notifications.unreadCount().catch(() => null),
        ])
        return NextResponse.json({ data: inbox.data, meta: {
            page: inbox.page,
            limit: inbox.limit,
            total: inbox.total,
            has_more: inbox.has_more,
            unread_count: unread?.count ?? null,
        } }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load notifications')
    }
}

/** Read state is persisted by the canonical user-scoped notification API. */
export async function POST(_request: NextRequest, context: RouteContext) {
    try {
        const resolved = await authorizedStore(context)
        if (resolved.error) return resolved.error
        const result = await createMerchantApiClient().notifications.markAllRead()
        return NextResponse.json({ data: result }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to mark notifications as read')
    }
}
