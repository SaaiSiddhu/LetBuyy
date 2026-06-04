// ============================================================
// MY ORDERS PAGE — Displays customer's order history
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import type { LineItem, Order as SharedOrder } from '@letbuyy/shared-types';
import { Package, ChevronRight, ShoppingBag } from '@letbuyy/ui';
import { useParams } from 'next/navigation';
import { StorefrontEmptyState, StorefrontListLoadingState } from '@/components/storefront/storefront-states';

type OrderHistoryItem = Pick<SharedOrder, 'id' | 'order_number' | 'status' | 'total' | 'created_at'> & {
    items?: OrderHistoryLineItem[];
};

type OrderHistoryLineItem = Pick<LineItem, 'quantity'> & {
    name: string;
    price: number;
    image?: string;
};

const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    processing: '#3b82f6',
    shipped: '#8b5cf6',
    delivered: '#10b981',
    cancelled: '#ef4444',
    refunded: '#6b7280',
};

export default function OrdersPage() {
    const params = useParams();
    const subdomain = params.subdomain as string;
    const basePath = `/store/${subdomain}`;
    const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/customer/orders')
            .then(r => r.json())
            .then(d => setOrders(d.orders || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <StorefrontListLoadingState rows={4} />;
    }

    if (orders.length === 0) {
        return (
            <StorefrontEmptyState
                icon={<ShoppingBag size={28} aria-hidden="true" />}
                title="No orders yet"
                body="When you place an order, it will appear here."
                actionHref={`${basePath}/shop`}
                actionLabel="Start shopping"
                actionIcon={<ShoppingBag size={18} aria-hidden="true" />}
            />
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
