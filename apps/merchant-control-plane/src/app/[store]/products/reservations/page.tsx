'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    EmptyState,
    Input,
    Page,
    PageHeader,
    Section,
    Select,
    Skeleton,
    useToast,
    type SelectOption,
    type StatusVariant,
} from '@letbuyy/ui'
import { formatIndiaDate } from '@letbuyy/ui/formatting'

// ── types ─────────────────────────────────────────────────────────────────────
// Gateway returns inventory_reservations rows:
// id, product_id, variant_id, location_id, quantity, status, expires_at,
// order_id, created_at, updated_at, products: { name, store_id }

type ReservationStatus = 'active' | 'committed' | 'released' | 'expired'

interface ReservationRow {
    id: string
    product_id: string
    variant_id: string | null
    location_id: string | null
    quantity: number
    status: ReservationStatus
    expires_at: string | null
    order_id: string | null
    created_at: string
    updated_at: string | null
    products: { name: string; store_id: string } | null
}

interface PageMeta {
    total: number
    page: number
    per_page: number
    has_next: boolean
}

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: SelectOption[] = [
    { value: '', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'committed', label: 'Committed' },
    { value: 'released', label: 'Released' },
    { value: 'expired', label: 'Expired' },
]

function statusVariant(status: ReservationStatus): StatusVariant {
    switch (status) {
        case 'active': return 'warning'
        case 'committed': return 'success'
        case 'released': return 'default'
        case 'expired': return 'critical'
        default: return 'default'
    }
}

function statusLabel(status: ReservationStatus): string {
    switch (status) {
        case 'active': return 'Active'
        case 'committed': return 'Committed'
        case 'released': return 'Released'
        case 'expired': return 'Expired'
        default: return String(status)
    }
}

function normalizeRow(raw: Record<string, unknown>): ReservationRow {
    const products = raw.products
    return {
        id: String(raw.id ?? ''),
        product_id: String(raw.product_id ?? ''),
        variant_id: typeof raw.variant_id === 'string' ? raw.variant_id : null,
        location_id: typeof raw.location_id === 'string' ? raw.location_id : null,
        quantity: typeof raw.quantity === 'number' ? raw.quantity : 0,
        status: (typeof raw.status === 'string' ? raw.status : 'active') as ReservationStatus,
        expires_at: typeof raw.expires_at === 'string' ? raw.expires_at : null,
        order_id: typeof raw.order_id === 'string' ? raw.order_id : null,
        created_at: typeof raw.created_at === 'string' ? raw.created_at : '',
        updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
        products:
            products && typeof products === 'object' && !Array.isArray(products)
                ? {
                      name: String((products as Record<string, unknown>).name ?? ''),
                      store_id: String((products as Record<string, unknown>).store_id ?? ''),
                  }
                : null,
    }
}

// ── main component ─────────────────────────────────────────────────────────────

export default function InventoryReservationsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()

    const [rows, setRows] = useState<ReservationRow[]>([])
    const [meta, setMeta] = useState<PageMeta>({ total: 0, page: 1, per_page: 20, has_next: false })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState('')
    const [productFilter, setProductFilter] = useState('')
    const [page, setPage] = useState(1)

    const fetchReservations = useCallback(
        async (currentPage: number, currentStatus: string, currentProduct: string) => {
            setLoading(true)
            setError(null)
            try {
                const url = new URL(
                    `/api/stores/${encodeURIComponent(store)}/inventory/reservations`,
                    window.location.origin
                )
                url.searchParams.set('page', String(currentPage))
                url.searchParams.set('limit', '20')
                if (currentStatus) url.searchParams.set('status', currentStatus)
                if (currentProduct.trim()) url.searchParams.set('product_id', currentProduct.trim())

                const res = await fetch(url.toString())
                const json = (await res.json()) as {
                    data?: unknown[]
                    meta?: PageMeta
                    error?: unknown
                    message?: string
                }

                if (!res.ok) {
                    const msg =
                        typeof json.error === 'string'
                            ? json.error
                            : typeof json.message === 'string'
                              ? json.message
                              : 'Failed to load reservations'
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
                const msg = err instanceof Error ? err.message : 'Unknown error'
                setError(msg)
                notify({ title: 'Error', description: msg })
            } finally {
                setLoading(false)
            }
        },
        [store, notify]
    )

    useEffect(() => {
        void fetchReservations(page, statusFilter, productFilter)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function handleApply() {
        setPage(1)
        void fetchReservations(1, statusFilter, productFilter)
    }

    function handleClear() {
        setStatusFilter('')
        setProductFilter('')
        setPage(1)
        void fetchReservations(1, '', '')
    }

    function handleRefresh() {
        void fetchReservations(page, statusFilter, productFilter)
    }

    function handlePrev() {
        const newPage = Math.max(1, page - 1)
        setPage(newPage)
        void fetchReservations(newPage, statusFilter, productFilter)
    }

    function handleNext() {
        if (!meta.has_next) return
        const newPage = page + 1
        setPage(newPage)
        void fetchReservations(newPage, statusFilter, productFilter)
    }

    const totalPages = Math.max(1, Math.ceil(meta.total / meta.per_page))

    return (
        <Page>
            <PageHeader
                title="Inventory Reservations"
                description="Active, committed, and expired stock reservations"
            />

            <Section>
                {/* Filters */}
                <Card>
                    <div className="p-[var(--lb-space-4)]">
                        <div className="flex flex-col gap-[var(--lb-space-3)] sm:flex-row sm:items-end">
                            <div className="w-full sm:w-48">
                                <label
                                    className="mb-[var(--lb-space-1)] block text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]"
                                    htmlFor="status-filter"
                                >
                                    Status
                                </label>
                                <Select
                                    id="status-filter"
                                    options={STATUS_OPTIONS}
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                />
                            </div>
                            <div className="flex-1">
                                <label
                                    className="mb-[var(--lb-space-1)] block text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]"
                                    htmlFor="product-filter"
                                >
                                    Product ID
                                </label>
                                <Input
                                    id="product-filter"
                                    placeholder="Filter by product UUID"
                                    value={productFilter}
                                    onChange={(e) => setProductFilter(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleApply()
                                    }}
                                />
                            </div>
                            <div className="flex gap-[var(--lb-space-2)]">
                                <Button variant="primary" size="sm" onClick={handleApply} disabled={loading}>
                                    Apply
                                </Button>
                                {(statusFilter || productFilter) && (
                                    <Button variant="ghost" size="sm" onClick={handleClear} disabled={loading}>
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

                {/* Error */}
                {error && (
                    <Banner
                        variant="critical"
                        title="Failed to load reservations"
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
                            <EmptyState
                                kind="inventory"
                                title="No reservations found"
                                body={
                                    statusFilter || productFilter
                                        ? 'No reservations match your filters.'
                                        : 'Inventory reservations appear here when stock is held for an order.'
                                }
                            />
                        </div>
                    ) : !error ? (
                        <>
                            {/* Desktop table */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-[length:var(--lb-font-size-sm)]">
                                    <thead>
                                        <tr className="border-b border-[var(--lb-color-border-subtle)] bg-[var(--lb-color-surface-subdued)]">
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Status</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Product</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Qty</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Order</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Expires</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr
                                                key={row.id}
                                                className="border-b border-[var(--lb-color-border-subtle)] last:border-0 hover:bg-[var(--lb-color-surface-hovered)]"
                                            >
                                                <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                    <Badge
                                                        label={statusLabel(row.status)}
                                                        variant={statusVariant(row.status)}
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
                                                <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                    {row.quantity}
                                                </td>
                                                <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                    <span className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                                                        {row.order_id ? row.order_id.slice(0, 8) + '…' : '—'}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-secondary)]">
                                                    {row.expires_at ? formatIndiaDate(row.expires_at) : '—'}
                                                </td>
                                                <td className="whitespace-nowrap px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-secondary)]">
                                                    {row.created_at ? formatIndiaDate(row.created_at) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="flex flex-col divide-y divide-[var(--lb-color-border-subtle)] sm:hidden">
                                {rows.map((row) => (
                                    <div key={row.id} className="flex flex-col gap-[var(--lb-space-2)] p-[var(--lb-space-4)]">
                                        <div className="flex items-center justify-between">
                                            <Badge label={statusLabel(row.status)} variant={statusVariant(row.status)} />
                                            <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                Qty: {row.quantity}
                                            </span>
                                        </div>
                                        <p className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                            {row.products?.name ?? '—'}
                                        </p>
                                        {row.order_id && (
                                            <p className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                                                Order: {row.order_id.slice(0, 8)}…
                                            </p>
                                        )}
                                        {row.expires_at && (
                                            <p className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                                                Expires: {formatIndiaDate(row.expires_at)}
                                            </p>
                                        )}
                                        <p className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-tertiary)]">
                                            {row.created_at ? formatIndiaDate(row.created_at) : '—'}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {meta.total > meta.per_page && (
                                <div className="flex items-center justify-between border-t border-[var(--lb-color-border-subtle)] px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                    <span className="text-[length:var(--lb-font-size-sm)] text-[var(--lb-color-text-secondary)]">
                                        Page {meta.page} of {totalPages} &bull; {meta.total} records
                                    </span>
                                    <div className="flex gap-[var(--lb-space-2)]">
                                        <Button variant="ghost" size="sm" onClick={handlePrev} disabled={page <= 1 || loading}>
                                            Previous
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={handleNext} disabled={!meta.has_next || loading}>
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
