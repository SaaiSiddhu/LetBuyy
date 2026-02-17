// ============================================================
// MY ORDERS PAGE — Displays customer's order history
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { Package, ChevronRight, Loader2, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

interface Order {
    id: string;
    order_number: string;
    status: string;
    total: number;
    created_at: string;
    items: OrderItem[];
}

interface OrderItem {
    name: string;
    quantity: number;
    price: number;
    image?: string;
}

const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    processing: '#3b82f6',
    shipped: '#8b5cf6',
    delivered: '#10b981',
    cancelled: '#ef4444',
    refunded: '#6b7280',
};

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/customer/orders')
            .then(r => r.json())
            .then(d => setOrders(d.orders || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="text-center py-16">
                <div
                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                    style={{ backgroundColor: 'var(--surface, #F3F4F6)' }}
                >
                    <ShoppingBag size={28} style={{ color: 'var(--text-secondary, #9CA3AF)' }} />
                </div>
                <h2 className="text-lg font-semibold mb-1">No orders yet</h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                    When you place an order, it will appear here.
                </p>
                <Link
                    href="/shop"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold"
                    style={{ backgroundColor: 'var(--primary)' }}
                >
                    <ShoppingBag size={18} />
                    Start Shopping
                </Link>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">My Orders</h1>
            <div className="space-y-4">
                {orders.map(order => {
                    const items = Array.isArray(order.items) ? order.items : [];
                    return (
                        <div
                            key={order.id}
                            className="rounded-2xl border p-4 transition-shadow hover:shadow-md"
                            style={{ borderColor: 'var(--border, #E5E7EB)' }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Package size={18} style={{ color: 'var(--primary)' }} />
                                    <span className="font-semibold text-sm">
                                        {order.order_number || `#${order.id.slice(0, 8)}`}
                                    </span>
                                </div>
                                <span
                                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                                    style={{
                                        backgroundColor: `${statusColors[order.status] || '#6b7280'}15`,
                                        color: statusColors[order.status] || '#6b7280',
                                    }}
                                >
                                    {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                                </span>
                            </div>

                            {/* Item previews */}
                            {items.length > 0 && (
                                <div className="flex gap-2 mb-3 overflow-x-auto">
                                    {items.slice(0, 4).map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 shrink-0">
                                            {item.image && (
                                                <img
                                                    src={item.image}
                                                    alt={item.name}
                                                    className="w-10 h-10 object-cover rounded-lg"
                                                />
                                            )}
                                            <div className="text-xs">
                                                <p className="font-medium truncate max-w-[120px]">{item.name}</p>
                                                <p style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                                    x{item.quantity}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {items.length > 4 && (
                                        <span className="text-xs self-center" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                            +{items.length - 4} more
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border, #E5E7EB)' }}>
                                <div>
                                    <span className="text-xs" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                        })}
                                    </span>
                                    <span className="font-bold ml-3">
                                        ₹{Number(order.total).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <ChevronRight size={16} style={{ color: 'var(--text-secondary, #9CA3AF)' }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
