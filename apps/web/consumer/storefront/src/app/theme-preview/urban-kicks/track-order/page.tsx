'use client';

import PreviewShell from '../_components/preview-shell';
import { MOCK_ORDERS, formatPrice, type MockOrder } from '../_lib/mock-data';
import { useState } from 'react';
import {
    Search, Package, Truck, MapPin, CheckCircle2,
    Circle, Clock, Copy, Check, ChevronDown, ChevronUp
} from 'lucide-react';

// ============= ORDER TIMELINE =============

const TIMELINE_STEPS = [
    { key: 'ordered', label: 'Order Placed', icon: Package },
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
    { key: 'shipped', label: 'Shipped', icon: Truck },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: MapPin },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
] as const;

function getStepIndex(status: MockOrder['status']): number {
    return TIMELINE_STEPS.findIndex(s => s.key === status);
}

function OrderTimeline({ order }: { order: MockOrder }) {
    const currentIdx = getStepIndex(order.status);

    return (
        <div className="relative">
            {TIMELINE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isDone = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                    <div key={step.key} className="flex gap-4 relative">
                        {/* Connector line */}
                        {idx < TIMELINE_STEPS.length - 1 && (
                            <div className={`absolute left-[15px] top-[32px] w-0.5 h-[calc(100%-16px)] ${idx < currentIdx ? 'bg-black' : 'bg-gray-200'}`} />
                        )}

                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${isDone ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'
                            } ${isCurrent ? 'ring-4 ring-black/10' : ''}`}>
                            {isDone ? <Icon size={14} /> : <Circle size={14} />}
                        </div>

                        {/* Content */}
                        <div className={`pb-6 ${idx === TIMELINE_STEPS.length - 1 ? 'pb-0' : ''}`}>
                            <p className={`text-sm font-medium ${isDone ? 'text-black' : 'text-gray-400'}`}>{step.label}</p>
                            {isCurrent && (
                                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                    <Clock size={10} /> {order.status === 'delivered' ? 'Delivered on Feb 15' : 'In progress'}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ============= ORDER CARD =============

function OrderCard({ order }: { order: MockOrder }) {
    const [expanded, setExpanded] = useState(true);
    const [copied, setCopied] = useState(false);

    const copyTrackingId = () => {
        navigator.clipboard.writeText(order.trackingId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-gray-50 transition-colors"
            >
                <div className="text-left">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-base">{order.id}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${order.status === 'delivered' ? 'bg-green-100 text-green-700'
                                : order.status === 'shipped' ? 'bg-blue-100 text-blue-700'
                                    : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {order.status.replace('_', ' ')}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500">Placed on {new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>

            {expanded && (
                <div className="border-t border-gray-100 p-4 md:p-6 space-y-6">
                    {/* Timeline */}
                    <OrderTimeline order={order} />

                    {/* Tracking Info */}
                    <div className="bg-gray-50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <p className="text-xs text-gray-500 mb-0.5">Tracking ID ({order.carrier})</p>
                            <p className="text-sm font-mono font-medium">{order.trackingId}</p>
                        </div>
                        <button
                            onClick={copyTrackingId}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                        >
                            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>

                    {/* Items */}
                    <div>
                        <h4 className="text-sm font-semibold mb-3">Items ({order.items.length})</h4>
                        <div className="space-y-3">
                            {order.items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <div className="w-14 h-14 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                                        <img src={item.product.images?.[0] || ''} alt={item.product.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.product.name}</p>
                                        <p className="text-xs text-gray-500">Size: {item.size} · Qty: {item.quantity}</p>
                                    </div>
                                    <span className="text-sm font-medium">{formatPrice(item.product.price * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Delivery Address */}
                    <div className="flex items-start gap-2">
                        <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500 mb-0.5">Delivery Address</p>
                            <p className="text-sm">{order.address}</p>
                        </div>
                    </div>

                    {/* Estimated Delivery */}
                    {order.status !== 'delivered' && (
                        <div className="bg-black text-white rounded-xl p-4 flex items-center gap-3">
                            <Truck size={20} />
                            <div>
                                <p className="text-xs opacity-60">Estimated Delivery</p>
                                <p className="text-sm font-semibold">{new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ============= PAGE =============

export default function TrackOrderPage() {
    const [searchId, setSearchId] = useState('');
    const [searchResult, setSearchResult] = useState<MockOrder | null>(null);
    const [searched, setSearched] = useState(false);

    const handleSearch = () => {
        const found = MOCK_ORDERS.find(o => o.id.toLowerCase() === searchId.trim().toLowerCase());
        setSearchResult(found || null);
        setSearched(true);
    };

    return (
        <PreviewShell>
            <div className="max-w-screen-xl mx-auto px-4 py-8 md:py-12">
                {/* Header + Search */}
                <div className="max-w-xl mx-auto text-center mb-10">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Track Your Order</h1>
                    <p className="text-gray-500 text-sm mb-6">Enter your order ID to see real-time delivery status</p>

                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchId}
                                onChange={e => setSearchId(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="e.g. ORD-2026-4829"
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/20 transition-all"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            className="px-6 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-black/90 transition-colors"
                        >
                            Track
                        </button>
                    </div>

                    {/* Quick hint */}
                    <p className="text-xs text-gray-400 mt-2">
                        Try: <button onClick={() => setSearchId('ORD-2026-4829')} className="text-black font-medium underline">ORD-2026-4829</button>{' '}
                        or <button onClick={() => setSearchId('ORD-2026-4712')} className="text-black font-medium underline">ORD-2026-4712</button>
                    </p>
                </div>

                {/* Search Result */}
                {searched && searchResult && (
                    <div className="max-w-2xl mx-auto">
                        <OrderCard order={searchResult} />
                    </div>
                )}

                {searched && !searchResult && searchId && (
                    <div className="max-w-md mx-auto text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package size={28} className="text-gray-300" />
                        </div>
                        <h3 className="font-bold text-lg mb-1">Order Not Found</h3>
                        <p className="text-gray-500 text-sm">No order found with ID &quot;{searchId}&quot;. Please check and try again.</p>
                    </div>
                )}

                {/* Recent Orders (always shown) */}
                <div className="max-w-2xl mx-auto mt-12">
                    <h2 className="text-lg font-bold mb-4">Recent Orders</h2>
                    <div className="space-y-4">
                        {MOCK_ORDERS.map(order => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                </div>
            </div>
        </PreviewShell>
    );
}
