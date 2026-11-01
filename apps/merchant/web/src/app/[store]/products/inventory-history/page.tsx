'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    Input,
    Page,
    PageHeader,
    Search,
    Section,
    Skeleton,
    Table,
    useToast,
    type StatusVariant,
} from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'
import { formatIndiaDate } from '@letbuyy/ui/formatting'

// ── analytics KPI types ───────────────────────────────────────────────────────

interface InventoryAnalytics {
    low_stock_count?: number
    total_skus?: number
    po_by_status?: Record<string, number>
    transfer_by_status?: Record<string, number>
}

// ── row type ─────────────────────────────────────────────────────────────────
// The gateway queries `inventory_adjustments` with `*, products!inner(name, store_id)`.
// Columns: id, product_id, variant_id, location_id, quantity_change, reason,
//          reference_id, note, created_by, created_at
//          + products: { name: string; store_id: string }
// reason CHECK: sale | return | adjustment | recount | transfer | damaged | reserved | unreserved

type AdjustmentReason =
    | 'sale'
    | 'return'
    | 'adjustment'
    | 'recount'
    | 'transfer'
    | 'damaged'
    | 'reserved'
    | 'unreserved'

interface AdjustmentRow {
    id: string
    product_id: string
    variant_id: string | null
    location_id: string | null
    quantity_change: number
    reason: AdjustmentReason
    reference_id: string | null
    note: string | null
    created_by: string | null
    created_at: string
    /** Joined from products table */
    products: { name: string; store_id: string } | null
}

interface PageMeta {
    total: number
    page: number
    per_page: number
    has_next: boolean
}

// ── helpers ──────────────────────────────────────────────────────────────────

function reasonVariant(reason: AdjustmentReason): StatusVariant {
    switch (reason) {
        case 'sale': return 'info'
        case 'return': return 'success'
        case 'adjustment': return 'default'
        case 'recount': return 'default'
        case 'transfer': return 'info'
        case 'damaged': return 'critical'
        case 'reserved': return 'warning'
        case 'unreserved': return 'default'
        default: return 'default'
    }
}

function reasonLabel(reason: AdjustmentReason): string {
    switch (reason) {
        case 'sale': return 'Sale'
        case 'return': return 'Return'
        case 'adjustment': return 'Manual Adjustment'
        case 'recount': return 'Recount'
        case 'transfer': return 'Transfer'
        case 'damaged': return 'Damaged'
        case 'reserved': return 'Reserved'
        case 'unreserved': return 'Unreserved'
        default: return String(reason)
    }
}

function quantityDisplay(change: number): { label: string; positive: boolean } {
    if (change > 0) return { label: `+${change}`, positive: true }
    return { label: String(change), positive: false }
}

function normalizeRow(raw: Record<string, unknown>): AdjustmentRow {
    const products = raw.products
    return {
        id: String(raw.id ?? ''),
        product_id: String(raw.product_id ?? ''),
        variant_id: typeof raw.variant_id === 'string' ? raw.variant_id : null,
        location_id: typeof raw.location_id === 'string' ? raw.location_id : null,
        quantity_change: typeof raw.quantity_change === 'number' ? raw.quantity_change : 0,
        reason: (typeof raw.reason === 'string' ? raw.reason : 'adjustment') as AdjustmentReason,
        reference_id: typeof raw.reference_id === 'string' ? raw.reference_id : null,
        note: typeof raw.note === 'string' ? raw.note : null,
        created_by: typeof raw.created_by === 'string' ? raw.created_by : null,
        created_at: typeof raw.created_at === 'string' ? raw.created_at : '',
        products:
            products && typeof products === 'object' && !Array.isArray(products)
                ? {
                      name: String((products as Record<string, unknown>).name ?? ''),
                      store_id: String((products as Record<string, unknown>).store_id ?? ''),
                  }
                : null,
    }
}

// ── main component ────────────────────────────────────────────────────────────

export default function InventoryHistoryPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()

    const [rows, setRows] = useState<AdjustmentRow[]>([])
    const [meta, setMeta] = useState<PageMeta>({ total: 0, page: 1, per_page: 20, has_next: false })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [productFilter, setProductFilter] = useState('')
    const [page, setPage] = useState(1)

    // ── KPI analytics ─────────────────────────────────────────────────────────
    const [analytics, setAnalytics] = useState<InventoryAnalytics | null>(null)
    const [analyticsLoading, setAnalyticsLoading] = useState(true)

    useEffect(() => {
        let retired = false
        const controller = new AbortController()
        async function fetchAnalytics() {
            setAnalyticsLoading(true)
            try {
                const res = await fetch(
                    `/api/stores/${encodeURIComponent(store)}/inventory/analytics`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) }
                )
                if (!res.ok) return
                const json = (await res.json()) as { data?: InventoryAnalytics }
                if (!retired && json.data) setAnalytics(json.data)
            } catch {
                // analytics is best-effort — don't block the page
            } finally {
                if (!retired) setAnalyticsLoading(false)
            }
        }
        setAnalytics(null)
        void fetchAnalytics()
        return () => { retired = true; controller.abort() }
    }, [store])

    const beginRead = useReadRequest(store)
    const fetchHistory = useCallback(
        async (currentPage: number, currentProductFilter: string) => {
            const request = beginRead()
            setLoading(true)
            setError(null)
            try {
                const url = new URL(
                    `/api/stores/${encodeURIComponent(store)}/inventory/history`,
                    window.location.origin
                )
                url.searchParams.set('page', String(currentPage))
                url.searchParams.set('limit', '20')
                if (currentProductFilter.trim()) {
                    url.searchParams.set('product_id', currentProductFilter.trim())
                }

                const res = await fetch(url.toString(), { cache: 'no-store', signal: request.signal })
                const json = (await res.json()) as {
                    data?: unknown[]
                    meta?: PageMeta
                    error?: unknown
                    message?: string
                }

                if (!request.isCurrent()) return
                if (!res.ok) {
                    const msg =
                        typeof json.error === 'string'
                            ? json.error
                            : typeof json.message === 'string'
                              ? json.message
                              : 'Failed to load inventory history'
                    throw new Error(msg)
                }

                const normalized = (json.data ?? []).map((r) =>
                    normalizeRow(r as Record<string, unknown>)
                )
                setRows(normalized)
                setMeta(
                    json.meta ?? {
                        total: normalized.length,
                        page: currentPage,
                        per_page: 20,
                        has_next: false,
                    }
                )
            } catch (err) {
                if (!request.isCurrent()) return
                const msg = err instanceof Error ? err.message : 'Unknown error'
                setError(msg)
                notify({ title: 'Error', description: msg })
            } finally {
                if (request.isCurrent()) setLoading(false)
            }
        },
        [store, notify, beginRead]
    )

    useEffect(() => {
        setPage(1)
        void fetchHistory(1, '')
    }, [fetchHistory])

    function handleSearch() {
        setPage(1)
        void fetchHistory(1, productFilter)
    }

    function handleClearFilter() {
        setProductFilter('')
        setPage(1)
        void fetchHistory(1, '')
    }

    function handleRefresh() {
        void fetchHistory(page, productFilter)
    }

    function handlePrevPage() {
        const newPage = Math.max(1, page - 1)
        setPage(newPage)
        void fetchHistory(newPage, productFilter)
    }

    function handleNextPage() {
        if (!meta.has_next) return
        const newPage = page + 1
        setPage(newPage)
        void fetchHistory(newPage, productFilter)
    }

    const totalPages = Math.max(1, Math.ceil(meta.total / meta.per_page))

    return (
        <Page>
            <PageHeader identity="products"
                recipe="index"
                title="Inventory History"
                description="Movement and adjustment records for your products"
            />

            <Section>
                {/* KPI analytics summary */}
                <div className="grid grid-cols-2 gap-[var(--lb-space-3)] sm:grid-cols-4">
                    {analyticsLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <Card key={i}>
                                <div className="p-[var(--lb-space-4)]">
                                    <Skeleton variant="text" lines={2} />
                                </div>
                            </Card>
                        ))
                    ) : (
                        <>
                            <Card>
                                <div className="p-[var(--lb-space-4)]">
                                    <p className="text-[length:var(--lb-font-size-xs)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)] uppercase tracking-wide">
                                        Low Stock
                                    </p>
                                    <p className="mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-2xl)] font-[var(--lb-font-weight-bold)] text-[var(--lb-color-feedback-critical-text)]">
                                        {analytics?.low_stock_count ?? '—'}
                                    </p>
                                    <p className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-tertiary)]">
                                        SKUs at or below 10 units
                                    </p>
                                </div>
                            </Card>
                            <Card>
                                <div className="p-[var(--lb-space-4)]">
                                    <p className="text-[length:var(--lb-font-size-xs)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)] uppercase tracking-wide">
                                        Total SKUs
                                    </p>
                                    <p className="mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-2xl)] font-[var(--lb-font-weight-bold)] text-[var(--lb-color-text-primary)]">
                                        {analytics?.total_skus ?? '—'}
                                    </p>
                                    <p className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-tertiary)]">
                                        Active products
                                    </p>
                                </div>
                            </Card>
                            <Card>
                                <div className="p-[var(--lb-space-4)]">
                                    <p className="text-[length:var(--lb-font-size-xs)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)] uppercase tracking-wide">
                                        Purchase Orders
                                    </p>
                                    {analytics?.po_by_status && Object.keys(analytics.po_by_status).length > 0 ? (
                                        <div className="mt-[var(--lb-space-1)] flex flex-col gap-[var(--lb-space-1)]">
                                            {Object.entries(analytics.po_by_status).map(([status, count]) => (
                                                <div key={status} className="flex items-center justify-between">
                                                    <span className="text-[length:var(--lb-font-size-xs)] capitalize text-[var(--lb-color-text-secondary)]">
                                                        {status}
                                                    </span>
                                                    <span className="text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                        {count}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-2xl)] font-[var(--lb-font-weight-bold)] text-[var(--lb-color-text-primary)]">
                                            —
                                        </p>
                                    )}
                                </div>
                            </Card>
                            <Card>
                                <div className="p-[var(--lb-space-4)]">
                                    <p className="text-[length:var(--lb-font-size-xs)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)] uppercase tracking-wide">
                                        Transfers
                                    </p>
                                    {analytics?.transfer_by_status && Object.keys(analytics.transfer_by_status).length > 0 ? (
                                        <div className="mt-[var(--lb-space-1)] flex flex-col gap-[var(--lb-space-1)]">
                                            {Object.entries(analytics.transfer_by_status).map(([status, count]) => (
                                                <div key={status} className="flex items-center justify-between">
                                                    <span className="text-[length:var(--lb-font-size-xs)] capitalize text-[var(--lb-color-text-secondary)]">
                                                        {status}
                                                    </span>
                                                    <span className="text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                        {count}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-[var(--lb-space-1)] text-[length:var(--lb-font-size-2xl)] font-[var(--lb-font-weight-bold)] text-[var(--lb-color-text-primary)]">
                                            —
                                        </p>
                                    )}
                                </div>
                            </Card>
                        </>
                    )}
                </div>

                {/* Filters */}
                <Card>
                    <div className="p-[var(--lb-space-4)]">
                        <div className="flex flex-col gap-[var(--lb-space-3)] sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <label
                                    className="mb-[var(--lb-space-1)] block text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]"
                                    htmlFor="product-id-filter"
                                >
                                    Filter by product ID
                                </label>
                                <Input
                                    id="product-id-filter"
                                    placeholder="Enter product UUID"
                                    value={productFilter}
                                    onChange={(e) => setProductFilter(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSearch()
                                    }}
                                />
                            </div>
                            <div className="flex gap-[var(--lb-space-2)]">
                                <Button variant="primary" size="sm" onClick={handleSearch} disabled={loading}>
                                    <Search size={14} />
                                    Apply
                                </Button>
                                {productFilter && (
                                    <Button variant="ghost" size="sm" onClick={handleClearFilter} disabled={loading}>
                                        Clear
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Error state */}
                {error && (
                    <Banner
                        variant="critical"
                        title="Failed to load inventory history"
                        action={
                            <Button variant="ghost" size="sm" onClick={handleRefresh}>
                                Try again
                            </Button>
                        }
                    >
                        {error}
                    </Banner>
                )}

                {/* Table */}
                <Card>
                    {loading ? (
                        <div className="p-[var(--lb-space-4)]">
                            <Skeleton variant="table" lines={6} />
                        </div>
                    ) : !error && rows.length === 0 ? (
                        <div className="p-[var(--lb-space-6)]">
                            <EmptyState scene="inventory-history"
                                kind="inventory"
                                title="No adjustment records"
                                body={
                                    productFilter
                                        ? 'No inventory movements found for this product.'
                                        : 'Inventory adjustments will appear here when products are sold, restocked, or manually adjusted.'
                                }
                            />
                        </div>
                    ) : !error ? (
                        <>
                            {/* Desktop table */}
                            <div className="hidden sm:block">
                                <Table className="w-full text-[length:var(--lb-font-size-sm)]">
                                    <thead>
                                        <tr className="border-b border-[var(--lb-color-border-subtle)] bg-[var(--lb-color-surface-subdued)]">
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                                Reason
                                            </th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                                Product
                                            </th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                                Qty change
                                            </th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                                Note
                                            </th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">
                                                Date
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => {
                                            const qty = quantityDisplay(row.quantity_change)
                                            return (
                                                <tr
                                                    key={row.id}
                                                    className="border-b border-[var(--lb-color-border-subtle)] last:border-0 hover:bg-[var(--lb-color-surface-hovered)]"
                                                >
                                                    <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                        <Badge
                                                            label={reasonLabel(row.reason)}
                                                            variant={reasonVariant(row.reason)}
                                                        />
                                                    </td>
                                                    <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                        <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                            {row.products?.name ?? '—'}
                                                        </span>
                                                        {row.variant_id && (
                                                            <span className="mt-[var(--lb-space-1)] block text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                                                                Variant: {row.variant_id}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-right">
                                                        <span
                                                            className={
                                                                qty.positive
                                                                    ? 'font-[var(--lb-font-weight-medium)] text-[var(--lb-color-feedback-success-text)]'
                                                                    : 'font-[var(--lb-font-weight-medium)] text-[var(--lb-color-feedback-critical-text)]'
                                                            }
                                                        >
                                                            {qty.label}
                                                        </span>
                                                    </td>
                                                    <td className="max-w-xs px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                        <span className="block truncate text-[var(--lb-color-text-secondary)]">
                                                            {row.note ?? '—'}
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-secondary)]">
                                                        {row.created_at
                                                            ? formatIndiaDate(row.created_at)
                                                            : '—'}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </Table>
                            </div>

                            {/* Mobile card list */}
                            <div className="flex flex-col divide-y divide-[var(--lb-color-border-subtle)] sm:hidden">
                                {rows.map((row) => {
                                    const qty = quantityDisplay(row.quantity_change)
                                    return (
                                        <div
                                            key={row.id}
                                            className="flex flex-col gap-[var(--lb-space-2)] p-[var(--lb-space-4)]"
                                        >
                                            <div className="flex items-center justify-between">
                                                <Badge
                                                    label={reasonLabel(row.reason)}
                                                    variant={reasonVariant(row.reason)}
                                                />
                                                <span
                                                    className={
                                                        qty.positive
                                                            ? 'text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-feedback-success-text)]'
                                                            : 'text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-feedback-critical-text)]'
                                                    }
                                                >
                                                    {qty.label}
                                                </span>
                                            </div>
                                            <p className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                {row.products?.name ?? '—'}
                                            </p>
                                            {row.note && (
                                                <p className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                                                    {row.note}
                                                </p>
                                            )}
                                            <p className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-tertiary)]">
                                                {row.created_at ? formatIndiaDate(row.created_at) : '—'}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Pagination */}
                            {meta.total > meta.per_page && (
                                <div className="flex items-center justify-between border-t border-[var(--lb-color-border-subtle)] px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                    <span className="text-[length:var(--lb-font-size-sm)] text-[var(--lb-color-text-secondary)]">
                                        Page {meta.page} of {totalPages} &bull; {meta.total} records
                                    </span>
                                    <div className="flex gap-[var(--lb-space-2)]">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handlePrevPage}
                                            disabled={page <= 1 || loading}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleNextPage}
                                            disabled={!meta.has_next || loading}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </Card>
            </Section>
        </Page>
    )
}
