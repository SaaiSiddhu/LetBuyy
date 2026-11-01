import { notFound } from 'next/navigation'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { createMerchantApiClient } from '@/lib/api/client'
import { formatInrCurrency } from '@letbuyy/ui/formatting'
import DashboardClient from './DashboardClient'
import { buildPageSetupStatus, buildStoreSetupStatus, resolveDashboardDomain } from './dashboard-setup-status'
import type { SetupStatus } from './dashboard-setup-status'
export type { SetupStatus } from './dashboard-setup-status'
import type {
    AnalyticsDashboard,
    AnalyticsOrdersBreakdown,
    Order,
    PaginatedResponse,
    ProductListSummary,
} from '@letbuyy/api-client'

/* ——————————————————————————————————————
   Types
   —————————————————————————————————————— */

type SiteType = 'store' | 'portfolio' | 'resume' | 'landing' | 'blog'

export interface StoreInfo {
    id: string
    name: string
    site_type: SiteType
    theme_id: string
    theme_settings: Record<string, unknown> | null
    custom_domain: string | null
    custom_domain_status: string | null
    subdomain: string
    trial_ends_at: string | null
    trial_status: string | null
    status: string
}

export type DashboardBadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'critical'

export interface DashboardActivity {
    id: string
    kind: 'order' | 'product'
    title: string
    description: string
    timestamp: string | null
    href: string
    icon: string
    badgeLabel: string
    badgeVariant: DashboardBadgeVariant
}

export interface DashboardHomeData {
    totalRevenue: number
    revenueChangePct: number
    totalOrders: number
    ordersChangePct: number
    totalProducts: number
    avgOrderValue: number
    ordersByStatus: Record<string, number>
    recentActivity: DashboardActivity[]
    analyticsAvailable: boolean
}

/* ——————————————————————————————————————
   Server Component — Data Fetching
   —————————————————————————————————————— */

interface DashboardPageProps {
    params: Promise<{ store: string }>
}

export default async function DashboardPage({ params }: DashboardPageProps) {
    const { store } = await params

    // Auth check (layout already does this, but double-check)
    const user = await getSessionUser()
    if (!user) return notFound()

    // Get store info (layout already fetched this, but we need full data)
    const storeData = await getStoreForUser(store, user.id)
    if (!storeData) return notFound()

    // Build StoreInfo for the client
    const storeInfo: StoreInfo = {
        id: storeData.id,
        name: storeData.name,
        site_type: storeData.site_type as SiteType,
        theme_id: storeData.theme_id,
        theme_settings: storeData.theme_settings,
        custom_domain: storeData.custom_domain,
        custom_domain_status: storeData.custom_domain_status,
        subdomain: storeData.subdomain,
        trial_ends_at: storeData.trial_ends_at,
        trial_status: storeData.trial_status,
        status: storeData.status,
    }

    // Compute setup status server-side
    const themeCustomized =
        (storeData.theme_id && storeData.theme_id !== 'modern') ||
        (storeData.theme_settings && JSON.stringify(storeData.theme_settings) !== '{}')
    const domainConfigured = resolveDashboardDomain({
        subdomain: storeData.subdomain,
        customDomain: storeData.custom_domain,
        customDomainStatus: storeData.custom_domain_status,
    }).configured

    const apiClient = createMerchantApiClient()
    // Setup only needs to know whether the all-status catalogue has any rows.
    // Share the bounded recent-products read and start independent sections now.
    const recentProducts = storeData.site_type === 'store'
        ? apiClient.products.listSummary({ store_id: storeData.id, status: 'all', limit: 4, sort: 'created_at', order: 'desc' }).catch(() => null)
        : Promise.resolve(null)
    const [setupStatus, homeData] = await Promise.all([
        loadSetupStatus(apiClient, storeData.id, storeData.site_type, !!themeCustomized, domainConfigured, recentProducts),
        loadDashboardHomeData(apiClient, storeData.id, storeData.site_type === 'store', recentProducts),
    ])

    return (
        <DashboardClient
            store={store}
            storeInfo={storeInfo}
            setupStatus={setupStatus}
            homeData={homeData}
        />
    )
}

async function loadSetupStatus(
    apiClient: ReturnType<typeof createMerchantApiClient>,
    storeId: string,
    siteType: string,
    themeCustomized: boolean,
    domainConfigured: boolean,
    recentProductsRead: Promise<PaginatedResponse<ProductListSummary> | null>,
): Promise<SetupStatus> {
    if (siteType === 'store') {
        const [productsPayload, shippingZonesPayload, paymentConfigPayload] = await Promise.all([
            recentProductsRead,
            apiClient.shipping.zones.list({ store_id: storeId, limit: 1 }).catch(() => null),
            apiClient.stores.paymentConfig.get(storeId).catch(() => null),
        ])

        return buildStoreSetupStatus({
            productsTotal: productsPayload?.total ?? null,
            shippingZones: Array.isArray(shippingZonesPayload) ? shippingZonesPayload : null,
            paymentConfig: paymentConfigPayload,
            themeCustomized,
            domainConfigured,
        })
    }

    const pagesPayload = await apiClient.pages.list({ store_id: storeId, limit: 1 }).catch(() => null)
    return buildPageSetupStatus({
        pagesTotal: pagesPayload?.total ?? null,
        themeCustomized,
        domainConfigured,
    })
}

async function loadDashboardHomeData(
    apiClient: ReturnType<typeof createMerchantApiClient>,
    storeId: string,
    isStore: boolean,
    recentProductsRead: Promise<PaginatedResponse<ProductListSummary> | null>,
): Promise<DashboardHomeData> {
    if (!isStore) {
        return emptyDashboardHomeData()
    }

    try {
        const [analyticsPayload, ordersBreakdown, recentOrdersPayload, recentProductsPayload] = await Promise.all([
            apiClient.analytics.dashboard({ store_id: storeId, period: '30d' }).catch(() => null as AnalyticsDashboard | null),
            apiClient.analytics.orders({ store_id: storeId }).catch(() => null as AnalyticsOrdersBreakdown | null),
            apiClient.orders.list({
                store_id: storeId,
                status: 'all',
                payment_status: 'all',
                limit: 4,
                sort: 'created_at',
                order: 'desc',
            }).catch(() => null),
            recentProductsRead,
        ])

        const summary = analyticsPayload?.summary
        const recentOrders = Array.isArray(recentOrdersPayload?.data) ? recentOrdersPayload.data : []
        const recentProducts = Array.isArray(recentProductsPayload?.data) ? recentProductsPayload.data : []
        const recentActivity = [
            ...recentOrders.map((order) => orderActivity(order)),
            ...recentProducts.map((product) => productActivity(product)),
        ]
            .filter((item): item is DashboardActivity => item !== null)
            .sort((first, second) => timestampValue(second.timestamp) - timestampValue(first.timestamp))
            .slice(0, 5)

        const completeSummary = summary
            && Number.isFinite(summary.revenue?.value)
            && Number.isFinite(summary.revenue?.change_pct)
            && Number.isFinite(summary.orders?.value)
            && Number.isFinite(summary.orders?.change_pct)
            && Number.isFinite(summary.avg_order_value)
            && Number.isFinite(summary.products)

        return {
            totalRevenue: completeSummary ? summary.revenue.value : 0,
            revenueChangePct: completeSummary ? summary.revenue.change_pct : 0,
            totalOrders: completeSummary ? summary.orders.value : 0,
            ordersChangePct: completeSummary ? summary.orders.change_pct : 0,
            totalProducts: completeSummary ? summary.products : 0,
            avgOrderValue: completeSummary ? summary.avg_order_value : 0,
            ordersByStatus: ordersBreakdown?.breakdown || {},
            recentActivity,
            analyticsAvailable: Boolean(completeSummary),
        }
    } catch {
        return emptyDashboardHomeData()
    }
}

function emptyDashboardHomeData(): DashboardHomeData {
    return {
        totalRevenue: 0,
        revenueChangePct: 0,
        totalOrders: 0,
        ordersChangePct: 0,
        totalProducts: 0,
        avgOrderValue: 0,
        ordersByStatus: {},
        recentActivity: [],
        analyticsAvailable: false,
    }
}

function orderActivity(order: Order): DashboardActivity | null {
    if (!order.id || !order.order_number || !order.status || !Number.isFinite(order.total)) return null
    const customer = order.customer_name || order.customer_email || order.customer_phone || 'Customer'
    const amount = formatInrCurrency(order.total, { maximumFractionDigits: 0 })
    const orderId = order.id
    const orderNumber = order.order_number

    return {
        id: `order-${orderId}`,
        kind: 'order',
        title: `Order ${orderNumber}`,
        description: `${customer} placed a ${amount} order.`,
        timestamp: order.created_at || null,
        href: 'orders',
        icon: 'receipt_long',
        badgeLabel: titleize(order.status),
        badgeVariant: statusVariant(order.status),
    }
}

function productActivity(product: ProductListSummary): DashboardActivity | null {
    if (!product.id || !product.name || !product.status) return null
    const status = product.status
    const productId = product.id

    return {
        id: `product-${productId}`,
        kind: 'product',
        title: product.name || 'Product added',
        description: `${product.vendor || product.product_type || product.category || 'Catalog'} item updated in products.`,
        timestamp: product.created_at || null,
        href: `products/${productId}`,
        icon: 'product',
        badgeLabel: titleize(status),
        badgeVariant: status === 'active' ? 'success' : status === 'archived' ? 'critical' : 'warning',
    }
}

function statusVariant(status: string): DashboardBadgeVariant {
    const normalized = status.toLowerCase()
    if (['delivered', 'paid', 'published', 'active'].includes(normalized)) return 'success'
    if (['cancelled', 'refunded', 'failed', 'archived', 'suspended'].includes(normalized)) return 'critical'
    if (['shipped', 'processing', 'confirmed'].includes(normalized)) return 'info'
    return 'warning'
}

function timestampValue(value: string | null) {
    if (!value) return 0
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function titleize(value: string) {
    return value
        .replace(/[_-]+/g, ' ')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ')
}
