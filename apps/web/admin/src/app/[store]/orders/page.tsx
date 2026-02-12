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
    const supabase = createClient()

    const loadOrders = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: storeData } = await supabase
            .from('stores')
            .select('id')
            .eq('store_name', store)
            .eq('user_id', user.id)
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
    }, [store, filter, supabase])

    useEffect(() => { loadOrders() }, [loadOrders])

    const handleFulfill = async (orderId: string) => {
        const tracking = prompt('Enter tracking number (optional):')
        await supabase.from('orders').update({
            status: 'shipped',
            tracking_number: tracking || null,
        }).eq('id', orderId)
        loadOrders()
    }

    const handleCancel = async (orderId: string) => {
        if (!confirm('Cancel this order?')) return
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
        loadOrders()
    }

    const formatCurrency = (amt: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt)

    const statuses = ['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled']

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="h-64 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Orders</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {orders.length} order{orders.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Status Filter Tabs */}
            <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                {statuses.map(s => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === s
                                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                            }`}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {/* Orders Table */}
            {orders.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">No orders</p>
                    <p className="mt-2 text-sm text-zinc-500">
                        {filter !== 'all' ? `No ${filter} orders found.` : 'Orders will appear here once customers start purchasing.'}
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Order</th>
                                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Customer</th>
                                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                                <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Total</th>
                                <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Date</th>
                                <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{order.order_number}</td>
                                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{order.customer_email || '—'}</td>
                                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">{formatCurrency(Number(order.total))}</td>
                                    <td className="px-4 py-3 text-right text-zinc-500">{new Date(order.created_at).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1">
                                            {order.status === 'pending' && (
                                                <button onClick={() => handleFulfill(order.id)} className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400">
                                                    Fulfill
                                                </button>
                                            )}
                                            {['pending', 'confirmed'].includes(order.status) && (
                                                <button onClick={() => handleCancel(order.id)} className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400">
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
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
