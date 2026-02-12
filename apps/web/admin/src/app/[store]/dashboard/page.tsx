'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

interface StoreStats {
    totalRevenue: number
    totalOrders: number
    totalProducts: number
    recentOrders: Array<{
        id: string
        order_number: string
        total: number
        status: string
        created_at: string
    }>
}

export default function DashboardPage() {
    const { store } = useParams<{ store: string }>()
    const [stats, setStats] = useState<StoreStats>({
        totalRevenue: 0,
        totalOrders: 0,
        totalProducts: 0,
        recentOrders: [],
    })
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function loadStats() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Get store ID
            const { data: storeData } = await supabase
                .from('stores')
                .select('id')
                .eq('store_name', store)
                .eq('user_id', user.id)
                .single()

            if (!storeData) return

            // Parallel queries
            const [productsResult, ordersResult, recentOrdersResult] = await Promise.all([
                supabase
                    .from('products')
                    .select('id', { count: 'exact', head: true })
                    .eq('store_id', storeData.id),
                supabase
                    .from('orders')
                    .select('id, total', { count: 'exact' })
                    .eq('store_id', storeData.id),
                supabase
                    .from('orders')
                    .select('id, order_number, total, status, created_at')
                    .eq('store_id', storeData.id)
                    .order('created_at', { ascending: false })
                    .limit(5),
            ])

            const totalRevenue = (ordersResult.data || []).reduce(
                (sum, o) => sum + (Number(o.total) || 0), 0
            )

            setStats({
                totalRevenue,
                totalOrders: ordersResult.count || 0,
                totalProducts: productsResult.count || 0,
                recentOrders: recentOrdersResult.data || [],
            })
            setLoading(false)
        }
        loadStats()
    }, [store, supabase])

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-6">
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
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Overview of <span className="font-medium">{store}</span>
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue)} />
                <StatCard title="Orders" value={String(stats.totalOrders)} />
                <StatCard title="Products" value={String(stats.totalProducts)} />
                <StatCard title="Conversion Rate" value="—" />
            </div>

            {/* Recent Orders */}
            <div className="mt-8">
                <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent Orders</h2>
                {stats.recentOrders.length === 0 ? (
                    <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="text-zinc-500">No orders yet</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                                    <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Order</th>
                                    <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                                    <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Total</th>
                                    <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recentOrders.map((order) => (
                                    <tr key={order.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                                            {order.order_number}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={order.status} />
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                                            {formatCurrency(Number(order.total))}
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-500">
                                            {new Date(order.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

function StatCard({ title, value }: { title: string; value: string }) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{title}</p>
            <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
        delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    }
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors.pending}`}>
            {status}
        </span>
    )
}
