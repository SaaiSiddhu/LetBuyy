import { NextRequest, NextResponse } from 'next/server'
import { createWorkerApiClient, workerErrorResponse } from '@/lib/api/worker-client'
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
        const apiClient = createWorkerApiClient()
        const [dashboardPayload, ordersPayload] = await Promise.all([
            apiClient.analytics.dashboard({ store_id: resolved.storeId, period }),
            apiClient.analytics.orders({ store_id: resolved.storeId }),
        ])

        const summary = dashboardPayload.summary
        const orderBreakdown = ordersPayload.breakdown

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
        return workerErrorResponse(err, 'Unable to load analytics')
    }
}
