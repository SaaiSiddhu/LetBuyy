'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface Customer {
    id: string
    full_name: string
    email: string
    phone: string | null
    total_orders: number
    total_spent: number
    status: string
    created_at: string
    first_order_at: string | null
    last_order_at: string | null
    last_order_id: string | null
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

function formatDate(value: string | null) {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

export default function CustomersPage() {
    const { store } = useParams<{ store: string }>()

    const [customers, setCustomers] = useState<Customer[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [error, setError] = useState<string | null>(null)

    const loadCustomers = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const query = new URLSearchParams({ limit: '100' })
            if (searchQuery.trim()) query.set('search', searchQuery.trim())

            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/customers?${query.toString()}`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                setCustomers([])
                setTotalCount(0)
                setError(getErrorMessage(payload, 'Unable to load customers'))
                return
            }

            setCustomers((Array.isArray(payload?.data) ? payload.data : []).map((row: Record<string, unknown>) => ({
                id: (row.id as string) || (row.customer_email as string),
                full_name: (row.full_name as string) || (row.customer_name as string) || '',
                email: (row.email as string) || (row.customer_email as string) || '',
                phone: (row.phone as string) || (row.customer_phone as string) || null,
                total_orders: Number(row.total_orders || 0),
                total_spent: Number(row.total_spent || 0),
                status: (row.status as string) || 'active',
                created_at: (row.created_at as string) || '',
                first_order_at: (row.first_order_at as string) || null,
                last_order_at: (row.last_order_at as string) || null,
                last_order_id: (row.last_order_id as string) || null,
            })))
            setTotalCount(Number(payload?.meta?.total || payload?.data?.length || 0))
        } catch {
            setCustomers([])
            setTotalCount(0)
            setError('Unable to load customers')
        } finally {
            setLoading(false)
        }
    }, [store, searchQuery])

    useEffect(() => { loadCustomers() }, [loadCustomers])

    if (loading) {
        return (
            <div className="setup-dashboard" style={{ padding: '24px 32px' }}>
                <div className="products-page-header"><h1>Customers</h1></div>
                <div className="admin-skeleton" style={{ height: 300, borderRadius: 14 }} />
            </div>
        )
    }

    return (
        <div className="setup-dashboard" style={{ maxWidth: 960, padding: '24px 32px' }}>
            <div className="products-page-header">
                <h1>Customers</h1>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {totalCount} {totalCount === 1 ? 'customer' : 'customers'}
                </span>
            </div>

            {error && customers.length === 0 ? (
                <div className="products-empty-card" style={{ textAlign: 'center', padding: '48px 16px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 40, marginBottom: 12, display: 'block', color: 'var(--error)' }}>
                        error
                    </span>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                        Unable to load customers
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>{error}</p>
                    <button type="button" className="order-action-btn fulfill" onClick={loadCustomers}>
                        Retry
                    </button>
                </div>
            ) : customers.length === 0 ? (
                <div className="products-empty-card">
                    <div className="products-empty-inner">
                        <div className="products-empty-text">
                            <h2>No customers yet</h2>
                            <p>When customers place orders or create accounts in your store, they will appear here.</p>
                        </div>
                        <div className="products-empty-images">
                            <div className="products-empty-img"><span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--text-hint)' }}>group</span></div>
                            <div className="products-empty-img"><span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--text-hint)' }}>shopping_cart</span></div>
                            <div className="products-empty-img"><span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--text-hint)' }}>trending_up</span></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="products-list-card">
                    <div className="products-toolbar">
                        <div className="products-search">
                            <span className="material-symbols-outlined">search</span>
                            <input
                                type="text"
                                placeholder="Search customers..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{ padding: '0 16px 12px', color: 'var(--error)', fontSize: 13 }}>
                            {error}
                        </div>
                    )}

                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Orders</th>
                                <th>Spent</th>
                                <th>Last order</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map(customer => (
                                <tr key={customer.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: '50%',
                                                background: 'var(--bg-tertiary)', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)'
                                            }}>
                                                {(customer.full_name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ fontWeight: 500 }}>{customer.full_name || 'Anonymous'}</span>
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{customer.email}</td>
                                    <td style={{ color: customer.phone ? 'var(--text-secondary)' : 'var(--text-hint)' }}>
                                        {customer.phone || '—'}
                                    </td>
                                    <td>{customer.total_orders || 0}</td>
                                    <td>₹{(customer.total_spent || 0).toLocaleString('en-IN')}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{formatDate(customer.last_order_at)}</td>
                                    <td>
                                        <span className={`product-status-badge ${customer.status || 'active'}`}>
                                            <span className="product-status-dot" />
                                            {(customer.status || 'active').charAt(0).toUpperCase() + (customer.status || 'active').slice(1)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {customers.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-hint)', fontSize: 14 }}>
                                        No customers found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
