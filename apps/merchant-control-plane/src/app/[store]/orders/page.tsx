'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface OrderItem {
    product_id: string
    variant_id?: string | null
    title: string
    variant_title?: string | null
    sku?: string | null
    quantity: number
    unit_price: number
    total: number
    image?: string | null
}

interface Order {
    id: string
    order_number: string
    customer_name: string
    customer_email: string
    customer_phone?: string | null
    subtotal: number
    shipping_cost: number
    tax: number
    discount: number
    total: number
    coupon_code?: string | null
    coupon_discount?: number
    status: string
    payment_status: string
    payment_method: string
    shipping_method?: string | null
    shipping_address?: Record<string, unknown>
    items: OrderItem[]
    item_count: number
    created_at: string
    tracking_number?: string | null
}

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

function formatDate(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

function addressLine(address?: Record<string, unknown>) {
    if (!address) return '—'
    const parts = [
        address.line1 || address.address,
        address.city,
        address.state,
        address.zip || address.pincode,
    ].filter(Boolean)

    return parts.length ? parts.join(', ') : '—'
}

export default function OrdersPage() {
    const { store } = useParams<{ store: string }>()
    const [orders, setOrders] = useState<Order[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
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
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                setOrders([])
                setTotalCount(0)
                setError(getErrorMessage(payload, 'Unable to load orders'))
                return
            }

            setOrders(Array.isArray(payload?.data) ? payload.data : [])
            setTotalCount(Number(payload?.meta?.total || payload?.data?.length || 0))
        } catch {
            setOrders([])
            setTotalCount(0)
            setError('Unable to load orders')
        } finally {
            setLoading(false)
        }
    }, [store, filter, paymentFilter, searchQuery])

    useEffect(() => { loadOrders() }, [loadOrders])

    const loadOrderDetail = async (order: Order) => {
        if (expandedOrderId === order.id) {
            setExpandedOrderId(null)
            return
        }

        if (order.items?.length) {
            setExpandedOrderId(order.id)
            return
        }

        setLoadingDetailId(order.id)
        setActionError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/orders/${encodeURIComponent(order.id)}`)
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                setActionError(getErrorMessage(payload, 'Unable to load order details'))
                return
            }

            if (payload?.data) {
                setOrders(current => current.map(item => item.id === order.id ? payload.data : item))
                setExpandedOrderId(order.id)
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
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                setActionError(getErrorMessage(payload, 'Unable to update order'))
                return false
            }

            await loadOrders()
            return true
        } catch {
            setActionError('Unable to update order')
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

    const formatCurrency = (amt: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt)

    const statuses = ['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']
    const paymentStatuses = ['all', 'pending', 'paid', 'failed', 'refunded']

    if (loading) {
        return (
            <div className="setup-dashboard" style={{ padding: '24px 32px' }}>
                <div className="products-page-header">
                    <h1>Orders</h1>
                </div>
                <div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} />
            </div>
        )
    }

    return (
        <div className="setup-dashboard" style={{ maxWidth: 1120, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Orders</h1>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {totalCount} order{totalCount !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="products-list-card">
                <div className="products-tabs">
                    {statuses.map(s => (
                        <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={`products-tab ${filter === s ? 'active' : ''}`}
                        >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="products-toolbar">
                    <div className="products-search">
                        <span className="material-symbols-outlined">search</span>
                        <input
                            type="text"
                            placeholder="Search order, customer email, or name..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select
                        value={paymentFilter}
                        onChange={e => setPaymentFilter(e.target.value)}
                        className="order-inline-input"
                        style={{ height: 38, minWidth: 150 }}
                    >
                        {paymentStatuses.map(status => (
                            <option key={status} value={status}>
                                {status === 'all' ? 'All payments' : status.charAt(0).toUpperCase() + status.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>

                {(error || actionError) && (
                    <div style={{ padding: '0 16px 12px', color: 'var(--error)', fontSize: 13 }}>
                        {error || actionError}
                    </div>
                )}

                {error && orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-secondary)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 40, marginBottom: 12, display: 'block', color: 'var(--error)' }}>
                            error
                        </span>
                        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                            Unable to load orders
                        </p>
                        <p style={{ fontSize: 13, margin: '0 0 16px' }}>{error}</p>
                        <button type="button" className="order-action-btn fulfill" onClick={loadOrders}>
                            Retry
                        </button>
                    </div>
                ) : orders.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '48px 16px',
                        color: 'var(--text-hint)',
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 40, marginBottom: 12, display: 'block', color: 'var(--text-hint)' }}>
                            receipt_long
                        </span>
                        <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                            No orders
                        </p>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                            {filter !== 'all' ? `No ${filter} orders found.` : 'Orders will appear here once customers start purchasing.'}
                        </p>
                    </div>
                ) : (
                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Customer</th>
                                <th>Items</th>
                                <th>Payment</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th style={{ textAlign: 'right' }}>Date</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <Fragment key={order.id}>
                                    <tr>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => loadOrderDetail(order)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    color: 'var(--text-primary)',
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {order.order_number || order.id.slice(0, 8)}
                                            </button>
                                            {order.coupon_code && (
                                                <div style={{ marginTop: 3, fontSize: 11, color: 'var(--success)' }}>
                                                    Coupon {order.coupon_code}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{order.customer_name || 'Customer'}</div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{order.customer_email || '—'}</div>
                                        </td>
                                        <td>{order.item_count || order.items?.length || 0}</td>
                                        <td><PaymentStatusBadge status={order.payment_status} method={order.payment_method} /></td>
                                        <td><OrderStatusBadge status={order.status} /></td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(Number(order.total || 0))}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                            {formatDate(order.created_at)}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                                                {order.status === 'pending' && (
                                                    <button
                                                        onClick={() => updateOrderStatus(order.id, 'confirmed')}
                                                        disabled={updatingId === order.id}
                                                        className="order-action-btn fulfill"
                                                    >
                                                        Confirm
                                                    </button>
                                                )}
                                                {order.status === 'confirmed' && (
                                                    <button
                                                        onClick={() => updateOrderStatus(order.id, 'processing')}
                                                        disabled={updatingId === order.id}
                                                        className="order-action-btn fulfill"
                                                    >
                                                        Process
                                                    </button>
                                                )}
                                                {order.status === 'processing' && fulfillingId !== order.id && (
                                                    <button
                                                        onClick={() => { setFulfillingId(order.id); setCancellingId(null) }}
                                                        disabled={updatingId === order.id}
                                                        className="order-action-btn fulfill"
                                                    >
                                                        Ship
                                                    </button>
                                                )}
                                                {order.status === 'shipped' && (
                                                    <button
                                                        onClick={() => updateOrderStatus(order.id, 'delivered')}
                                                        disabled={updatingId === order.id}
                                                        className="order-action-btn fulfill"
                                                    >
                                                        Deliver
                                                    </button>
                                                )}
                                                {['pending', 'confirmed', 'processing'].includes(order.status) && cancellingId !== order.id && (
                                                    <button
                                                        onClick={() => { setCancellingId(order.id); setFulfillingId(null) }}
                                                        disabled={updatingId === order.id}
                                                        className="order-action-btn cancel"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                            {fulfillingId === order.id && (
                                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Tracking #"
                                                        value={trackingNumber}
                                                        onChange={e => setTrackingNumber(e.target.value)}
                                                        className="order-inline-input"
                                                        style={{ width: 140 }}
                                                    />
                                                    <button onClick={() => handleFulfill(order.id)} disabled={updatingId === order.id} className="order-action-btn ship">
                                                        Ship
                                                    </button>
                                                    <button
                                                        onClick={() => { setFulfillingId(null); setTrackingNumber('') }}
                                                        className="order-action-btn dismiss"
                                                    >
                                                        Close
                                                    </button>
                                                </div>
                                            )}
                                            {cancellingId === order.id && (
                                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                                    <span style={{ fontSize: 12, color: 'var(--error)' }}>Cancel this order?</span>
                                                    <button onClick={() => handleCancel(order.id)} disabled={updatingId === order.id} className="order-action-btn confirm-cancel">
                                                        Yes
                                                    </button>
                                                    <button onClick={() => setCancellingId(null)} className="order-action-btn dismiss">
                                                        No
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedOrderId === order.id && (
                                        <tr>
                                            <td colSpan={8} style={{ background: 'var(--bg-secondary)', padding: 0 }}>
                                                <div style={{ padding: 16 }}>
                                                    {loadingDetailId === order.id ? (
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading order details...</div>
                                                    ) : (
                                                        <OrderDetail order={order} formatCurrency={formatCurrency} />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}

function OrderDetail({ order, formatCurrency }: { order: Order; formatCurrency: (amount: number) => string }) {
    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase', fontWeight: 700 }}>Customer</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4 }}>
                        {order.customer_name || 'Customer'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{order.customer_phone || order.customer_email || '—'}</div>
                </div>
                <div>
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase', fontWeight: 700 }}>Ship to</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4 }}>{addressLine(order.shipping_address)}</div>
                </div>
                <div>
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase', fontWeight: 700 }}>Fulfillment</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4 }}>
                        {order.shipping_method || 'standard'}{order.tracking_number ? ` / ${order.tracking_number}` : ''}
                    </div>
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                {(order.items || []).length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No item rows are available for this order.</div>
                ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                        {order.items.map((item, index) => (
                            <div key={`${item.product_id}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', fontSize: 13 }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                                        {[item.variant_title, item.sku].filter(Boolean).join(' / ') || '—'}
                                    </div>
                                </div>
                                <div style={{ color: 'var(--text-secondary)' }}>
                                    {item.quantity} x {formatCurrency(item.unit_price)}
                                </div>
                                <div style={{ fontWeight: 600 }}>{formatCurrency(item.total)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ minWidth: 240, display: 'grid', gap: 6, fontSize: 13 }}>
                    <OrderAmountLine label="Subtotal" value={formatCurrency(order.subtotal || 0)} />
                    <OrderAmountLine label="Shipping" value={formatCurrency(order.shipping_cost || 0)} />
                    <OrderAmountLine label="Discount" value={`-${formatCurrency(order.discount || 0)}`} />
                    <OrderAmountLine label="Tax" value={formatCurrency(order.tax || 0)} />
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>Total</span>
                        <span>{formatCurrency(order.total || 0)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function OrderAmountLine({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>{label}</span>
            <span>{value}</span>
        </div>
    )
}

function OrderStatusBadge({ status }: { status: string }) {
    const statusClass = `order-status-badge ${status}`
    return (
        <span className={statusClass}>
            <span className="product-status-dot" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    )
}

function PaymentStatusBadge({ status, method }: { status: string; method: string }) {
    return (
        <span className={`payment-status-badge ${status}`}>
            {method ? `${method.toUpperCase()} / ` : ''}{status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    )
}
