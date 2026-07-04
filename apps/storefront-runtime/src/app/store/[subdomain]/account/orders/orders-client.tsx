// ============================================================
// MY ORDERS PAGE — Displays customer's order history
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import type { LineItem, Order as SharedOrder } from '@letbuyy/shared-types';
import { Button, Calendar, CheckCircle, ChevronRight, Clock, Package, ShoppingBag, Truck } from '@letbuyy/ui';
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
    pending: 'rgb(245 158 11)',
    confirmed: 'rgb(59 130 246)',
    processing: 'rgb(59 130 246)',
    shipped: 'rgb(139 92 246)',
    delivered: 'rgb(16 185 129)',
    cancelled: 'rgb(239 68 68)',
    refunded: 'rgb(107 114 128)',
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

export default function OrdersClient() {
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
                            style={{ borderColor: 'var(--border, rgb(229 231 235))' }}
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
                                        backgroundColor: `${statusColors[order.status] || 'rgb(107 114 128)'}15`,
                                        color: statusColors[order.status] || 'rgb(107 114 128)',
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
                                                <p style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                                    x{item.quantity}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {items.length > 4 && (
                                        <span className="text-xs self-center" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                            +{items.length - 4} more
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: 'var(--border, rgb(229 231 235))' }}>
                                <div>
                                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                        <Calendar size={13} />
                                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                        })}
                                    </span>
                                    <span className="font-bold ml-3">
                                        ₹{Number(order.total).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <Button unstyled
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
                                </Button>
                            </div>

                            {isExpanded && (
                                <div className="mt-4 space-y-4 rounded-xl p-4" style={{ backgroundColor: 'var(--surface, rgb(243 244 246))' }}>
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
                                                                backgroundColor: isActive ? 'var(--primary)' : 'var(--card-bg, rgb(255 255 255))',
                                                                color: isActive ? 'rgb(255 255 255)' : 'var(--text-secondary, rgb(107 114 128))',
                                                                border: '1px solid var(--border, rgb(229 231 235))',
                                                            }}
                                                        >
                                                            <Icon size={16} />
                                                        </span>
                                                        <span className="text-[11px] font-medium" style={{ color: isActive ? 'var(--text)' : 'var(--text-secondary, rgb(107 114 128))' }}>
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
                                                    <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--lb-color-surface)]/70 p-2">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium">{item.name}</p>
                                                            <p className="text-xs" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
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
                                            <p className="text-sm" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
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
