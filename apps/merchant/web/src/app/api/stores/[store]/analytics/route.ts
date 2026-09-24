import { NextRequest, NextResponse } from 'next/server'
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

        const period = request.nextUrl.searchParams.get('period') || '30d'
        const apiClient = createMerchantApiClient()
        const [dashboardPayload, ordersPayload, revenuePayload] = await Promise.all([
            apiClient.analytics.dashboard({ store_id: resolved.storeId, period }),
            apiClient.analytics.orders({ store_id: resolved.storeId }),
            apiClient.analytics.revenue({ store_id: resolved.storeId, period }),
        ])

        const summary = dashboardPayload.summary
        const orderBreakdown = ordersPayload.breakdown

        // Phase-4.5 — populate the monthly revenue chart from real data instead of a hardcoded [].
        // The gateway returns a daily revenue series (analytics_rollups_daily); aggregate it into
        // monthly buckets. Stays empty (and the page shows its honest empty state) until rollups exist.
        const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthlyRevenue = new Map<string, number>()
        for (const point of revenuePayload.chart ?? []) {
            const key = point.date.slice(0, 7) // YYYY-MM
            monthlyRevenue.set(key, (monthlyRevenue.get(key) ?? 0) + point.revenue)
        }
        const revenueByMonth = Array.from(monthlyRevenue.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, revenue]) => {
                const [year, month] = key.split('-')
                const label = `${MONTH_LABELS[Number(month) - 1] ?? month} ${year}`
                return { month: label, revenue: Math.round(revenue) }
            })

        return NextResponse.json({
            data: {
                totalOrders: summary.orders?.value || 0,
                totalRevenue: summary.revenue?.value || 0,
                totalProducts: summary.products || 0,
                avgOrderValue: summary.avg_order_value || 0,
                ordersByStatus: orderBreakdown,
                revenueByMonth,
            },
        })
    } catch (err) {
        return merchantApiErrorResponse(err, 'Unable to load analytics')
    }
}
