'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

interface AnalyticsData {
    totalOrders: number
    totalRevenue: number
    totalProducts: number
    avgOrderValue: number
    ordersByStatus: Record<string, number>
    revenueByMonth: Array<{ month: string; revenue: number }>
}

export default function AnalyticsPage() {
    const { store } = useParams<{ store: string }>()
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            // Store ownership is already validated by the server-side [store]/layout.tsx
            const { data: storeData } = await supabase
                .from('sites')
                .select('id')
                .or(`store_name.eq.${store},subdomain.eq.${store}`)
                .single()

            if (!storeData) return

            const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90
            const since = new Date()
            since.setDate(since.getDate() - daysAgo)

            const [productsRes, ordersRes] = await Promise.all([
                supabase
                    .from('products')
                    .select('id', { count: 'exact', head: true })
                    .eq('store_id', storeData.id),
                supabase
                    .from('orders')
                    .select('id, total, status, created_at')
                    .eq('store_id', storeData.id)
                    .gte('created_at', since.toISOString()),
            ])

            const orders = ordersRes.data || []
            const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0)
            const ordersByStatus: Record<string, number> = {}
            orders.forEach(o => {
                ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1
            })

            // Group revenue by month
            const monthMap: Record<string, number> = {}
            orders.forEach(o => {
                const d = new Date(o.created_at)
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                monthMap[key] = (monthMap[key] || 0) + (Number(o.total) || 0)
            })
            const revenueByMonth = Object.entries(monthMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, revenue]) => ({ month, revenue }))

            setData({
                totalOrders: orders.length,
                totalRevenue,
                totalProducts: productsRes.count || 0,
                avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
                ordersByStatus,
                revenueByMonth,
            })
            setLoading(false)
        }
        load()
    }, [store, period])

    const formatCurrency = (amt: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt)

    if (loading) {
        return (
            <div className="setup-dashboard" style={{ padding: '24px 32px' }}>
                <div className="products-page-header">
                    <h1>Analytics</h1>
                </div>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="admin-skeleton" style={{ height: 112, borderRadius: 14 }} />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="setup-dashboard" style={{ padding: '24px 32px' }}>
            {/* Header */}
            <div className="products-page-header">
                <div>
                    <h1>Analytics</h1>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                        Track {store}&apos;s performance
                    </p>
                </div>
                <div className="products-tabs" style={{ border: 'none', marginBottom: 0, gap: 0 }}>
                    {(['7d', '30d', '90d'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`products-tab ${period === p ? 'active' : ''}`}
                        >
                            {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginBottom: 24 }}>
                <AnalyticsCard title="Revenue" value={formatCurrency(data!.totalRevenue)} icon="payments" />
                <AnalyticsCard title="Orders" value={String(data!.totalOrders)} icon="receipt_long" />
                <AnalyticsCard title="Avg. Order Value" value={formatCurrency(data!.avgOrderValue)} icon="trending_up" />
                <AnalyticsCard title="Products" value={String(data!.totalProducts)} icon="inventory_2" />
            </div>

            {/* Orders by Status */}
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                    Orders by Status
                </h2>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                    {['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(status => (
                        <div
                            key={status}
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: 14,
                                padding: '16px 20px',
                            }}
                        >
                            <p style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                                {status}
                            </p>
                            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                {data!.ordersByStatus[status] || 0}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Revenue by Month */}
            {data!.revenueByMonth.length > 0 && (
                <div>
                    <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                        Monthly Revenue
                    </h2>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        padding: 24,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200 }}>
                            {data!.revenueByMonth.map((m) => {
                                const maxRev = Math.max(...data!.revenueByMonth.map(x => x.revenue))
                                const height = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0
                                return (
                                    <div key={m.month} style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>
                                            {formatCurrency(m.revenue)}
                                        </span>
                                        <div
                                            style={{
                                                width: '100%',
                                                borderRadius: '6px 6px 0 0',
                                                background: 'var(--primary)',
                                                height: `${Math.max(height, 4)}%`,
                                            }}
                                        />
                                        <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>{m.month}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function AnalyticsCard({ title, value, icon }: { title: string; value: string; icon: string }) {
    return (
        <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '20px 24px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-hint)' }}>
                    {icon}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{title}</span>
            </div>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{value}</p>
        </div>
    )
}
