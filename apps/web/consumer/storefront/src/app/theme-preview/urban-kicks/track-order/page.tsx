'use client';

import PreviewShell from '../_components/preview-shell';
import { MOCK_ORDERS, formatPrice, type MockOrder } from '../_lib/mock-data';
import { useState } from 'react';
import {
    Search, Package, Truck, MapPin, CheckCircle2,
    Circle, Clock, Check, ChevronDown,
    ArrowRight, Box, Clipboard
} from 'lucide-react';

// ============= HORIZONTAL TIMELINE =============

const TIMELINE_STEPS = [
    { key: 'ordered', label: 'Ordered', icon: Package },
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
            {/* Mobile: vertical compact */}
            <div className="flex flex-col sm:hidden">
                {TIMELINE_STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const isDone = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;

                    return (
                        <div key={step.key} className="flex items-start gap-3.5 relative">
                            {/* Connector line */}
                            {idx < TIMELINE_STEPS.length - 1 && (
                                <div className={`absolute left-[13px] top-[30px] w-[2px] h-full ${idx < currentIdx ? 'bg-black' : 'bg-gray-200'}`} />
                            )}
                            {/* Icon */}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${isDone ? 'bg-black text-white' : 'bg-gray-100 text-gray-300'
                                } ${isCurrent ? 'ring-[3px] ring-black/10' : ''}`}>
                                {isDone ? <Icon size={12} /> : <Circle size={12} />}
                            </div>
                            {/* Label */}
                            <div className={`pb-5 ${idx === TIMELINE_STEPS.length - 1 ? 'pb-0' : ''}`}>
                                <p className={`text-[13px] font-semibold leading-7 ${isDone ? 'text-black' : 'text-gray-300'}`}>{step.label}</p>
                                {isCurrent && (
                                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                        <Clock size={9} /> {order.status === 'delivered' ? 'Delivered' : 'In progress'}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop: horizontal */}
            <div className="hidden sm:flex items-start justify-between relative">
                {/* Background line */}
                <div className="absolute top-3 left-3 right-3 h-[2px] bg-gray-200 z-0" />
                {/* Progress line */}
                <div
                    className="absolute top-3 left-3 h-[2px] bg-black z-[1] transition-all duration-500"
                    style={{ width: `${(currentIdx / (TIMELINE_STEPS.length - 1)) * 100}%`, maxWidth: 'calc(100% - 24px)' }}
                />
                {TIMELINE_STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const isDone = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;

                    return (
                        <div key={step.key} className="flex flex-col items-center z-10 relative" style={{ width: `${100 / TIMELINE_STEPS.length}%` }}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isDone ? 'bg-black text-white' : 'bg-gray-100 text-gray-300 border border-gray-200'
                                } ${isCurrent ? 'ring-[3px] ring-black/10 scale-110' : ''} transition-all`}>
                                {isDone ? <Icon size={10} /> : <Circle size={10} />}
                            </div>
                            <p className={`text-[10px] mt-1.5 text-center font-medium ${isDone ? 'text-black' : 'text-gray-300'}`}>
                                {step.label}
                            </p>
                            {isCurrent && (
                                <p className="text-[9px] text-gray-400 mt-0.5 flex items-center gap-0.5">
                                    <Clock size={7} /> {order.status === 'delivered' ? 'Done' : 'Current'}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ============= COMPACT ORDER CARD =============

function OrderCard({ order, defaultExpanded = false }: { order: MockOrder; defaultExpanded?: boolean }) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [copied, setCopied] = useState(false);

    const copyTrackingId = () => {
        navigator.clipboard.writeText(order.trackingId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const statusColors: Record<string, string> = {
        delivered: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        shipped: 'bg-blue-50 text-blue-600 border-blue-200',
        out_for_delivery: 'bg-amber-50 text-amber-600 border-amber-200',
        confirmed: 'bg-purple-50 text-purple-600 border-purple-200',
        ordered: 'bg-gray-50 text-gray-600 border-gray-200',
    };

    return (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-sm transition-shadow">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Box size={14} className="text-gray-400" />
                    </div>
                    <div className="text-left min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-[13px] tracking-tight">{order.id}</span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${statusColors[order.status] || statusColors.ordered}`}>
                                {order.status.replace('_', ' ')}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · '}{order.items.length} item{order.items.length > 1 ? 's' : ''}
                            {' · '}{formatPrice(order.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0))}
                        </p>
                    </div>
                </div>
                <ChevronDown size={16} className={`text-gray-300 transition-transform flex-shrink-0 ml-2 ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
                <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                    {/* Timeline */}
                    <OrderTimeline order={order} />

                    {/* Tracking + ETA row */}
                    <div className="grid grid-cols-2 gap-2">
                        {/* Tracking ID */}
                        <button
                            onClick={copyTrackingId}
                            className={`flex-1 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all text-left ${copied
                                ? 'bg-green-50 border-green-200'
                                : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                                }`}
                        >
                            <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">{order.carrier}</p>
                                <p className="text-xs font-mono font-semibold truncate">{order.trackingId}</p>
                            </div>
                            {copied ? (
                                <Check size={13} className="text-green-500 flex-shrink-0" />
                            ) : (
                                <Clipboard size={13} className="text-gray-300 flex-shrink-0" />
                            )}
                        </button>

                        {/* ETA */}
                        {order.status !== 'delivered' ? (
                            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-black text-white rounded-xl sm:min-w-[180px]">
                                <Truck size={14} className="flex-shrink-0 opacity-60" />
                                <div>
                                    <p className="text-[9px] uppercase tracking-wider opacity-50 font-semibold">ETA</p>
                                    <p className="text-xs font-semibold">
                                        {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl sm:min-w-[180px]">
                                <CheckCircle2 size={14} className="flex-shrink-0" />
                                <div>
                                    <p className="text-[9px] uppercase tracking-wider opacity-60 font-semibold">Delivered</p>
                                    <p className="text-xs font-semibold">
                                        {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Items — compact row */}
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                        {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 pr-3 flex-shrink-0 min-w-0">
                                <div className="w-10 h-10 bg-white rounded-lg overflow-hidden flex-shrink-0">
                                    <img src={item.product.images?.[0] || ''} alt={item.product.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold truncate max-w-[120px]">{item.product.name}</p>
                                    <p className="text-[10px] text-gray-400">{item.size} · ×{item.quantity}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Address — inline */}
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <MapPin size={11} className="flex-shrink-0" />
                        <p className="truncate">{order.address}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============= TAP-TO-COPY CHIP =============

function CopyChip({ orderId, onPaste }: { orderId: string; onPaste: (id: string) => void }) {
    const [copied, setCopied] = useState(false);

    const handleTap = () => {
        navigator.clipboard.writeText(orderId);
        setCopied(true);
        onPaste(orderId);
        setTimeout(() => setCopied(false), 1200);
    };

    return (
        <button
            onClick={handleTap}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all ${copied
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-gray-100 text-gray-600 border border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                }`}
        >
            {copied ? <Check size={10} /> : <Clipboard size={10} />}
            {copied ? 'Copied!' : orderId}
        </button>
    );
}

// ============= PAGE =============

export default function TrackOrderPage() {
    const [searchId, setSearchId] = useState('');
    const [searchResult, setSearchResult] = useState<MockOrder | null>(null);
    const [searched, setSearched] = useState(false);

    const handleSearch = (id?: string) => {
        const query = id || searchId;
        const found = MOCK_ORDERS.find(o => o.id.toLowerCase() === query.trim().toLowerCase());
        setSearchResult(found || null);
        setSearched(true);
    };

    const handlePaste = (id: string) => {
        setSearchId(id);
    };

    return (
        <PreviewShell hideFooter showWatermark>
            <div className="max-w-screen-xl mx-auto px-4 py-6 md:py-10">
                {/* ── Header + Search ── */}
                <div className="max-w-lg mx-auto text-center mb-8">
                    <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Package size={18} className="text-gray-400" />
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight mb-1">Track Your Order</h1>
                    <p className="text-gray-400 text-xs mb-5">Enter your order ID for real-time tracking</p>

                    {/* Search bar */}
                    <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus-within:ring-2 focus-within:ring-black/10 focus-within:border-black/20 transition-all">
                            <Search size={16} className="text-gray-300 flex-shrink-0" />
                            <input
                                type="text"
                                value={searchId}
                                onChange={e => setSearchId(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="e.g. ORD-2026-4829"
                                className="w-full bg-transparent text-sm focus:outline-none placeholder:text-gray-300"
                            />
                        </div>
                        <button
                            onClick={() => handleSearch()}
                            className="px-5 py-2.5 bg-black text-white rounded-xl text-xs font-semibold hover:bg-black/90 transition-colors flex items-center gap-1.5"
                        >
                            Track
                            <ArrowRight size={13} />
                        </button>
                    </div>

                    {/* Tap-to-copy demo IDs */}
                    <div className="flex items-center justify-center gap-2 mt-3">
                        <span className="text-[10px] text-gray-300 uppercase tracking-wider font-medium">Try:</span>
                        {MOCK_ORDERS.map(o => (
                            <CopyChip key={o.id} orderId={o.id} onPaste={handlePaste} />
                        ))}
                    </div>
                </div>

                {/* ── Search Result ── */}
                {searched && searchResult && (
                    <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <OrderCard order={searchResult} defaultExpanded />
                    </div>
                )}

                {searched && !searchResult && searchId && (
                    <div className="max-w-sm mx-auto text-center py-10 mb-8">
                        <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Package size={20} className="text-gray-300" />
                        </div>
                        <h3 className="font-bold text-sm mb-1">Order Not Found</h3>
                        <p className="text-gray-400 text-xs">No order with ID &quot;{searchId}&quot;. Check and try again.</p>
                    </div>
                )}

                {/* ── Recent Orders ── */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-gray-800">Recent Orders</h2>
                        <span className="text-[10px] text-gray-300 font-medium">{MOCK_ORDERS.length} orders</span>
                    </div>
                    <div className="space-y-2.5">
                        {MOCK_ORDERS.map(order => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                </div>
            </div>
        </PreviewShell>
    );
}
