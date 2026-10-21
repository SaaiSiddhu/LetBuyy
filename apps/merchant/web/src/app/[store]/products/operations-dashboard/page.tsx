'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Card,
    EmptyState,
    Page,
    PageHeader,
    Section,
    Skeleton,
    Table,
    type StatusVariant,
} from '@letbuyy/ui'
import type {
    SupplierMetricsResult,
    WarehouseMetricsResult,
    TransferMetricsResult,
    OperationsSummaryResult,
} from '@letbuyy/api-client'

// ── KPI card ─────────────────────────────────────────────────

interface KpiCardProps {
    label: string
    value: string | number | null | undefined
    subtext?: string
    variant?: StatusVariant
}

function KpiCard({ label, value, subtext, variant }: KpiCardProps) {
    const displayValue = value === null || value === undefined ? '—' : String(value)
    return (
        <div className="flex flex-col gap-[var(--lb-space-1)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border-subtle)] bg-[var(--lb-color-surface-raised)] p-[var(--lb-space-4)]">
            <span className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)] uppercase tracking-wide">
                {label}
            </span>
            <span className="text-[length:var(--lb-font-size-2xl)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text-primary)] tabular-nums">
                {displayValue}
            </span>
            {subtext && variant ? (
                <Badge label={subtext} variant={variant} />
            ) : subtext ? (
                <span className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                    {subtext}
                </span>
            ) : null}
        </div>
    )
}

// ── transfer status badge ─────────────────────────────────────

function transferStatusVariant(status: string): StatusVariant {
    switch (status) {
        case 'completed': return 'success'
        case 'in_transit': return 'info'
        case 'draft': return 'default'
        case 'cancelled': return 'critical'
        default: return 'default'
    }
}

function transferStatusLabel(status: string): string {
    switch (status) {
        case 'draft': return 'Draft'
        case 'in_transit': return 'In transit'
        case 'completed': return 'Completed'
        case 'cancelled': return 'Cancelled'
        default: return status
    }
}

// ── main page ─────────────────────────────────────────────────

type FetchState<T> =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success'; data: T }

function useFetch<T>(url: string | null): FetchState<T> {
    const [state, setState] = useState<FetchState<T>>({ status: 'idle' })

    useEffect(() => {
        if (!url) return
        setState({ status: 'loading' })
        let cancelled = false
        const controller = new AbortController()

        fetch(url, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
            .then(async (res) => {
                const body = await res.json() as { data?: T; error?: unknown }
                if (cancelled) return
                if (!res.ok) {
                    const msg = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`
                    setState({ status: 'error', message: msg })
                } else {
                    setState({ status: 'success', data: body.data as T })
                }
            })
            .catch((err: unknown) => {
                if (cancelled) return
                const msg = err instanceof Error ? err.message : 'Network error'
                setState({ status: 'error', message: msg })
            })

        return () => { cancelled = true; controller.abort() }
    }, [url])

    return state
}

export default function OperationsDashboardPage() {
    const { store } = useParams<{ store: string }>()
    const [refreshKey, setRefreshKey] = useState(0)

    const base = store ? `/api/stores/${encodeURIComponent(store)}/commerce-analytics` : null

    const summaryUrl = base ? `${base}/operations-summary?_r=${refreshKey}` : null
    const supplierUrl = base ? `${base}/supplier-metrics?_r=${refreshKey}` : null
    const warehouseUrl = base ? `${base}/warehouse-metrics?_r=${refreshKey}` : null
    const transferUrl = base ? `${base}/transfer-metrics?_r=${refreshKey}` : null

    const summaryState = useFetch<OperationsSummaryResult>(summaryUrl)
    const supplierState = useFetch<SupplierMetricsResult>(supplierUrl)
    const warehouseState = useFetch<WarehouseMetricsResult>(warehouseUrl)
    const transferState = useFetch<TransferMetricsResult>(transferUrl)

    const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

    const isAllLoading = [summaryState, supplierState, warehouseState, transferState]
        .every((s) => s.status === 'loading' || s.status === 'idle')

    const anyError = [summaryState, supplierState, warehouseState, transferState]
        .find((s): s is { status: 'error'; message: string } => s.status === 'error')

    const summary = summaryState.status === 'success' ? summaryState.data : null
    const supplierResult = supplierState.status === 'success' ? supplierState.data : null
    const warehouseResult = warehouseState.status === 'success' ? warehouseState.data : null
    const transferResult = transferState.status === 'success' ? transferState.data : null

    // ── render ────────────────────────────────────────────────

    return (
        <Page>
            <PageHeader
                title="Operations dashboard"
                description="Real-time view of inventory, suppliers, warehouses, and transfers."
                breadcrumbs={[{ label: 'Inventory' }, { label: 'Operations dashboard' }]}
                primaryAction={{
                    label: 'Refresh',
                    onClick: refresh,
                    disabled: isAllLoading,
                }}
            />

            {anyError && (
                <Banner variant="critical" title="Failed to load some metrics">
                    {anyError.message}
                </Banner>
            )}

            {/* ── Operations snapshot ── */}
            <Card>
                <Section
                    title="Operations snapshot"
                    description="Live counts across orders, purchase orders, transfers, and inventory."
                >
                    {summaryState.status === 'loading' || summaryState.status === 'idle' ? (
                        <div className="grid grid-cols-2 gap-[var(--lb-space-3)] sm:grid-cols-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                <Skeleton key={i} className="h-[var(--lb-space-20)] w-full rounded-[var(--lb-radius-lg)]" />
                            ))}
                        </div>
                    ) : summaryState.status === 'error' ? (
                        <Banner variant="critical" title="Unable to load snapshot">
                            {summaryState.message}
                        </Banner>
                    ) : !summary ? (
                        <EmptyState
                            title="No data available"
                            body="Start by creating products, purchase orders, or inventory transfers."
                        />
                    ) : (
                        <div className="grid grid-cols-2 gap-[var(--lb-space-3)] sm:grid-cols-4">
                            <KpiCard
                                label="Total orders"
                                value={summary.order_count}
                                subtext={summary.open_order_count !== undefined ? `${summary.open_order_count} open` : undefined}
                                variant="info"
                            />
                            <KpiCard
                                label="Open orders"
                                value={summary.open_order_count}
                                subtext="pending / processing"
                            />
                            <KpiCard
                                label="Total SKUs"
                                value={summary.total_sku_count}
                                subtext={summary.low_stock_sku_count !== undefined ? `${summary.low_stock_sku_count} low stock` : undefined}
                                variant={
                                    summary.low_stock_sku_count !== undefined && summary.low_stock_sku_count > 0
                                        ? 'warning'
                                        : 'success'
                                }
                            />
                            <KpiCard
                                label="Low-stock SKUs"
                                value={summary.low_stock_sku_count}
                                subtext="available ≤ 10 units"
                                variant={
                                    summary.low_stock_sku_count !== undefined && summary.low_stock_sku_count > 0
                                        ? 'warning'
                                        : 'success'
                                }
                            />
                            <KpiCard
                                label="Purchase orders"
                                value={summary.po_count}
                                subtext={summary.open_po_count !== undefined ? `${summary.open_po_count} open` : undefined}
                                variant="info"
                            />
                            <KpiCard
                                label="Open POs"
                                value={summary.open_po_count}
                                subtext="draft / ordered / partial"
                            />
                            <KpiCard
                                label="Transfers"
                                value={summary.transfer_count}
                                subtext={summary.in_transit_transfer_count !== undefined ? `${summary.in_transit_transfer_count} in transit` : undefined}
                                variant="info"
                            />
                            <KpiCard
                                label="In-transit transfers"
                                value={summary.in_transit_transfer_count}
                            />
                        </div>
                    )}
                </Section>
            </Card>

            {/* ── Supplier metrics ── */}
            <Card>
                <Section
                    title="Supplier performance"
                    description="Purchase order counts, on-time delivery rate, and average lead time per supplier."
                >
                    {supplierState.status === 'loading' || supplierState.status === 'idle' ? (
                        <div className="flex flex-col gap-[var(--lb-space-2)]">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-[var(--lb-space-10)] w-full rounded-[var(--lb-radius-md)]" />
                            ))}
                        </div>
                    ) : supplierState.status === 'error' ? (
                        <Banner variant="critical" title="Unable to load supplier metrics">
                            {supplierState.message}
                        </Banner>
                    ) : !supplierResult || supplierResult.suppliers.length === 0 ? (
                        <EmptyState
                            title="No supplier data yet"
                            body="Create purchase orders linked to suppliers to see performance metrics here."
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="w-full border-collapse text-[length:var(--lb-font-size-sm)]">
                                <thead>
                                    <tr className="border-b border-[var(--lb-color-border-subtle)] text-left">
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Supplier
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            POs
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            On-time rate
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Avg lead time
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {supplierResult.suppliers.map((s, i) => (
                                        <tr
                                            key={s.supplier_id ?? `sup-${i}`}
                                            className="border-b border-[var(--lb-color-border-subtle)] last:border-0"
                                        >
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                {s.supplier_name}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-right tabular-nums text-[var(--lb-color-text-primary)]">
                                                {s.po_count}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-right">
                                                {s.on_time_rate === null ? (
                                                    <span className="text-[var(--lb-color-text-secondary)]">—</span>
                                                ) : (
                                                    <Badge
                                                        label={`${Math.round(s.on_time_rate * 100)}%`}
                                                        variant={s.on_time_rate >= 0.8 ? 'success' : s.on_time_rate >= 0.5 ? 'warning' : 'critical'}
                                                    />
                                                )}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] text-right tabular-nums text-[var(--lb-color-text-secondary)]">
                                                {s.avg_lead_time_days === null
                                                    ? '—'
                                                    : `${s.avg_lead_time_days}d`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Section>
            </Card>

            {/* ── Warehouse metrics ── */}
            <Card>
                <Section
                    title="Warehouse & location inventory"
                    description="SKU count and total units held at each inventory location."
                >
                    {warehouseState.status === 'loading' || warehouseState.status === 'idle' ? (
                        <div className="flex flex-col gap-[var(--lb-space-2)]">
                            {[1, 2].map((i) => (
                                <Skeleton key={i} className="h-[var(--lb-space-10)] w-full rounded-[var(--lb-radius-md)]" />
                            ))}
                        </div>
                    ) : warehouseState.status === 'error' ? (
                        <Banner variant="critical" title="Unable to load warehouse metrics">
                            {warehouseState.message}
                        </Banner>
                    ) : !warehouseResult || warehouseResult.warehouses.length === 0 ? (
                        <EmptyState
                            title="No inventory locations configured"
                            body="Set up inventory locations to track stock across warehouses and retail locations."
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="w-full border-collapse text-[length:var(--lb-font-size-sm)]">
                                <thead>
                                    <tr className="border-b border-[var(--lb-color-border-subtle)] text-left">
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Location
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            SKUs
                                        </th>
                                        <th className="pb-[var(--lb-space-2)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                            Total units
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {warehouseResult.warehouses.map((w) => (
                                        <tr
                                            key={w.location_id}
                                            className="border-b border-[var(--lb-color-border-subtle)] last:border-0"
                                        >
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)]">
                                                <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                    {w.location_name}
                                                </span>
                                                {w.is_default && (
                                                    <Badge
                                                        label="Default"
                                                        variant="info"
                                                    />
                                                )}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)] text-right tabular-nums text-[var(--lb-color-text-secondary)]">
                                                {w.sku_count}
                                            </td>
                                            <td className="py-[var(--lb-space-3)] text-right tabular-nums text-[var(--lb-color-text-primary)]">
                                                {w.total_units.toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Section>
            </Card>

            {/* ── Transfer metrics ── */}
            <Card>
                <Section
                    title="Transfer pipeline"
                    description="Counts by transfer status. In-transit transfers represent stock in movement between locations."
                >
                    {transferState.status === 'loading' || transferState.status === 'idle' ? (
                        <div className="flex flex-col gap-[var(--lb-space-2)]">
                            {[1, 2].map((i) => (
                                <Skeleton key={i} className="h-[var(--lb-space-10)] w-full rounded-[var(--lb-radius-md)]" />
                            ))}
                        </div>
                    ) : transferState.status === 'error' ? (
                        <Banner variant="critical" title="Unable to load transfer metrics">
                            {transferState.message}
                        </Banner>
                    ) : !transferResult || transferResult.total_count === 0 ? (
                        <EmptyState
                            title="No transfers yet"
                            body="Create inventory transfers to move stock between locations and track pipeline here."
                        />
                    ) : (
                        <div className="flex flex-col gap-[var(--lb-space-4)]">
                            {/* Summary KPIs */}
                            <div className="grid grid-cols-2 gap-[var(--lb-space-3)] sm:grid-cols-3">
                                <KpiCard label="Total transfers" value={transferResult.total_count} />
                                <KpiCard
                                    label="In transit"
                                    value={transferResult.in_transit_count}
                                    subtext={transferResult.in_transit_count > 0 ? 'stock in movement' : undefined}
                                    variant="info"
                                />
                            </div>

                            {/* By-status breakdown */}
                            {Object.keys(transferResult.by_status).length > 0 && (
                                <div className="overflow-x-auto">
                                    <Table className="w-full border-collapse text-[length:var(--lb-font-size-sm)]">
                                        <thead>
                                            <tr className="border-b border-[var(--lb-color-border-subtle)] text-left">
                                                <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-4)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                                    Status
                                                </th>
                                                <th className="pb-[var(--lb-space-2)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                                    Count
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(transferResult.by_status)
                                                .sort(([, a], [, b]) => b - a)
                                                .map(([status, count]) => (
                                                    <tr
                                                        key={status}
                                                        className="border-b border-[var(--lb-color-border-subtle)] last:border-0"
                                                    >
                                                        <td className="py-[var(--lb-space-3)] pr-[var(--lb-space-4)]">
                                                            <Badge
                                                                label={transferStatusLabel(status)}
                                                                variant={transferStatusVariant(status)}
                                                            />
                                                        </td>
                                                        <td className="py-[var(--lb-space-3)] text-right tabular-nums text-[var(--lb-color-text-primary)]">
                                                            {count}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}
                </Section>
            </Card>
        </Page>
    )
}
