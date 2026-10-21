'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

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
    Skeleton,
    Table,
    useToast,
    type StatusVariant,
} from '@letbuyy/ui'
import { formatIndiaDate } from '@letbuyy/ui/formatting'

// ── types ─────────────────────────────────────────────────────────────────────
// Gateway merges purchase_order_receipts + inventory_transfer_receipts:
// id, receipt_type, purchase_order_id, transfer_id, quantity_received,
// notes, received_at, created_at

type ReceiptType = 'purchase_order' | 'transfer'

interface ReceiptRow {
    id: string
    receipt_type: ReceiptType
    purchase_order_id: string | null
    transfer_id: string | null
    quantity_received: number
    notes: string | null
    received_at: string | null
    created_at: string
}

interface PageMeta {
    total: number
    page: number
    per_page: number
    has_next: boolean
}

// ── helpers ───────────────────────────────────────────────────────────────────

function receiptVariant(type: ReceiptType): StatusVariant {
    return type === 'purchase_order' ? 'info' : 'success'
}

function receiptLabel(type: ReceiptType): string {
    return type === 'purchase_order' ? 'PO Receipt' : 'Transfer Receipt'
}

function normalizeRow(raw: Record<string, unknown>): ReceiptRow {
    return {
        id: String(raw.id ?? ''),
        receipt_type: (raw.receipt_type === 'transfer' ? 'transfer' : 'purchase_order') as ReceiptType,
        purchase_order_id: typeof raw.purchase_order_id === 'string' ? raw.purchase_order_id : null,
        transfer_id: typeof raw.transfer_id === 'string' ? raw.transfer_id : null,
        quantity_received: typeof raw.quantity_received === 'number' ? raw.quantity_received : 0,
        notes: typeof raw.notes === 'string' ? raw.notes : null,
        received_at: typeof raw.received_at === 'string' ? raw.received_at : null,
        created_at: typeof raw.created_at === 'string' ? raw.created_at : '',
    }
}

// ── main component ─────────────────────────────────────────────────────────────

export default function InventoryReceiptsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()

    const [rows, setRows] = useState<ReceiptRow[]>([])
    const [meta, setMeta] = useState<PageMeta>({ total: 0, page: 1, per_page: 20, has_next: false })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [poFilter, setPoFilter] = useState('')
    const [transferFilter, setTransferFilter] = useState('')
    const [page, setPage] = useState(1)

    const beginRead = useReadRequest(store)
    const fetchReceipts = useCallback(
        async (currentPage: number, currentPo: string, currentTransfer: string) => {
            const request = beginRead()
            setLoading(true)
            setError(null)
            try {
                const url = new URL(
                    `/api/stores/${encodeURIComponent(store)}/inventory/receipts`,
                    window.location.origin
                )
                url.searchParams.set('page', String(currentPage))
                url.searchParams.set('limit', '20')
                if (currentPo.trim()) url.searchParams.set('po_id', currentPo.trim())
                if (currentTransfer.trim()) url.searchParams.set('transfer_id', currentTransfer.trim())

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
                              : 'Failed to load receipts'
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
        void fetchReceipts(1, '', '')
    }, [fetchReceipts])

    function handleApply() {
        setPage(1)
        void fetchReceipts(1, poFilter, transferFilter)
    }

    function handleClear() {
        setPoFilter('')
        setTransferFilter('')
        setPage(1)
        void fetchReceipts(1, '', '')
    }

    function handleRefresh() {
        void fetchReceipts(page, poFilter, transferFilter)
    }

    function handlePrev() {
        const newPage = Math.max(1, page - 1)
        setPage(newPage)
        void fetchReceipts(newPage, poFilter, transferFilter)
    }

    function handleNext() {
        if (!meta.has_next) return
        const newPage = page + 1
        setPage(newPage)
        void fetchReceipts(newPage, poFilter, transferFilter)
    }

    const totalPages = Math.max(1, Math.ceil(meta.total / meta.per_page))
    const hasFilters = poFilter.trim() !== '' || transferFilter.trim() !== ''

    return (
        <Page>
            <PageHeader
                title="Receipt History"
                description="Goods received from purchase orders and inventory transfers"
            />

            <Section>
                {/* Filters */}
                <Card>
                    <div className="p-[var(--lb-space-4)]">
                        <div className="flex flex-col gap-[var(--lb-space-3)] sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <label
                                    className="mb-[var(--lb-space-1)] block text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]"
                                    htmlFor="po-filter"
                                >
                                    Purchase Order ID
                                </label>
                                <Input
                                    id="po-filter"
                                    placeholder="Filter by PO UUID"
                                    value={poFilter}
                                    onChange={(e) => setPoFilter(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
                                />
                            </div>
                            <div className="flex-1">
                                <label
                                    className="mb-[var(--lb-space-1)] block text-[length:var(--lb-font-size-sm)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]"
                                    htmlFor="transfer-filter"
                                >
                                    Transfer ID
                                </label>
                                <Input
                                    id="transfer-filter"
                                    placeholder="Filter by Transfer UUID"
                                    value={transferFilter}
                                    onChange={(e) => setTransferFilter(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
                                />
                            </div>
                            <div className="flex gap-[var(--lb-space-2)]">
                                <Button variant="primary" size="sm" onClick={handleApply} disabled={loading}>
                                    Apply
                                </Button>
                                {hasFilters && (
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
                        title="Failed to load receipts"
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
                                title="No receipts found"
                                body={
                                    hasFilters
                                        ? 'No receipts match your filters.'
                                        : 'Receipt records appear here when purchase orders or transfers are received.'
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
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Type</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Linked ID</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Qty Received</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Notes</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Received</th>
                                            <th className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-secondary)]">Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => {
                                            const linkedId = row.purchase_order_id ?? row.transfer_id
                                            return (
                                                <tr
                                                    key={row.id}
                                                    className="border-b border-[var(--lb-color-border-subtle)] last:border-0 hover:bg-[var(--lb-color-surface-hovered)]"
                                                >
                                                    <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                        <Badge
                                                            label={receiptLabel(row.receipt_type)}
                                                            variant={receiptVariant(row.receipt_type)}
                                                        />
                                                    </td>
                                                    <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                        <span className="font-[length:var(--lb-font-size-xs)] font-[var(--lb-font-family-mono)] text-[var(--lb-color-text-secondary)]">
                                                            {linkedId ? linkedId.slice(0, 8) + '…' : '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-right font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                        {row.quantity_received}
                                                    </td>
                                                    <td className="max-w-xs px-[var(--lb-space-4)] py-[var(--lb-space-3)]">
                                                        <span className="block truncate text-[var(--lb-color-text-secondary)]">
                                                            {row.notes ?? '—'}
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-secondary)]">
                                                        {row.received_at ? formatIndiaDate(row.received_at) : '—'}
                                                    </td>
                                                    <td className="whitespace-nowrap px-[var(--lb-space-4)] py-[var(--lb-space-3)] text-[var(--lb-color-text-secondary)]">
                                                        {row.created_at ? formatIndiaDate(row.created_at) : '—'}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </Table>
                            </div>

                            {/* Mobile cards */}
                            <div className="flex flex-col divide-y divide-[var(--lb-color-border-subtle)] sm:hidden">
                                {rows.map((row) => {
                                    const linkedId = row.purchase_order_id ?? row.transfer_id
                                    return (
                                        <div key={row.id} className="flex flex-col gap-[var(--lb-space-2)] p-[var(--lb-space-4)]">
                                            <div className="flex items-center justify-between">
                                                <Badge label={receiptLabel(row.receipt_type)} variant={receiptVariant(row.receipt_type)} />
                                                <span className="font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-primary)]">
                                                    Qty: {row.quantity_received}
                                                </span>
                                            </div>
                                            {linkedId && (
                                                <p className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                                                    Linked: {linkedId.slice(0, 8)}…
                                                </p>
                                            )}
                                            {row.notes && (
                                                <p className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-secondary)]">
                                                    {row.notes}
                                                </p>
                                            )}
                                            <p className="text-[length:var(--lb-font-size-xs)] text-[var(--lb-color-text-tertiary)]">
                                                {row.received_at ? formatIndiaDate(row.received_at) : row.created_at ? formatIndiaDate(row.created_at) : '—'}
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
