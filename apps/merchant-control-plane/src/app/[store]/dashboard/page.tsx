import { notFound } from 'next/navigation'
import { getSessionUser, getStoreForUser } from '@/lib/auth/session'
import { createMerchantApiClient } from '@/lib/api/client'
import DashboardClient from './DashboardClient'
import type {
    AnalyticsDashboard,
    AnalyticsOrdersBreakdown,
    Order,
    Product,
} from '@letbuyy/api-client'

/* ——————————————————————————————————————
   Types
   —————————————————————————————————————— */

type SiteType = 'store' | 'portfolio' | 'resume' | 'landing' | 'blog'

export interface SetupStatus {
    primaryComplete: boolean
    secondaryComplete: boolean
    themeCustomized: boolean
    domainConfigured: boolean
    paymentConfigured?: boolean
    hasShipping?: boolean
}

export interface StoreInfo {
    id: string
    name: string
    site_type: SiteType
    theme_id: string
    theme_settings: Record<string, unknown> | null
    custom_domain: string | null
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
        subdomain: storeData.subdomain,
        trial_ends_at: storeData.trial_ends_at,
        trial_status: storeData.trial_status,
        status: storeData.status,
    }

    // Compute setup status server-side
    const themeCustomized =
        (storeData.theme_id && storeData.theme_id !== 'modern') ||
        (storeData.theme_settings && JSON.stringify(storeData.theme_settings) !== '{}')
    const domainConfigured = !!storeData.custom_domain

    const apiClient = createMerchantApiClient()
    let setupStatus: SetupStatus

    if (storeData.site_type === 'store') {
        const [productsPayload, shippingZones] = await Promise.all([
            apiClient.products.list({ store_id: storeData.id, limit: 1 }).catch(() => null),
            apiClient.shipping.zones.list({ store_id: storeData.id, limit: 1 }).catch(() => []),
        ])
        const productsCount = productsPayload?.total || 0
        const shippingCount = shippingZones.length

        setupStatus = {
            primaryComplete: productsCount > 0,
            secondaryComplete: shippingCount > 0,
            themeCustomized: !!themeCustomized,
            domainConfigured,
            paymentConfigured: false,
            hasShipping: shippingCount > 0,
        }
    } else {
        const pagesPayload = await apiClient.pages.list({ store_id: storeData.id, limit: 1 }).catch(() => null)
        const pagesCount = pagesPayload?.total || 0

        setupStatus = {
            primaryComplete: pagesCount > 0,
            secondaryComplete: !!themeCustomized,
            themeCustomized: !!themeCustomized,
            domainConfigured,
        }
    }

    const homeData = await loadDashboardHomeData(apiClient, storeData.id, storeData.site_type === 'store')

    return (
        <DashboardClient
            store={store}
            storeInfo={storeInfo}
            setupStatus={setupStatus}
            homeData={homeData}
        />
    )
}

async function loadDashboardHomeData(
    apiClient: ReturnType<typeof createMerchantApiClient>,
    storeId: string,
    isStore: boolean,
): Promise<DashboardHomeData> {
    if (!isStore) {
        return emptyDashboardHomeData()
    }

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
        apiClient.products.list({
            store_id: storeId,
            status: 'all',
            limit: 4,
            sort: 'created_at',
            order: 'desc',
        }).catch(() => null),
    ])

    const summary = analyticsPayload?.summary
    const recentActivity = [
        ...(recentOrdersPayload?.data || []).map((order) => orderActivity(order)),
        ...(recentProductsPayload?.data || []).map((product) => productActivity(product)),
    ]
        .sort((first, second) => timestampValue(second.timestamp) - timestampValue(first.timestamp))
        .slice(0, 5)

    return {
        totalRevenue: summary?.revenue?.value || 0,
        revenueChangePct: summary?.revenue?.change_pct || 0,
        totalOrders: summary?.orders?.value || 0,
        ordersChangePct: summary?.orders?.change_pct || 0,
        totalProducts: summary?.products || recentProductsPayload?.total || 0,
        avgOrderValue: summary?.avg_order_value || 0,
        ordersByStatus: ordersBreakdown?.breakdown || {},
        recentActivity,
        analyticsAvailable: Boolean(analyticsPayload),
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

function orderActivity(order: Order): DashboardActivity {
    const customer = order.customer_name || order.customer_email || order.customer_phone || 'Customer'
    const amount = formatCurrency(order.total || 0)
    const orderNumber = order.order_number || order.id.slice(0, 8)

    return {
        id: `order-${order.id}`,
        kind: 'order',
        title: `Order ${orderNumber}`,
        description: `${customer} placed a ${amount} order.`,
        timestamp: order.created_at || null,
        href: 'orders',
        icon: 'receipt_long',
        badgeLabel: titleize(order.status || 'pending'),
        badgeVariant: statusVariant(order.status || 'pending'),
    }
}

function productActivity(product: Product): DashboardActivity {
    const status = product.status || (product.is_active ? 'active' : 'draft')

    return {
        id: `product-${product.id}`,
        kind: 'product',
        title: product.name || 'Product added',
        description: `${product.vendor || product.product_type || product.category || 'Catalog'} item updated in products.`,
        timestamp: product.created_at || null,
        href: `products/${product.id}`,
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

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount)
}
