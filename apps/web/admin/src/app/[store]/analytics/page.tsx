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
    const supabase = createClient()

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: storeData } = await supabase
                .from('stores')
                .select('id')
                .eq('store_name', store)
                .eq('user_id', user.id)
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
    }, [store, period, supabase])

    const formatCurrency = (amt: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt)

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-28 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Analytics</h1>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Track {store}&apos;s performance</p>
                </div>
                <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                    {(['7d', '30d', '90d'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${period === p
                                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400'
                                }`}
                        >
                            {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <AnalyticsCard title="Revenue" value={formatCurrency(data!.totalRevenue)} />
                <AnalyticsCard title="Orders" value={String(data!.totalOrders)} />
                <AnalyticsCard title="Avg. Order Value" value={formatCurrency(data!.avgOrderValue)} />
                <AnalyticsCard title="Products" value={String(data!.totalProducts)} />
            </div>

            {/* Orders by Status */}
            <div className="mt-8">
                <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Orders by Status</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(status => (
                        <div key={status} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                            <p className="text-sm capitalize text-zinc-600 dark:text-zinc-400">{status}</p>
                            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                                {data!.ordersByStatus[status] || 0}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Revenue by Month */}
            {data!.revenueByMonth.length > 0 && (
                <div className="mt-8">
                    <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Monthly Revenue</h2>
                    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex items-end gap-2" style={{ height: 200 }}>
                            {data!.revenueByMonth.map((m) => {
                                const maxRev = Math.max(...data!.revenueByMonth.map(x => x.revenue))
                                const height = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0
                                return (
                                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                                        <span className="text-xs text-zinc-500">{formatCurrency(m.revenue)}</span>
                                        <div
                                            className="w-full rounded-t bg-blue-500"
                                            style={{ height: `${Math.max(height, 4)}%` }}
                                        />
                                        <span className="text-xs text-zinc-500">{m.month}</span>
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

function AnalyticsCard({ title, value }: { title: string; value: string }) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{title}</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
        </div>
    )
}
