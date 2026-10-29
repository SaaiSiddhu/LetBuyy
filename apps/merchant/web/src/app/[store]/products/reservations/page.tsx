'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useContext, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { InventoryReservationSchema, UuidSchema, type InventoryReservation, InventoryReservationStatusSchema } from '@letbuyy/shared-types'
import { MerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
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
    Table,
    useToast,
    type SelectOption,
    type StatusVariant,
} from '@letbuyy/ui'
import { formatIndiaDate } from '@letbuyy/ui/formatting'

// ── types ─────────────────────────────────────────────────────────────────────
// Gateway returns inventory_reservations rows:
// id, product_id, variant_id, location_id, quantity, status, expires_at,
// order_id, created_at, updated_at, products: { name, store_id }

type ReservationRow = InventoryReservation
type ReservationStatus = InventoryReservation['status']

interface PageMeta {
    store_id: string
    total: number
    page: number
    per_page: number
    has_next: boolean
}

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: SelectOption[] = [
    { value: '', label: 'All statuses' },
    ...InventoryReservationStatusSchema.options.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) })),
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

// ── main component ─────────────────────────────────────────────────────────────

export default function InventoryReservationsPage() {
    const { store } = useParams<{ store: string }>()
    const security = useContext(MerchantSecurityContext)
    return <InventoryReservationsWorkspace key={JSON.stringify([store, security?.actorId ?? null])} store={store} />
}

function InventoryReservationsWorkspace({ store }: { store: string }) {
    const { notify } = useToast()

    const [rows, setRows] = useState<ReservationRow[]>([])
    const [meta, setMeta] = useState<PageMeta>({ store_id: '', total: 0, page: 1, per_page: 20, has_next: false })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState('')
    const [productFilter, setProductFilter] = useState('')
    const [applied, setApplied] = useState({ status: '', product: '' })
    const [page, setPage] = useState(1)

    const beginRead = useReadRequest(store)
    const fetchReservations = useCallback(
        async (currentPage: number, currentStatus: string, currentProduct: string) => {
            const request = beginRead()
            setLoading(true)
            setError(null)
            setRows([])
            try {
                const url = new URL(
                    `/api/stores/${encodeURIComponent(store)}/inventory/reservations`,
                    window.location.origin
                )
                url.searchParams.set('page', String(currentPage))
                url.searchParams.set('limit', '20')
                if (currentStatus) url.searchParams.set('status', currentStatus)
                if (currentProduct.trim()) url.searchParams.set('product_id', currentProduct.trim())

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
                              : 'Failed to load reservations'
                    throw new Error(msg)
                }

                const normalized = InventoryReservationSchema.array().safeParse(json.data)
                if (!normalized.success || !json.meta || !UuidSchema.safeParse(json.meta.store_id).success ||
                    !Number.isSafeInteger(json.meta.total) || json.meta.total < 0 ||
                    json.meta.page !== currentPage || json.meta.per_page !== 20 || typeof json.meta.has_next !== 'boolean' ||
                    normalized.data.length > 20 || normalized.data.length > json.meta.total ||
                    normalized.data.some(row => row.store_id !== json.meta!.store_id || row.products.store_id !== json.meta!.store_id || (currentStatus && row.status !== currentStatus) || (currentProduct.trim() && row.product_id !== currentProduct.trim()))) {
                    throw new Error('Inventory records and counts could not be verified. Refresh to try again.')
                }
                setRows(normalized.data)
                setMeta(json.meta)
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
        void fetchReservations(1, '', '')
    }, [fetchReservations])

    function handleApply() {
        setApplied({ status: statusFilter, product: productFilter.trim() })
        setPage(1)
        void fetchReservations(1, statusFilter, productFilter)
    }

    function handleClear() {
        setApplied({ status: '', product: '' })
        setStatusFilter('')
        setProductFilter('')
        setPage(1)
        void fetchReservations(1, '', '')
    }

    function handleRefresh() {
        void fetchReservations(page, applied.status, applied.product)
    }

    function handlePrev() {
        const newPage = Math.max(1, page - 1)
        setPage(newPage)
        void fetchReservations(newPage, applied.status, applied.product)
    }

    function handleNext() {
        if (!meta.has_next) return
        const newPage = page + 1
        setPage(newPage)
        void fetchReservations(newPage, applied.status, applied.product)
    }

    const totalPages = Math.max(1, Math.ceil(meta.total / meta.per_page))

    return (
        <Page>
            <PageHeader identity="products"
                recipe="index"
                title="Inventory Reservations"
                description="Stock reservation states recorded by the server"
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
                            <div className="flex gap-[var(--lb-space-2)]">
                                <Button variant="ghost" size="sm" onClick={handleRefresh}>Try again</Button>
                                {page > 1 && <Button variant="ghost" size="sm" onClick={handlePrev}>Previous</Button>}
                            </div>
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
                                <Table className="w-full text-[length:var(--lb-font-size-sm)]">
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
                                </Table>
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
