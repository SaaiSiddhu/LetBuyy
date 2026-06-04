// ============================================================
// MY ORDERS PAGE — Displays customer's order history
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import type { LineItem, Order as SharedOrder } from '@letbuyy/shared-types';
import { Calendar, CheckCircle, ChevronRight, Clock, Package, ShoppingBag, Truck } from '@letbuyy/ui';
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
    confirmed: '#3b82f6',
    processing: '#3b82f6',
    shipped: '#8b5cf6',
    delivered: '#10b981',
    cancelled: '#ef4444',
    refunded: '#6b7280',
};

const timelineSteps = [
    { key: 'pending', label: 'Placed', icon: Clock },
    { key: 'processing', label: 'Preparing', icon: Package },
    { key: 'shipped', label: 'Shipped', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

function timelineIndex(status: string | undefined) {
    if (!status) return 0;
    if (status === 'confirmed') return 1;
    const index = timelineSteps.findIndex(step => step.key === status);
    return index >= 0 ? index : 0;
}

export default function OrdersPage() {
    const params = useParams();
    const subdomain = params.subdomain as string;
    const basePath = `/store/${subdomain}`;
    const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

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
                    const isExpanded = expandedOrderId === order.id;
                    const activeTimelineIndex = timelineIndex(order.status);
                    return (
                        <div
                            key={order.id}
                            className="rounded-2xl border p-4 transition-shadow hover:shadow-md"
                            style={{ borderColor: 'var(--border, #E5E7EB)' }}
                        >
                            <div className="flex items-center justify-between gap-3 mb-3">
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

                            <div className="flex items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: 'var(--border, #E5E7EB)' }}>
                                <div>
                                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                        <Calendar size={13} />
                                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                        })}
                                    </span>
                                    <span className="font-bold ml-3">
                                        ₹{Number(order.total).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                    className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold transition-colors"
                                    style={{ color: 'var(--primary)' }}
                                    aria-expanded={isExpanded}
                                >
                                    {isExpanded ? 'Hide details' : 'View details'}
                                    <ChevronRight
                                        size={16}
                                        className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    />
                                </button>
                            </div>

                            {isExpanded && (
                                <div className="mt-4 space-y-4 rounded-xl p-4" style={{ backgroundColor: 'var(--surface, #F3F4F6)' }}>
                                    <div>
                                        <h2 className="text-sm font-semibold mb-3">Order timeline</h2>
                                        <div className="grid grid-cols-4 gap-2">
                                            {timelineSteps.map((step, index) => {
                                                const Icon = step.icon;
                                                const isActive = activeTimelineIndex >= index && !['cancelled', 'refunded'].includes(order.status || '');
                                                return (
                                                    <div key={step.key} className="flex min-w-0 flex-col items-center gap-2 text-center">
                                                        <span
                                                            className="flex h-9 w-9 items-center justify-center rounded-full"
                                                            style={{
                                                                backgroundColor: isActive ? 'var(--primary)' : 'var(--card-bg, #fff)',
                                                                color: isActive ? '#fff' : 'var(--text-secondary, #6B7280)',
                                                                border: '1px solid var(--border, #E5E7EB)',
                                                            }}
                                                        >
                                                            <Icon size={16} />
                                                        </span>
                                                        <span className="text-[11px] font-medium" style={{ color: isActive ? 'var(--text)' : 'var(--text-secondary, #6B7280)' }}>
                                                            {step.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <h2 className="text-sm font-semibold mb-3">Items</h2>
                                        {items.length > 0 ? (
                                            <div className="space-y-2">
                                                {items.map((item, index) => (
                                                    <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 p-2">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium">{item.name}</p>
                                                            <p className="text-xs" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                                                Qty {item.quantity}
                                                            </p>
                                                        </div>
                                                        <span className="shrink-0 text-sm font-semibold">
                                                            ₹{Number(item.price || 0).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                                Item details are not available for this order yet.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
