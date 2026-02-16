'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

interface Order {
    id: string
    order_number: string
    customer_email: string
    total: number
    status: string
    created_at: string
    tracking_number?: string
}

export default function OrdersPage() {
    const { store } = useParams<{ store: string }>()
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [storeId, setStoreId] = useState<string | null>(null)
    const [filter, setFilter] = useState<string>('all')
    const [fulfillingId, setFulfillingId] = useState<string | null>(null)
    const [trackingNumber, setTrackingNumber] = useState('')
    const [cancellingId, setCancellingId] = useState<string | null>(null)

    const loadOrders = useCallback(async () => {
        const supabase = createClient()
        // Store ownership is already validated by the server-side [store]/layout.tsx
        const { data: storeData } = await supabase
            .from('sites')
            .select('id')
            .or(`store_name.eq.${store},subdomain.eq.${store}`)
            .single()

        if (!storeData) return
        setStoreId(storeData.id)

        let query = supabase
            .from('orders')
            .select('*')
            .eq('store_id', storeData.id)
            .order('created_at', { ascending: false })

        if (filter !== 'all') {
            query = query.eq('status', filter)
        }

        const { data } = await query
        setOrders(data || [])
        setLoading(false)
    }, [store, filter])

    useEffect(() => { loadOrders() }, [loadOrders])

    const handleFulfill = async (orderId: string) => {
        const supabase = createClient()
        await supabase.from('orders').update({
            status: 'shipped',
            tracking_number: trackingNumber.trim() || null,
        }).eq('id', orderId)
        setFulfillingId(null)
        setTrackingNumber('')
        loadOrders()
    }

    const handleCancel = async (orderId: string) => {
        const supabase = createClient()
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
        setCancellingId(null)
        loadOrders()
    }

    const formatCurrency = (amt: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt)

    const statuses = ['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled']

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
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            {/* Page header */}
            <div className="products-page-header">
                <h1>Orders</h1>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {orders.length} order{orders.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Status Filter Tabs */}
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

                {/* Orders Table */}
                {orders.length === 0 ? (
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
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th style={{ textAlign: 'right' }}>Date</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.id}>
                                    <td style={{ fontWeight: 500 }}>{order.order_number}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{order.customer_email || '—'}</td>
                                    <td><OrderStatusBadge status={order.status} /></td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(Number(order.total))}</td>
                                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                            {order.status === 'pending' && fulfillingId !== order.id && (
                                                <button
                                                    onClick={() => { setFulfillingId(order.id); setCancellingId(null) }}
                                                    className="order-action-btn fulfill"
                                                >
                                                    Fulfill
                                                </button>
                                            )}
                                            {['pending', 'confirmed'].includes(order.status) && cancellingId !== order.id && (
                                                <button
                                                    onClick={() => { setCancellingId(order.id); setFulfillingId(null) }}
                                                    className="order-action-btn cancel"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                        {/* Inline fulfill form */}
                                        {fulfillingId === order.id && (
                                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                                <input
                                                    type="text"
                                                    placeholder="Tracking # (optional)"
                                                    value={trackingNumber}
                                                    onChange={e => setTrackingNumber(e.target.value)}
                                                    className="order-inline-input"
                                                    style={{ width: 140 }}
                                                />
                                                <button onClick={() => handleFulfill(order.id)} className="order-action-btn ship">
                                                    Ship
                                                </button>
                                                <button
                                                    onClick={() => { setFulfillingId(null); setTrackingNumber('') }}
                                                    className="order-action-btn dismiss"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                        {/* Inline cancel confirm */}
                                        {cancellingId === order.id && (
                                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                                <span style={{ fontSize: 12, color: 'var(--error)' }}>Cancel this order?</span>
                                                <button onClick={() => handleCancel(order.id)} className="order-action-btn confirm-cancel">
                                                    Yes
                                                </button>
                                                <button onClick={() => setCancellingId(null)} className="order-action-btn dismiss">
                                                    No
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
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
