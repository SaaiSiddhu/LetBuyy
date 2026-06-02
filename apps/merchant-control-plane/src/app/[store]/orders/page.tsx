'use client'

import { useEffect, useState, useCallback, useMemo, type SyntheticEvent } from 'react'
import { useParams } from 'next/navigation'
import type { LineItem as SharedLineItem, Order as SharedOrder } from '@letbuyy/shared-types'
import {
    Badge,
    Banner,
    Button,
    Card,
    ConfirmDialog,
    EmptyState,
    IndexTable,
    Input,
    MaterialIcon,
    Page,
    PageHeader,
    Search,
    Section,
    Select,
    Skeleton,
    useToast,
    type IndexTableColumn,
    type IndexTableBulkAction,
} from '@letbuyy/ui'

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
    }
    error?: unknown
    message?: unknown
}

type OrderStatus = 'all' | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
type OrderSortKey = 'order' | 'customer' | 'item_count' | 'payment_status' | 'status' | 'total' | 'created_at'
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

function formatDate(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })
}

function currency(amount: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)
}

function orderSortValue(order: OrderRow, key: OrderSortKey): string | number {
    switch (key) {
        case 'order':
            return order.order_number || order.id
        case 'customer':
            return order.customer_name || order.customer_email || ''
        case 'item_count':
            return Number(order.item_count || order.items?.length || 0)
        case 'payment_status':
            return order.payment_status || ''
        case 'status':
            return order.status || ''
        case 'total':
            return Number(order.total || 0)
        case 'created_at':
            return new Date(order.created_at || '').getTime() || 0
        default:
            return ''
    }
}

function compareOrderRows(a: OrderRow, b: OrderRow, key: OrderSortKey, direction: SortDirection) {
    const aValue = orderSortValue(a, key)
    const bValue = orderSortValue(b, key)
    const result = typeof aValue === 'number' && typeof bValue === 'number'
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' })
    return direction === 'asc' ? result : -result
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

function statusVariant(status: string) {
    const normalized = status.toLowerCase()
    if (['delivered', 'paid'].includes(normalized)) return 'success'
    if (['cancelled', 'refunded', 'failed'].includes(normalized)) return 'critical'
    if (['shipped', 'processing', 'confirmed'].includes(normalized)) return 'info'
    return 'warning'
}

function OrderStatusBadge({ status }: { status: string }) {
    return <Badge label={titleize(status)} variant={statusVariant(status)} />
}

function PaymentStatusBadge({ status, method }: { status: string; method: string }) {
    const label = method ? `${method.toUpperCase()} / ${titleize(status)}` : titleize(status)
    return <Badge label={label} variant={statusVariant(status)} />
}

export default function OrdersPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [orders, setOrders] = useState<OrderRow[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<OrderStatus>('all')
    const [paymentFilter, setPaymentFilter] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
    const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [fulfillingId, setFulfillingId] = useState<string | null>(null)
    const [trackingNumber, setTrackingNumber] = useState('')
    const [cancellingId, setCancellingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [sortKey, setSortKey] = useState<OrderSortKey>('created_at')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

    const loadOrders = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const query = new URLSearchParams({
                status: filter,
                payment_status: paymentFilter,
                limit: '50',
            })

            if (searchQuery.trim()) query.set('search', searchQuery.trim())

            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/orders?${query.toString()}`)
            const payload = await response.json().catch(() => null) as OrdersPayload | null

            if (!response.ok) {
                setOrders([])
                setTotalCount(0)
                setError(getErrorMessage(payload, 'Unable to load orders'))
                return
            }

            const rows = Array.isArray(payload?.data) ? payload.data : []
            setOrders(rows)
            setTotalCount(Number(payload?.meta?.total || rows.length || 0))
        } catch {
            setOrders([])
            setTotalCount(0)
            setError('Unable to load orders')
        } finally {
            setLoading(false)
        }
    }, [store, filter, paymentFilter, searchQuery])

    useEffect(() => { loadOrders() }, [loadOrders])

    const loadOrderDetail = async (order: OrderRow) => {
        if (expandedOrderId === order.id) {
            setExpandedOrderId(null)
            return
        }

        if (order.items?.length) {
            setExpandedOrderId(order.id)
            return
        }

        setExpandedOrderId(order.id)
        setLoadingDetailId(order.id)
        setActionError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/orders/${encodeURIComponent(order.id)}`)
            const payload = await response.json().catch(() => null) as OrdersPayload | null

            if (!response.ok) {
                setActionError(getErrorMessage(payload, 'Unable to load order details'))
                return
            }

            if (payload?.data && !Array.isArray(payload.data)) {
                setOrders(current => current.map(item => item.id === order.id ? payload.data as OrderRow : item))
            }
        } catch {
            setActionError('Unable to load order details')
        } finally {
            setLoadingDetailId(null)
        }
    }

    const updateOrderStatus = async (
        orderId: string,
        status: string,
        metadata: Record<string, string | null> = {}
    ) => {
        setUpdatingId(orderId)
        setActionError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/orders/${encodeURIComponent(orderId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idempotency_key: `admin-order-${orderId}-${status}-${crypto.randomUUID()}`,
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
                        idempotency_key: `admin-order-bulk-${order.id}-${nextStatus}-${crypto.randomUUID()}`,
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

    const activeOrder = orders.find(order => order.id === expandedOrderId) || null
    const orderToCancel = orders.find(order => order.id === cancellingId) || null
    const activeFilters = [
        filter !== 'all' ? { label: `Status: ${titleize(filter)}`, onRemove: () => setFilter('all') } : null,
        paymentFilter !== 'all' ? { label: `Payment: ${titleize(paymentFilter)}`, onRemove: () => setPaymentFilter('all') } : null,
        searchQuery.trim() ? { label: `Search: ${searchQuery.trim()}`, onRemove: () => setSearchQuery('') } : null,
    ].filter(Boolean) as Array<{ label: string; onRemove: () => void }>

    const sortedOrders = useMemo(() => {
        return [...orders].sort((a, b) => compareOrderRows(a, b, sortKey, sortDirection))
    }, [orders, sortDirection, sortKey])

    const handleSort = useCallback((key: string) => {
        const nextKey = key as OrderSortKey
        if (nextKey === sortKey) {
            setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
            return
        }
        setSortKey(nextKey)
        setSortDirection(nextKey === 'created_at' ? 'desc' : 'asc')
    }, [sortKey])

    const bulkActions = useMemo<Array<IndexTableBulkAction<OrderRow>>>(() => [
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
        <EmptyState
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

    const columns: Array<IndexTableColumn<OrderRow>> = [
        {
            key: 'order',
            header: 'Order',
            sortable: true,
            render: (order) => (
                <div className="space-y-[var(--lb-space-1)]">
                    <button
                        type="button"
                        className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-primary)] hover:text-[var(--lb-color-primary-hover)]"
                        onClick={(event) => {
                            event.stopPropagation()
                            loadOrderDetail(order)
                        }}
                    >
                        {order.order_number || order.id.slice(0, 8)}
                    </button>
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
            sortable: true,
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
            sortable: true,
            render: (order) => String(order.item_count || order.items?.length || 0),
        },
        {
            key: 'payment_status',
            header: 'Payment',
            sortable: true,
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
            render: (order) => currency(Number(order.total || 0)),
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
                />
            ),
        },
    ]

    return (
        <Page>
            <PageHeader
                eyebrow="Operations"
                title="Orders"
                description="Review purchases, confirm payment, ship orders, and keep fulfillment moving."
                breadcrumbs={[{ label: 'Home', href: `/${store}/dashboard` }, { label: 'Orders' }]}
                secondaryActions={[{ label: 'Products', href: `/${store}/products` }]}
            />

            <Card>
                <Section
                    title="Order queue"
                        description={`${totalCount} ${totalCount === 1 ? 'order' : 'orders'} in the current view.`}
                >
                    <div className="flex flex-col gap-[var(--lb-space-4)]">
                        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_auto] md:items-end">
                            <Input
                                label="Search orders"
                                placeholder="Search order, customer email, or name"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                leftIcon={<Search className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            />
                            <Select
                                label="Payment"
                                value={paymentFilter}
                                options={paymentStatusOptions}
                                onChange={(event) => setPaymentFilter(event.target.value)}
                            />
                            <Button variant="secondary" onClick={loadOrders}>
                                <MaterialIcon name="sync" />
                                Refresh
                            </Button>
                        </div>

                        {actionError && (
                            <Banner title="Order action failed" variant="critical">
                                {actionError}
                            </Banner>
                        )}

                        {loading ? (
                            <Skeleton variant="table" lines={6} />
                        ) : (
                            <IndexTable
                                rows={sortedOrders}
                                columns={columns}
                                emptyState={emptyState}
                                savedViews={statuses}
                                activeView={filter}
                                onViewChange={(value) => setFilter(value as OrderStatus)}
                                filterChips={activeFilters}
                                bulkActions={bulkActions}
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                onSort={handleSort}
                                onRowClick={loadOrderDetail}
                            />
                        )}
                    </div>
                </Section>
            </Card>

            {activeOrder && (
                <Card>
                    <Section
                        title={`Order ${activeOrder.order_number || activeOrder.id.slice(0, 8)}`}
                        description="Customer, fulfillment, line items, and payment summary."
                        action={(
                            <Button variant="ghost" onClick={() => setExpandedOrderId(null)}>
                                Close
                            </Button>
                        )}
                    >
                        {loadingDetailId === activeOrder.id ? (
                            <Skeleton variant="card" lines={4} />
                        ) : (
                            <OrderDetail order={activeOrder} />
                        )}
                    </Section>
                </Card>
            )}

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
        </Page>
    )
}

function OrderActions({
    order,
    updating,
    fulfilling,
    trackingNumber,
    onTrackingChange,
    onStatusChange,
    onStartFulfill,
    onCancelFulfill,
    onFulfill,
    onStartCancel,
}: {
    order: OrderRow
    updating: boolean
    fulfilling: boolean
    trackingNumber: string
    onTrackingChange: (value: string) => void
    onStatusChange: (orderId: string, status: string) => void
    onStartFulfill: () => void
    onCancelFulfill: () => void
    onFulfill: () => void
    onStartCancel: () => void
}) {
    const stop = (event: SyntheticEvent) => event.stopPropagation()

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
            </div>

            {fulfilling && (
                <div className="grid w-full gap-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
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
                                className="grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)] md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
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
                    <OrderAmountLine label="Subtotal" value={currency(order.subtotal || 0)} />
                    <OrderAmountLine label="Shipping" value={currency(order.shipping_cost || 0)} />
                    <OrderAmountLine label="Discount" value={`-${currency(order.discount || 0)}`} />
                    <OrderAmountLine label="Tax" value={currency(order.tax || 0)} />
                    <div className="flex justify-between border-t border-[var(--lb-color-border)] pt-[var(--lb-space-2)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                        <span>Total</span>
                        <span>{currency(order.total || 0)}</span>
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
