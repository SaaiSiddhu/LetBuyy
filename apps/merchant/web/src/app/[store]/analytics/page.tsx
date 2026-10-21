'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { useReadRequest } from '@/lib/api/use-read-request'
import { formatInrCurrency } from '@letbuyy/ui/formatting'
import { Button,
    Badge,
    Banner,
    BarChart3,
    Card,
    EmptyState,
    IndianRupee,
    MaterialIcon,
    MetricCard,
    Package,
    Page,
    PageHeader,
    Section,
    Select,
    Skeleton,
} from '@letbuyy/ui'

interface AnalyticsData {
    totalOrders: number
    totalRevenue: number
    totalProducts: number
    avgOrderValue: number
    ordersByStatus: Record<string, number>
    revenueByMonth: Array<{ month: string; revenue: number }>
}

type AnalyticsPeriod = '7d' | '30d' | '90d'

const periodOptions = [
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
] satisfies Array<{ label: string; value: AnalyticsPeriod }>

const orderStatuses = [
    { key: 'pending', label: 'Pending', variant: 'warning' },
    { key: 'confirmed', label: 'Confirmed', variant: 'info' },
    { key: 'shipped', label: 'Shipped', variant: 'info' },
    { key: 'delivered', label: 'Delivered', variant: 'success' },
    { key: 'cancelled', label: 'Cancelled', variant: 'critical' },
] as const

export default function AnalyticsPage() {
    const { store } = useParams<{ store: string }>()
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
    const beginRead = useReadRequest(JSON.stringify([store, period]))

    const loadAnalytics = useCallback(async () => {
        const request = beginRead()
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/analytics?period=${period}`, {
                cache: 'no-store',
                signal: request.signal,
            })
            const payload = await response.json()
            if (!request.isCurrent()) return

            if (!response.ok) {
                const message = typeof payload?.error === 'string'
                    ? payload.error
                    : payload?.error?.message || 'Unable to load analytics'
                throw new Error(message)
            }

            setData(payload.data)
        } catch (err) {
            if (!request.isCurrent()) return
            setData(null)
            setError(err instanceof Error ? err.message : 'Unable to load analytics')
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [period, store, beginRead])

    useEffect(() => {
        void loadAnalytics()
    }, [loadAnalytics])

    const totalStatusCount = useMemo(() => {
        if (!data) return 0
        return Object.values(data.ordersByStatus).reduce((sum, count) => sum + count, 0)
    }, [data])

    const hasBusinessActivity = Boolean(
        data && (data.totalOrders > 0 || data.totalRevenue > 0 || data.totalProducts > 0 || totalStatusCount > 0),
    )

    return (
        <Page>
            <PageHeader
                title="Analytics"
                description={`Track ${store}'s sales, orders, and catalog performance from one workspace.`}
                breadcrumbs={[{ label: 'Home', href: `/${store}/dashboard` }, { label: 'Analytics' }]}
                primaryAction={{
                    label: 'Refresh',
                    onClick: () => { void loadAnalytics() },
                    icon: <MaterialIcon name="sync" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />,
                    disabled: loading,
                }}
            />

            <Card>
                <Section
                    title="Reporting period"
                    description="Choose the range used by the summary cards and order breakdown."
                >
                    <div className="max-w-[var(--lb-size-content-measure)]">
                        <Select
                            label="Date range"
                            value={period}
                            onChange={(event) => setPeriod(event.target.value as AnalyticsPeriod)}
                            options={periodOptions}
                        />
                    </div>
                </Section>
            </Card>

            {error && (
                <Banner
                    variant="critical"
                    title="Analytics could not be loaded"
                    action={<Button variant="secondary" size="sm" onClick={() => { void loadAnalytics() }}>Retry</Button>}
                >
                    {error}
                </Banner>
            )}

            {loading ? (
                <>
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} variant="card" />
                        ))}
                    </div>
                    <Card>
                        <Section title="Orders by status">
                            <Skeleton variant="table" lines={5} />
                        </Section>
                    </Card>
                </>
            ) : data && (
                <>
                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                            label="Revenue"
                            value={formatInrCurrency(data.totalRevenue, { maximumFractionDigits: 0 }) || '₹0'}
                            delta={periodLabel(period)}
                            deltaTone="neutral"
                        />
                        <MetricCard
                            label="Orders"
                            value={String(data.totalOrders)}
                            delta={data.totalOrders === 1 ? '1 order placed' : `${data.totalOrders} orders placed`}
                            deltaTone={data.totalOrders > 0 ? 'positive' : 'neutral'}
                        />
                        <MetricCard
                            label="Average order value"
                            value={formatInrCurrency(data.avgOrderValue, { maximumFractionDigits: 0 }) || '₹0'}
                            delta="Calculated from settled order data"
                            deltaTone="neutral"
                        />
                        <MetricCard
                            label="Products"
                            value={String(data.totalProducts)}
                            delta={data.totalProducts > 0 ? 'Catalog ready' : 'No products yet'}
                            deltaTone={data.totalProducts > 0 ? 'positive' : 'neutral'}
                        />
                    </div>

                    {!hasBusinessActivity && (
                        <EmptyState
                            icon={<BarChart3 className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-primary)]" />}
                            title="Analytics will appear after your first activity"
                            body="Add products, receive orders, and LetBuyy will summarize the performance signals here."
                            primaryAction={<Button as="a" href={`/${store}/products/new`}>Add product</Button>}
                            secondaryAction={<Button as="a" variant="secondary" href={`/${store}/online-store/themes`}>Customize storefront</Button>}
                        />
                    )}

                    <Card>
                        <Section
                            title="Orders by status"
                            description="Monitor where orders are waiting for merchant action."
                        >
                            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2 xl:grid-cols-5">
                                {orderStatuses.map((status) => {
                                    // orders.status carries payment-method-specific variants the
                                    // breakdown buckets don't enumerate separately (pending_cod is
                                    // the large real-world case -- a COD order awaiting merchant
                                    // confirmation is a Pending order to a merchant, not invisible).
                                    const count = status.key === 'pending'
                                        ? (data.ordersByStatus.pending || 0) + (data.ordersByStatus.pending_cod || 0)
                                        : data.ordersByStatus[status.key] || 0

                                    return (
                                        <div
                                            key={status.key}
                                            className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]"
                                        >
                                            <div className="flex items-center justify-between gap-[var(--lb-space-2)]">
                                                <Badge label={status.label} variant={status.variant} />
                                                <span className="text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                                    {totalStatusCount > 0 ? `${Math.round((count / totalStatusCount) * 100)}%` : '0%'}
                                                </span>
                                            </div>
                                            <p className="m-0 mt-[var(--lb-space-3)] text-[var(--lb-font-size-display)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-display)] text-[var(--lb-color-text)]">
                                                {count}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title="Monthly revenue"
                            description="Revenue trend data appears when the analytics service returns monthly buckets."
                        >
                            {data.revenueByMonth.length > 0 ? (
                                <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                                    {data.revenueByMonth.map((month) => (
                                        <div
                                            key={month.month}
                                            className="flex flex-col gap-[var(--lb-space-2)] p-[var(--lb-space-4)] md:flex-row md:items-center md:justify-between"
                                        >
                                            <div className="flex items-center gap-[var(--lb-space-3)]">
                                                <IndianRupee className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[var(--lb-color-primary)]" aria-hidden="true" />
                                                <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">
                                                    {month.month}
                                                </span>
                                            </div>
                                            <span className="text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                                                {formatInrCurrency(month.revenue, { maximumFractionDigits: 0 }) || '₹0'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState
                                    icon={<MaterialIcon name="receipt_long" className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] text-[var(--lb-color-primary)]" />}
                                    title="Monthly revenue is not available yet"
                                    body="The current analytics endpoint returns summary totals and order status counts. Monthly revenue buckets can be shown here when that field is populated."
                                />
                            )}
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Next best actions" description="Move from insight to action without leaving the analytics workspace.">
                            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                                <ActionLink
                                    href={`/${store}/orders`}
                                    icon={<MaterialIcon name="receipt_long" className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" />}
                                    title="Review orders"
                                    description="Prioritize pending and confirmed orders."
                                />
                                <ActionLink
                                    href={`/${store}/products`}
                                    icon={<Package className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                    title="Tune catalog"
                                    description="Update low-signal products and inventory."
                                />
                                <ActionLink
                                    href={`/${store}/online-store/themes`}
                                    icon={<BarChart3 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                    title="Improve storefront"
                                    description="Adjust theme, content, and conversion cues."
                                />
                            </div>
                        </Section>
                    </Card>
                </>
            )}
        </Page>
    )
}

function periodLabel(period: AnalyticsPeriod) {
    if (period === '7d') return 'Last 7 days'
    if (period === '90d') return 'Last 90 days'
    return 'Last 30 days'
}

function ActionLink({
    href,
    icon,
    title,
    description,
}: {
    href: string
    icon: ReactNode
    title: string
    description: string
}) {
    return (
        <a
            href={href}
            className="flex min-h-[calc(var(--lb-size-control-lg)+var(--lb-space-7))] flex-col justify-between rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] transition-colors duration-[var(--lb-motion-fast)] hover:bg-[var(--lb-color-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
        >
            <span className="inline-flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                {icon}
            </span>
            <span className="mt-[var(--lb-space-4)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                {title}
            </span>
            <span className="mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                {description}
            </span>
        </a>
    )
}
