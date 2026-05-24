import { NextRequest, NextResponse } from 'next/server'
import { readWorkerJson, workerFetch } from '@/lib/api/worker-client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ store: string }> }
) {
    try {
        const { store } = await params
        const resolved = await resolveOwnedStoreId(decodeURIComponent(store))

        if (resolved.error) return resolved.error

        const period = request.nextUrl.searchParams.get('period') || '30d'
        const [dashboardResponse, ordersResponse] = await Promise.all([
            workerFetch(`/analytics/dashboard?store_id=${encodeURIComponent(resolved.storeId)}&period=${encodeURIComponent(period)}`),
            workerFetch(`/analytics/orders?store_id=${encodeURIComponent(resolved.storeId)}`),
        ])

        const dashboardPayload = await readWorkerJson(dashboardResponse)
        const ordersPayload = await readWorkerJson(ordersResponse)
        const summary = dashboardPayload?.data?.summary || {}
        const orderBreakdown = ordersPayload?.data?.breakdown || {}

        return NextResponse.json({
            data: {
                totalOrders: summary.orders?.value || 0,
                totalRevenue: summary.revenue?.value || 0,
                totalProducts: summary.products || 0,
                avgOrderValue: summary.avg_order_value || 0,
                ordersByStatus: orderBreakdown,
                revenueByMonth: [],
            },
        })
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unable to load analytics' },
            { status: 500 }
        )
    }
}
