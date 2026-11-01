'use client'

import { useEffect, useState, useCallback, useMemo, useRef, type SyntheticEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDebouncedValue, useReadRequest } from '@/lib/api/use-read-request'
import type { LineItem as SharedLineItem, Order as SharedOrder } from '@letbuyy/shared-types'
import { ORDER_STATUS_PRESENTATION, ORDER_PAYMENT_STATUS_PRESENTATION, presentStatus } from '@letbuyy/shared-types'
import { Badge, Banner, Button, Card, ConfirmDialog, Input, MaterialIcon, normalizeProviderMode, Page, PageHeader, ProviderModeBadge, Select, StatusPresentationBadge, Table, useToast, type ProviderMode, type TableBulkAction, type TableColumn } from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'
import { formatIndiaDate as formatDate } from '@letbuyy/ui/formatting'
import { StepUpDialog, type StepUpResult } from '@/components/security/StepUpDialog'

type OrderItemRow = Pick<
    SharedLineItem,
    'product_id' | 'variant_id' | 'variant_title' | 'sku' | 'quantity' | 'unit_price' | 'total'
> & {
    title: SharedLineItem['name']
    image?: SharedLineItem['image_url']
}

type OrderRow = Omit<
    Pick<
        SharedOrder,
        | 'id'
        | 'order_number'
        | 'customer_name'
        | 'customer_email'
        | 'customer_phone'
        | 'subtotal'
        | 'total'
        | 'coupon_code'
        | 'status'
        | 'payment_status'
        | 'shipping_method'
        | 'created_at'
        | 'tracking_number'
    >,
    never
> & {
    shipping_cost: SharedOrder['shipping_amount']
    tax: SharedOrder['tax_amount']
    discount: SharedOrder['discount_amount']
    coupon_discount?: SharedOrder['discount_amount']
    payment_method: string
    shipping_address?: Record<string, unknown>
    items: OrderItemRow[]
    item_count: number
}

interface OrdersPayload {
    data?: OrderRow[] | OrderRow
    meta?: {
        total?: number
        has_next?: boolean
        total_is_exact?: boolean
    }
    error?: unknown
    message?: unknown
}

type OrderStatus = 'all' | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
type OrderSortKey = 'status' | 'total' | 'created_at'
type SortDirection = 'asc' | 'desc'

const statuses: Array<{ label: string; value: OrderStatus }> = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Processing', value: 'processing' },
    { label: 'Shipped', value: 'shipped' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'Refunded', value: 'refunded' },
]

const paymentStatusOptions = [
    { label: 'All payments', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Paid', value: 'paid' },
    { label: 'Failed', value: 'failed' },
    { label: 'Refunded', value: 'refunded' },
]

function getErrorMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error
        if (typeof error === 'string') return error
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message
            if (typeof message === 'string') return message
        }
        const message = (payload as { message?: unknown }).message
        if (typeof message === 'string') return message
    }

    return fallback
}

function titleize(value: string | null | undefined) {
    const normalized = (value || 'unknown').replace(/[_-]+/g, ' ').trim().toLowerCase()
    return normalized
        .split(' ')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

function currency(amount: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)
}

function verifiedCurrency(amount: unknown) {
    return typeof amount === 'number' && Number.isFinite(amount) ? currency(amount) : '—'
}

function addressPart(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

function addressLine(address?: Record<string, unknown>) {
    if (!address) return '-'
    const parts = [
        addressPart(address.line1) || addressPart(address.address),
        addressPart(address.city),
        addressPart(address.state),
        addressPart(address.zip) || addressPart(address.pincode),
    ].filter(Boolean)

    return parts.length ? parts.join(', ') : '-'
}

// Presentation comes from the domain layer (@letbuyy/shared-types), which owns
// the vocabulary and its labels/tones; this file only renders it. The inline maps
// that used to live here were the Phase 1 stop-gap.
function OrderStatusBadge({ status }: { status: string }) {
    return <StatusPresentationBadge presentation={presentStatus(ORDER_STATUS_PRESENTATION, status)} />
}

function PaymentStatusBadge({ status, method }: { status: string; method: string }) {
    const presentation = presentStatus(ORDER_PAYMENT_STATUS_PRESENTATION, status)
    return method
        ? <StatusPresentationBadge presentation={{ ...presentation, label: `${method.toUpperCase()} / ${presentation.label}` }} />
        : <StatusPresentationBadge presentation={presentation} />
}

export default function OrdersPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const { notify } = useToast()
    const [orders, setOrders] = useState<OrderRow[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [totalExact, setTotalExact] = useState(false)
    const [hasNext, setHasNext] = useState(false)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<OrderStatus>('all')
    const [paymentFilter, setPaymentFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const appliedSearch = useDebouncedValue(searchQuery.trim())
    const [sortKey, setSortKey] = useState<OrderSortKey>('created_at')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
    const beginRead = useReadRequest(JSON.stringify([store, filter, paymentFilter, appliedSearch, page, pageSize, sortKey, sortDirection]))
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    /**
     * Idempotency keys, held stable for the lifetime of ONE user-initiated attempt.
     *
     * These were previously minted as `...-${crypto.randomUUID()}` inline on every
     * request, so two clicks produced two different keys and the gateway's replay
     * guard (IdempotencyExecutionAdapter.begin -> claim.kind === 'replay') could
     * never fire — the server-side protection was unreachable by construction.
     *
     * Keyed by the logical identity of the action, so a retry of the SAME attempt
     * reuses the key (and is de-duplicated server-side), while a genuinely
     * different action — a second refund for a different amount — gets its own.
     * Released on success so a later, legitimate repeat is not replayed.
     */
    const idempotencyKeys = useRef(new Map<string, string>())

    const stableIdempotencyKey = useCallback((identity: string) => {
        const existing = idempotencyKeys.current.get(identity)
        if (existing) return existing
        const minted = `${identity}-${crypto.randomUUID()}`
        idempotencyKeys.current.set(identity, minted)
        return minted
    }, [])

    const releaseIdempotencyKey = useCallback((identity: string) => {
        idempotencyKeys.current.delete(identity)
    }, [])
    const [fulfillingId, setFulfillingId] = useState<string | null>(null)
    const [trackingNumber, setTrackingNumber] = useState('')
    const [cancellingId, setCancellingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    // 'mock' until the fulfilment provider reports otherwise — an unresolved
    // provider must never start out looking like a working sandbox.
    const [fulfillmentProviderMode, setFulfillmentProviderMode] = useState<ProviderMode>('mock')

    // Refund state
    const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null)
    const [refundAmount, setRefundAmount] = useState('')
    const [refundReason, setRefundReason] = useState('')
    const [refundStepUpOpen, setRefundStepUpOpen] = useState(false)
    const [refundLoading, setRefundLoading] = useState(false)

    useEffect(() => { setPage(1) }, [filter, paymentFilter, appliedSearch])

    const loadOrders = useCallback(async () => {
        const request = beginRead()
        setLoading(true)
        setError(null)

        try {
            const query = new URLSearchParams({
                status: filter,
                payment_status: paymentFilter,
                page: String(page),
                limit: String(pageSize),
                sort: sortKey,
                order: sortDirection,
                withCount: 'true',
            })

            if (appliedSearch) query.set('search', appliedSearch)

            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/orders?${query.toString()}`, { signal: request.signal, cache: 'no-store' })
            const payload = await response.json().catch(() => null) as OrdersPayload | null
            if (!request.isCurrent()) return

            if (!response.ok) {
                setOrders([])
                setTotalCount(0)
                setTotalExact(false)
                setHasNext(false)
                setError(getErrorMessage(payload, 'Unable to load orders'))
                return
            }

            if (!Array.isArray(payload?.data)) throw new Error('Orders response is incomplete')
            const rows = payload.data
            setOrders(rows)
            setTotalCount(typeof payload?.meta?.total === 'number' ? payload.meta.total : rows.length)
            setTotalExact(Boolean(payload?.meta?.total_is_exact))
            setHasNext(Boolean(payload?.meta?.has_next))
            if (page > 1 && rows.length === 0) setPage(1)
        } catch {
            if (!request.isCurrent()) return
            setOrders([])
            setTotalCount(0)
            setTotalExact(false)
            setHasNext(false)
            setError('Unable to load orders')
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [store, filter, paymentFilter, appliedSearch, page, pageSize, sortKey, sortDirection, beginRead])

    useEffect(() => { loadOrders() }, [loadOrders])

    useEffect(() => {
        let active = true
        async function loadFulfillmentProviderMode() {
            try {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/shipping/zones`, { cache: 'no-store' })
                const payload = await response.json().catch(() => null) as { data?: { provider_mode?: unknown } } | null
                if (active && response.ok) {
                    setFulfillmentProviderMode(normalizeProviderMode(payload?.data?.provider_mode))
                }
            } catch {
                // A failed read leaves the mode UNRESOLVED, which is 'mock' — not a
                // silent absence and not an implied sandbox.
                if (active) setFulfillmentProviderMode('mock')
            }
        }

        void loadFulfillmentProviderMode()
        return () => { active = false }
    }, [store])

    const updateOrderStatus = async (
        orderId: string,
        status: string,
        metadata: Record<string, string | null> = {}
    ) => {
        // Re-entry guard. ConfirmDialog cannot disable its own confirm button
        // (no loading/confirmDisabled prop), and handleCancel only closes the
        // dialog AFTER the awaited PATCH — so the destructive button stayed live
        // for the whole round-trip and was click-spammable. Mirrors the guard
        // already used at products/gift-cards (`if (creating) return`).
        if (updatingId) return false

        const identity = `admin-order-${orderId}-${status}`
        setUpdatingId(orderId)
        setActionError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/orders/${encodeURIComponent(orderId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idempotency_key: stableIdempotencyKey(identity),
                    status,
                    ...metadata,
                }),
            })
            const payload = await response.json().catch(() => null) as OrdersPayload | null

            if (!response.ok) {
                const message = getErrorMessage(payload, 'Unable to update order')
                setActionError(message)
                notify({
                    title: 'Order update failed',
                    description: message,
                    variant: 'critical',
                })
                return false
            }

            // Attempt finished. Drop the key so a later, legitimate repeat of this
            // same transition is a NEW request rather than a replayed response.
            releaseIdempotencyKey(identity)

            await loadOrders()
            const order = orders.find(item => item.id === orderId)
            notify({
                title: `Order marked ${titleize(status)}`,
                description: `${order?.order_number || orderId.slice(0, 8)} was updated successfully.`,
                variant: 'success',
            })
            return true
        } catch {
            const message = 'Unable to update order'
            setActionError(message)
            notify({
                title: 'Order update failed',
                description: message,
                variant: 'critical',
            })
            return false
        } finally {
            setUpdatingId(null)
        }
    }

    const handleFulfill = async (orderId: string) => {
        const ok = await updateOrderStatus(orderId, 'shipped', {
            tracking_number: trackingNumber.trim() || null,
        })
        if (ok) {
            setFulfillingId(null)
            setTrackingNumber('')
        }
    }

    const handleCancel = async (orderId: string) => {
        const ok = await updateOrderStatus(orderId, 'cancelled', {
            cancellation_reason: 'Cancelled from admin orders screen',
        })
        if (ok) setCancellingId(null)
    }

    const bulkUpdateOrderStatus = useCallback(async (
        rows: OrderRow[],
        nextStatus: Exclude<OrderStatus, 'all'>,
        eligibleStatuses: string[],
        label: string
    ) => {
        const eligibleRows = rows.filter(order => eligibleStatuses.includes(order.status))
        const skippedCount = rows.length - eligibleRows.length
        if (eligibleRows.length === 0) {
            notify({
                title: 'No eligible orders selected',
                description: `${label} only applies to ${eligibleStatuses.map(titleize).join(', ')} orders.`,
                variant: 'warning',
            })
            return
        }

        setUpdatingId(`bulk-${nextStatus}`)
        setActionError(null)
        let failures = 0

        for (const order of eligibleRows) {
            try {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/orders/${encodeURIComponent(order.id)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idempotency_key: stableIdempotencyKey(`admin-order-bulk-${order.id}-${nextStatus}`),
                        status: nextStatus,
                    }),
                })
                if (!response.ok) failures += 1
            } catch {
                failures += 1
            }
        }

        await loadOrders()
        setUpdatingId(null)

        // A partial skip used to be silent: the completion message counted only the rows that were
        // eligible, so selecting every visible order and confirming could act on a fraction of them
        // without saying so. That matters more now that the Pending tab also lists pending_cod orders,
        // which a plain status change cannot confirm (COD has its own flow).
        if (skippedCount > 0 && failures === 0) {
            notify({
                title: `${label.charAt(0).toUpperCase()}${label.slice(1)} applied to ${eligibleRows.length} of ${rows.length} selected`,
                description: `${skippedCount} selected ${skippedCount === 1 ? 'order was' : 'orders were'} not eligible and ${skippedCount === 1 ? 'was' : 'were'} left unchanged.`,
                variant: 'warning',
            })
        }

        if (failures > 0) {
            notify({
                title: 'Some orders were not updated',
                description: `${eligibleRows.length - failures} of ${eligibleRows.length} eligible orders were updated.`,
                variant: 'warning',
            })
            return
        }

        notify({
            title: 'Orders updated',
            description: `${eligibleRows.length} ${eligibleRows.length === 1 ? 'order' : 'orders'} ${label.toLowerCase()}.`,
            variant: 'success',
        })
    }, [loadOrders, notify, store])

    const handleRefundStepUpSuccess = useCallback(async (result: StepUpResult) => {
        if (!refundingOrderId) return
        setRefundLoading(true)
        setRefundStepUpOpen(false)
        setActionError(null)
        try {
            const amountMinor = refundAmount.trim()
                ? Math.round(parseFloat(refundAmount.trim()) * 100)
                : undefined
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/orders/${encodeURIComponent(refundingOrderId)}/refund`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Merchant-Context': result.actorId, 'X-Idempotency-Key': stableIdempotencyKey(`refund-${refundingOrderId}-${amountMinor ?? 'full'}`) },
                    body: JSON.stringify({
                        // Amount is part of the identity: two refunds of different amounts are
                        // different financial events and must NOT share a key, while a
                        // double-click on one refund must.
                        idempotency_key: stableIdempotencyKey(`refund-${refundingOrderId}-${amountMinor ?? 'full'}`),
                        ...(amountMinor != null ? { amount_minor: amountMinor } : {}),
                        ...(refundReason.trim() ? { reason: refundReason.trim() } : {}),
                        // provider_refund_id intentionally omitted: the gateway creates
                        // the Razorpay refund itself when the id is absent (LB-3).
                        step_up_token: result.token,
                        step_up_verified_at: result.verifiedAt,
                    }),
                }
            )
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                const message = getErrorMessage(payload, 'Unable to process refund')
                setActionError(message)
                notify({ title: 'Refund failed', description: message, variant: 'critical' })
                return
            }
            if (response.status === 202 || payload?.data?.pending === true) {
                const message = payload?.data?.reconciliation === 'operator_attention_required'
                    ? 'The refund outcome needs reconciliation. Review the existing attempt before trying another refund.'
                    : 'The provider has not confirmed this refund yet. Wait for confirmation before recording another refund.'
                setActionError(message)
                notify({ title: 'Refund awaiting confirmation', description: message, variant: 'warning' })
                return
            }
            notify({ title: 'Refund recorded', description: 'The refund has been submitted successfully.', variant: 'success' })
            setRefundingOrderId(null)
            setRefundAmount('')
            setRefundReason('')
            await loadOrders()
        } catch {
            const message = 'Unable to process refund'
            setActionError(message)
            notify({ title: 'Refund failed', description: message, variant: 'critical' })
        } finally {
            setRefundLoading(false)
        }
    }, [store, refundingOrderId, refundAmount, refundReason, loadOrders, notify])

    const orderToCancel = orders.find(order => order.id === cancellingId) || null
    const activeFilters = [
        filter !== 'all' ? { label: `Status: ${titleize(filter)}`, onRemove: () => setFilter('all') } : null,
        paymentFilter !== 'all' ? { label: `Payment: ${titleize(paymentFilter)}`, onRemove: () => setPaymentFilter('all') } : null,
    ].filter(Boolean) as Array<{ label: string; onRemove: () => void }>

    const handleSort = useCallback((key: string) => {
        const nextKey = key as OrderSortKey
        if (!['created_at', 'total', 'status'].includes(nextKey)) return
        if (nextKey === sortKey) {
            setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
            setPage(1)
            return
        }
        setSortKey(nextKey)
        setSortDirection(nextKey === 'created_at' ? 'desc' : 'asc')
        setPage(1)
    }, [sortKey])

    const bulkActions = useMemo<Array<TableBulkAction<OrderRow>>>(() => [
        {
            label: 'Confirm selected',
            onAction: rows => { void bulkUpdateOrderStatus(rows, 'confirmed', ['pending'], 'confirmed') },
        },
        {
            label: 'Mark processing',
            onAction: rows => { void bulkUpdateOrderStatus(rows, 'processing', ['confirmed'], 'marked processing') },
        },
        {
            label: 'Mark delivered',
            onAction: rows => { void bulkUpdateOrderStatus(rows, 'delivered', ['shipped'], 'marked delivered') },
        },
    ], [bulkUpdateOrderStatus])

    const emptyState = (
        <EmptyState scene="orders"
            icon={<MaterialIcon name={error ? 'error' : 'receipt_long'} />}
            title={error ? 'Unable to load orders' : 'No orders yet'}
            body={error || (filter !== 'all' ? `No ${titleize(filter).toLowerCase()} orders found in this view.` : 'Orders will appear here once customers start purchasing.')}
            primaryAction={error ? (
                <Button onClick={loadOrders}>
                    <MaterialIcon name="refresh" />
                    Retry
                </Button>
            ) : undefined}
            secondaryAction={!error && (filter !== 'all' || paymentFilter !== 'all' || searchQuery.trim()) ? (
                <Button variant="secondary" onClick={() => {
                    setFilter('all')
                    setPaymentFilter('all')
                    setSearchQuery('')
                }}>
                    Clear filters
                </Button>
            ) : undefined}
        />
    )

    const columns: Array<TableColumn<OrderRow>> = [
        {
            key: 'order',
            header: 'Order',
            render: (order) => (
                <div className="space-y-[var(--lb-space-1)]">
                    <Button unstyled
                        type="button"
                        className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-primary)] hover:text-[var(--lb-color-primary-hover)]"
                        onClick={(event) => {
                            event.stopPropagation()
                            router.push(`/${store}/orders/${encodeURIComponent(order.id)}`)
                        }}
                    >
                        {order.order_number || order.id.slice(0, 8)}
                    </Button>
                    {order.coupon_code && (
                        <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-success)]">
                            Coupon {order.coupon_code}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'customer',
            header: 'Customer',
            render: (order) => (
                <div className="space-y-[var(--lb-space-1)]">
                    <p className="m-0 font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">
                        {order.customer_name || 'Customer'}
                    </p>
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        {order.customer_email || '-'}
                    </p>
                </div>
            ),
        },
        {
            key: 'item_count',
            header: 'Items',
            render: (order) => Number.isSafeInteger(order.item_count) ? String(order.item_count) : '—',
        },
        {
            key: 'payment_status',
            header: 'Payment',
            render: (order) => <PaymentStatusBadge status={order.payment_status} method={order.payment_method} />,
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (order) => <OrderStatusBadge status={order.status} />,
        },
        {
            key: 'total',
            header: 'Total',
            sortable: true,
            render: (order) => verifiedCurrency(order.total),
        },
        {
            key: 'created_at',
            header: 'Date',
            sortable: true,
            render: (order) => formatDate(order.created_at),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (order) => (
                <OrderActions
                    order={order}
                    updating={updatingId === order.id}
                    fulfilling={fulfillingId === order.id}
                    refunding={refundingOrderId === order.id}
                    refundLoading={refundLoading && refundingOrderId === order.id}
                    refundAmount={refundingOrderId === order.id ? refundAmount : ''}
                    refundReason={refundingOrderId === order.id ? refundReason : ''}
                    onRefundAmountChange={setRefundAmount}
                    onRefundReasonChange={setRefundReason}
                    trackingNumber={trackingNumber}
                    onTrackingChange={setTrackingNumber}
                    onStatusChange={updateOrderStatus}
                    onStartFulfill={() => {
                        setFulfillingId(order.id)
                        setCancellingId(null)
                    }}
                    onCancelFulfill={() => {
                        setFulfillingId(null)
                        setTrackingNumber('')
                    }}
                    onFulfill={() => handleFulfill(order.id)}
                    onStartCancel={() => {
                        setCancellingId(order.id)
                        setFulfillingId(null)
                    }}
                    onStartRefund={() => {
                        setRefundingOrderId(order.id)
                        setRefundAmount(String(order.total || ''))
                        setRefundReason('')
                        setCancellingId(null)
                        setFulfillingId(null)
                    }}
                    onCancelRefund={() => {
                        setRefundingOrderId(null)
                        setRefundAmount('')
                        setRefundReason('')
                    }}
                    onConfirmRefund={() => setRefundStepUpOpen(true)}
                    providerMode={fulfillmentProviderMode}
                />
            ),
        },
    ]

    return (
        <Page>
            <PageHeader identity="orders"
                recipe="index"
                eyebrow="Operations"
                title="Orders"
                description="Review purchases, confirm payment, ship orders, and keep fulfillment moving."
                breadcrumbs={[{ label: 'Home', href: `/${store}/dashboard` }, { label: 'Orders' }]}
                secondaryActions={[{ label: 'Products', href: `/${store}/products` }]}
            />

            <Card as="div" className="overflow-visible p-[var(--lb-density-card-padding)]">
                {actionError && <Banner title="Order action failed" variant="critical">{actionError}</Banner>}
                <Table
                    rows={orders}
                    columns={columns}
                    loading={loading}
                    appearance="flat"
                    hideHeaderWhenEmpty={false}
                    emptyState={emptyState}
                    savedViews={statuses}
                    activeView={filter}
                    onViewChange={(value) => setFilter(value as OrderStatus)}
                    search={{ label: 'Search orders', placeholder: 'Search order number or customer', value: searchQuery, onChange: setSearchQuery }}
                    filterContent={<div className="grid gap-[var(--lb-space-3)]"><strong className="text-[length:var(--lb-font-size-body)]">Filter orders</strong><Select label="Payment" value={paymentFilter} options={paymentStatusOptions} onChange={(event) => setPaymentFilter(event.target.value)} /><Button variant="secondary" size="sm" onClick={loadOrders}><MaterialIcon name="sync" />Refresh orders</Button></div>}
                    filterChips={activeFilters}
                    bulkActions={bulkActions}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    preferencesKey={`letbuyy.table.orders:${store}`}
                    selectionScopeKey={`${store}:${filter}:${paymentFilter}:${appliedSearch}:${page}:${pageSize}`}
                    pagination={{ page, pageSize, total: totalExact ? totalCount : undefined, hasNext, itemLabel: 'orders', onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1) } }}
                    onRowClick={(order) => router.push(`/${store}/orders/${encodeURIComponent(order.id)}`)}
                />
            </Card>

            <ConfirmDialog
                open={Boolean(orderToCancel)}
                title="Cancel order?"
                description={`Cancel ${orderToCancel?.order_number || 'this order'} and stop fulfillment from continuing.`}
                confirmLabel="Cancel order"
                destructive
                onClose={() => setCancellingId(null)}
                onConfirm={() => {
                    if (orderToCancel) {
                        void handleCancel(orderToCancel.id)
                    }
                }}
            />

            <StepUpDialog
                store={store}
                action="refund.approve"
                open={refundStepUpOpen}
                onSuccess={(result) => { void handleRefundStepUpSuccess(result) }}
                onClose={() => {
                    setRefundStepUpOpen(false)
                    setRefundingOrderId(null)
                    setRefundAmount('')
                    setRefundReason('')
                }}
            />
        </Page>
    )
}

function OrderActions({
    order,
    updating,
    fulfilling,
    refunding,
    refundLoading,
    refundAmount,
    refundReason,
    onRefundAmountChange,
    onRefundReasonChange,
    trackingNumber,
    onTrackingChange,
    onStatusChange,
    onStartFulfill,
    onCancelFulfill,
    onFulfill,
    onStartCancel,
    onStartRefund,
    onCancelRefund,
    onConfirmRefund,
    providerMode,
}: {
    order: OrderRow
    updating: boolean
    fulfilling: boolean
    refunding: boolean
    refundLoading: boolean
    refundAmount: string
    refundReason: string
    onRefundAmountChange: (value: string) => void
    onRefundReasonChange: (value: string) => void
    trackingNumber: string
    onTrackingChange: (value: string) => void
    onStatusChange: (orderId: string, status: string) => void
    onStartFulfill: () => void
    onCancelFulfill: () => void
    onFulfill: () => void
    onStartCancel: () => void
    onStartRefund: () => void
    onCancelRefund: () => void
    onConfirmRefund: () => void
    providerMode: ProviderMode
}) {
    const stop = (event: SyntheticEvent) => event.stopPropagation()
    const canRefund = order.payment_status === 'paid'

    return (
        <div className="flex min-w-[calc(var(--lb-size-control-lg)*4)] flex-col items-end gap-[var(--lb-space-2)]" onClick={stop}>
            <div className="flex flex-wrap justify-end gap-[var(--lb-space-2)]">
                {order.status === 'pending' && (
                    <Button size="sm" loading={updating} onClick={() => onStatusChange(order.id, 'confirmed')}>
                        Confirm
                    </Button>
                )}
                {order.status === 'confirmed' && (
                    <Button size="sm" loading={updating} onClick={() => onStatusChange(order.id, 'processing')}>
                        Process
                    </Button>
                )}
                {order.status === 'processing' && !fulfilling && (
                    <Button size="sm" loading={updating} onClick={onStartFulfill}>
                        Ship
                    </Button>
                )}
                {order.status === 'shipped' && (
                    <Button size="sm" loading={updating} onClick={() => onStatusChange(order.id, 'delivered')}>
                        Deliver
                    </Button>
                )}
                {['pending', 'confirmed', 'processing'].includes(order.status) && (
                    <Button size="sm" variant="destructive" loading={updating} onClick={onStartCancel}>
                        Cancel
                    </Button>
                )}
                {canRefund && !refunding && (
                    <Button size="sm" variant="secondary" loading={refundLoading} onClick={onStartRefund}>
                        Refund
                    </Button>
                )}
            </div>

            {fulfilling && (
                <div className="grid w-full gap-[var(--lb-space-2)] rounded-lg border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                    <div className="flex items-center justify-between gap-[var(--lb-space-2)]">
                        <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            Carrier provider
                        </span>
                        <ProviderModeBadge mode={providerMode} />
                    </div>
                    <Input
                        aria-label="Tracking number"
                        placeholder="Tracking number"
                        value={trackingNumber}
                        onChange={(event) => onTrackingChange(event.target.value)}
                    />
                    <div className="flex justify-end gap-[var(--lb-space-2)]">
                        <Button size="sm" loading={updating} onClick={onFulfill}>Ship</Button>
                        <Button size="sm" variant="ghost" onClick={onCancelFulfill}>Close</Button>
                    </div>
                </div>
            )}

            {refunding && (
                <div className="grid w-full gap-[var(--lb-space-2)] rounded-lg border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                    <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Issue refund
                    </span>
                    <Input
                        aria-label="Refund amount"
                        placeholder={`Full amount (${verifiedCurrency(order.total)})`}
                        value={refundAmount}
                        onChange={(event) => onRefundAmountChange(event.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                    />
                    <Input
                        aria-label="Refund reason"
                        placeholder="Reason (optional)"
                        value={refundReason}
                        onChange={(event) => onRefundReasonChange(event.target.value)}
                    />
                    <div className="flex justify-end gap-[var(--lb-space-2)]">
                        <Button size="sm" loading={refundLoading} onClick={onConfirmRefund}>
                            Verify and refund
                        </Button>
                        <Button size="sm" variant="ghost" onClick={onCancelRefund}>Close</Button>
                    </div>
                </div>
            )}
        </div>
    )
}

function OrderDetail({ order }: { order: OrderRow }) {
    return (
        <div className="grid gap-[var(--lb-space-5)]">
            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-3">
                <DetailBlock
                    label="Customer"
                    value={order.customer_name || 'Customer'}
                    helper={order.customer_phone || order.customer_email || '-'}
                />
                <DetailBlock
                    label="Ship to"
                    value={addressLine(order.shipping_address)}
                />
                <DetailBlock
                    label="Fulfillment"
                    value={`${order.shipping_method || 'standard'}${order.tracking_number ? ` / ${order.tracking_number}` : ''}`}
                />
            </div>

            <div className="border-t border-[var(--lb-color-border)] pt-[var(--lb-space-4)]">
                {(order.items || []).length === 0 ? (
                    <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                        No item rows are available for this order.
                    </p>
                ) : (
                    <div className="grid gap-[var(--lb-space-3)]">
                        {order.items.map((item, index) => (
                            <div
                                key={`${item.product_id}-${index}`}
                                className="grid gap-[var(--lb-space-3)] lb-rounded-lg border border-[var(--lb-color-border)] p-[var(--lb-space-3)] md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
                            >
                                <div className="min-w-0">
                                    <p className="m-0 truncate font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                                        {item.title}
                                    </p>
                                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                        {[item.variant_title, item.sku].filter(Boolean).join(' / ') || '-'}
                                    </p>
                                </div>
                                <div className="text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                    {item.quantity} x {currency(item.unit_price)}
                                </div>
                                <div className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                                    {currency(item.total)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end">
                <div className="grid w-full max-w-[var(--lb-size-tooltip-max-width)] gap-[var(--lb-space-2)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]">
                    <OrderAmountLine label="Subtotal" value={verifiedCurrency(order.subtotal)} />
                    <OrderAmountLine label="Shipping" value={verifiedCurrency(order.shipping_cost)} />
                    <OrderAmountLine label={order.coupon_code ? `Coupon (${order.coupon_code})` : 'Discount'} value={typeof order.discount === 'number' && Number.isFinite(order.discount) ? `−${currency(order.discount)}` : '—'} />
                    <OrderAmountLine label="Tax" value={verifiedCurrency(order.tax)} />
                    <div className="flex justify-between border-t border-[var(--lb-color-border)] pt-[var(--lb-space-2)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                        <span>Total</span>
                        <span>{verifiedCurrency(order.total)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function DetailBlock({ label, value, helper }: { label: string; value: string; helper?: string }) {
    return (
        <div>
            <p className="m-0 text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] uppercase leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                {label}
            </p>
            <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                {value}
            </p>
            {helper && (
                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {helper}
                </p>
            )}
        </div>
    )
}

function OrderAmountLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between text-[var(--lb-color-text-subdued)]">
            <span>{label}</span>
            <span>{value}</span>
        </div>
    )
}
