'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Customer {
    id: string
    full_name: string
    email: string
    phone: string | null
    total_orders: number
    total_spent: number
    status: string
    created_at: string
    last_order_at: string | null
}

export default function CustomersPage() {
    const { store } = useParams<{ store: string }>()
    const supabase = createClient()

    const [customers, setCustomers] = useState<Customer[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    const loadCustomers = useCallback(async () => {
        const { data: storeData } = await supabase
            .from('sites')
            .select('id')
            .eq('store_name', store)
            .single()

        if (!storeData) { setLoading(false); return }

        // Using the contacts table which stores customer data for each store
        const { data } = await supabase
            .from('contacts')
            .select('id, full_name, email, phone, total_orders, total_spent, status, created_at, last_order_at')
            .eq('store_id', storeData.id)
            .order('created_at', { ascending: false })

        setCustomers(data || [])
        setLoading(false)
    }, [store, supabase])

    useEffect(() => { loadCustomers() }, [loadCustomers])

    const filtered = customers.filter(c =>
        c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )

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
                    {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
                </span>
            </div>

            {customers.length === 0 ? (
                <div className="products-empty-card">
                    <div className="products-empty-inner">
                        <div className="products-empty-text">
                            <h2>No customers yet</h2>
                            <p>When customers place orders or create accounts in your store, they'll appear here.</p>
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

                    <table className="products-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Orders</th>
                                <th>Spent</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(customer => (
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
                                    <td>{customer.total_orders || 0}</td>
                                    <td>₹{(customer.total_spent || 0).toLocaleString('en-IN')}</td>
                                    <td>
                                        <span className={`product-status-badge ${customer.status || 'active'}`}>
                                            <span className="product-status-dot" />
                                            {(customer.status || 'active').charAt(0).toUpperCase() + (customer.status || 'active').slice(1)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-hint)', fontSize: 14 }}>
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
