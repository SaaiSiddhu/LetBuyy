'use client';

import { useState, type FormEvent } from 'react';
import {
    Package, Truck, CheckCircle, Clock, AlertCircle,
    Mail, Lock, Eye, EyeOff, Search, ArrowLeft, MapPin
} from '@letbuyy/ui';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import type { OrderModel, OrderStatus } from '@letbuyy/checkout-core';

interface OrdersClientProps {
    subdomain: string;
    storeName: string;
}

const statusConfig: Record<OrderStatus, { color: string; icon: typeof Package; label: string }> = {
    pending: { color: '#f59e0b', icon: Clock, label: 'Pending' },
    pending_cod: { color: '#f59e0b', icon: Clock, label: 'COD pending' },
    confirmed: { color: '#3b82f6', icon: CheckCircle, label: 'Confirmed' },
    processing: { color: '#0ea5e9', icon: Package, label: 'Processing' },
    shipped: { color: '#8b5cf6', icon: Truck, label: 'Shipped' },
    delivered: { color: '#10b981', icon: Package, label: 'Delivered' },
    cancelled: { color: '#ef4444', icon: AlertCircle, label: 'Cancelled' },
    refunded: { color: '#64748b', icon: AlertCircle, label: 'Refunded' },
};

const timelineStatuses: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
const productImageFallback = '/images/banners/new-arrivals-1.png';

function timelineIndex(status: OrderStatus): number {
    return status === 'pending_cod' ? 0 : timelineStatuses.indexOf(status);
}

export default function OrdersClient({ subdomain }: OrdersClientProps) {
    const basePath = `/store/${subdomain}`;
    const [step, setStep] = useState<'login' | 'orders'>('login');
    const [emailOrPhone, setEmailOrPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isNewUser, setIsNewUser] = useState(false);
    const [contactChecked, setContactChecked] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [orders, setOrders] = useState<OrderModel[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<OrderModel | null>(null);

    const primaryColor = 'var(--primary, #6366f1)';

    const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (contactChecked) {
            void handleSubmit();
        } else {
            void handleCheckContact();
        }
    };

    // Check if user has orders and if password is set
    const handleCheckContact = async () => {
        if (!emailOrPhone.trim()) {
            setError('Please enter email or phone');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/orders/check?contact=${encodeURIComponent(emailOrPhone)}&subdomain=${subdomain}`);
            const data = await res.json();

            if (data.hasOrders) {
                setIsNewUser(!data.hasPassword);
                setContactChecked(true);
                setPassword('');
            } else {
                setContactChecked(false);
                setError('No orders found for this email/phone');
            }
        } catch {
            setContactChecked(false);
            setError('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Login or set password
    const handleSubmit = async () => {
        if (!password.trim() || password.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const endpoint = isNewUser ? '/api/orders/set-password' : '/api/orders/login';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailOrPhone, password, subdomain }),
            });
            const data = await res.json();

            if (data.success) {
                setOrders(data.orders || []);
                setStep('orders');
            } else {
                setError(data.error || 'Invalid credentials');
            }
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Order Details Modal
    if (selectedOrder) {
        return (
            <div className="min-h-screen pt-20 pb-8" style={{ backgroundColor: 'var(--background, #f9fafb)' }}>
                <div className="container mx-auto px-4 max-w-2xl">
                    <button
                        onClick={() => setSelectedOrder(null)}
                        className="flex items-center gap-2 text-theme-secondary hover:opacity-70 mb-4"
                    >
                        <ArrowLeft size={18} /> Back to Orders
                    </button>

                    <div className="card-theme rounded-2xl shadow-lg overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-card">
                            <div className="flex items-center justify-between mb-4">
                                <h1 className="text-xl font-bold">{selectedOrder.orderNumber}</h1>
                                <span
                                    className="px-3 py-1 rounded-full text-sm font-medium text-white"
                                    style={{ backgroundColor: statusConfig[selectedOrder.status].color }}
                                >
                                    {statusConfig[selectedOrder.status].label}
                                </span>
                            </div>
                            <p className="text-sm text-theme-secondary">
                                Placed on {new Date(selectedOrder.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'short', year: 'numeric'
                                })}
                            </p>
                        </div>

                        {/* Status Timeline */}
                        <div className="p-6 border-b border-card">
                            <div className="flex items-center justify-between">
                                {timelineStatuses.map((status, i) => {
                                    const isActive = timelineIndex(selectedOrder.status) >= i;
                                    const Icon = statusConfig[status].icon;
                                    return (
                                        <div key={status} className="flex flex-col items-center gap-2">
                                            <div
                                                className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'text-white' : 'card-theme-secondary text-theme-muted'}`}
                                                style={{ backgroundColor: isActive ? statusConfig[status].color : undefined }}
                                            >
                                                <Icon size={20} />
                                            </div>
                                            <span className={`text-xs ${isActive ? 'font-medium' : 'text-theme-muted'}`}>
                                                {statusConfig[status].label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tracking */}
                        {selectedOrder.tracking?.number && (
                            <div className="p-6 border-b border-card bg-blue-500/10">
                                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                    <Truck size={16} className="text-blue-600" /> Tracking Information
                                </h3>
                                <p className="text-sm">
                                    <span className="text-theme-secondary">Carrier:</span> {selectedOrder.tracking.carrier || 'Standard'}
                                </p>
                                <p className="text-sm font-mono font-semibold">{selectedOrder.tracking.number}</p>
                            </div>
                        )}

                        {/* Items */}
                        <div className="p-6 border-b border-card">
                            <h3 className="font-semibold mb-4">Items</h3>
                            <div className="space-y-3">
                                {selectedOrder.items.map((item, i) => (
                                    <div key={i} className="flex gap-3">
                                        <img
                                            src={item.image || productImageFallback}
                                            alt={item.name || 'Product image'}
                                            className="w-16 h-16 rounded-lg object-cover"
                                        />
                                        <div className="flex-1">
                                            <p className="font-medium">{item.name}</p>
                                            <p className="text-sm text-theme-secondary">Qty: {item.quantity}</p>
                                        </div>
                                        <p className="font-semibold">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Delivery Address */}
                        <div className="p-6 border-b border-card">
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <MapPin size={16} /> Delivery Address
                            </h3>
                            <p className="text-sm text-theme-secondary">
                                {selectedOrder.customer.name}<br />
                                {selectedOrder.customer.address.address}<br />
                                {selectedOrder.customer.address.city}, {selectedOrder.customer.address.state} - {selectedOrder.customer.address.pincode}
                            </p>
                        </div>

                        {/* Summary */}
                        <div className="p-6 card-theme-secondary">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-theme-secondary">Subtotal</span>
                                    <span>₹{selectedOrder.pricing.subtotal.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-theme-secondary">Delivery</span>
                                    <span>{selectedOrder.pricing.deliveryCharge === 0 ? 'Free' : `₹${selectedOrder.pricing.deliveryCharge}`}</span>
                                </div>
                                <div className="flex justify-between font-bold text-lg pt-2 border-t border-card">
                                    <span>Total</span>
                                    <span style={{ color: primaryColor }}>₹{selectedOrder.pricing.total.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Orders List
    if (step === 'orders') {
        return (
            <div className="min-h-screen pt-20 pb-8" style={{ backgroundColor: 'var(--background, #f9fafb)' }}>
                <div className="container mx-auto px-4 max-w-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold">Your Orders</h1>
                        <button
                            onClick={() => {
                                setStep('login');
                                setOrders([]);
                                setEmailOrPhone('');
                                setPassword('');
                                setContactChecked(false);
                                setIsNewUser(false);
                            }}
                            className="text-sm text-theme-secondary hover:opacity-70"
                        >
                            Logout
                        </button>
                    </div>

                    {orders.length === 0 ? (
                        <div className="card-theme rounded-2xl p-12 text-center">
                            <Package size={48} className="text-theme-hint mx-auto mb-4" />
                            <p className="text-theme-secondary">No orders found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {orders.map(order => {
                                const StatusIcon = statusConfig[order.status].icon;
                                return (
                                    <motion.div
                                        key={order.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="card-theme rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                                        onClick={() => setSelectedOrder(order)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="font-bold">{order.orderNumber}</p>
                                                <p className="text-xs text-theme-secondary">
                                                    {new Date(order.createdAt).toLocaleDateString('en-IN')}
                                                </p>
                                            </div>
                                            <span
                                                className="px-2 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1"
                                                style={{ backgroundColor: statusConfig[order.status].color }}
                                            >
                                                <StatusIcon size={12} />
                                                {statusConfig[order.status].label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {order.items.slice(0, 3).map((item, i) => (
                                                <img
                                                    key={i}
                                                    src={item.image || productImageFallback}
                                                    alt={item.name || 'Product image'}
                                                    className="w-12 h-12 rounded-lg object-cover"
                                                />
                                            ))}
                                            {order.items.length > 3 && (
                                                <span className="text-xs text-theme-secondary">+{order.items.length - 3} more</span>
                                            )}
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-card flex justify-between items-center">
                                            <span className="text-sm text-theme-secondary">{order.items.length} item(s)</span>
                                            <span className="font-bold" style={{ color: primaryColor }}>
                                                ₹{order.pricing.total.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}

                    <Link
                        href={basePath}
                        className="block text-center mt-6 font-medium"
                        style={{ color: primaryColor }}
                    >
                        Continue Shopping
                    </Link>
                </div>
            </div>
        );
    }

    // Login Form
    return (
        <div className="min-h-screen pt-20 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--background, #f9fafb)' }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-theme p-8 rounded-2xl shadow-xl max-w-md w-full"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                        <Package size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">Track Your Orders</h1>
                    <p className="text-theme-secondary text-sm mt-1">Enter your email or phone to view orders</p>
                </div>

                <form className="space-y-4" onSubmit={handleFormSubmit}>
                    <div>
                        <label className="text-sm font-medium text-theme-secondary block mb-1">Email or Phone</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                            <input
                                type="text"
                                value={emailOrPhone}
                                onChange={e => {
                                    setEmailOrPhone(e.target.value);
                                    setError('');
                                    setIsNewUser(false);
                                    setContactChecked(false);
                                    setPassword('');
                                }}
                                placeholder="your@email.com or 9876543210"
                                className="w-full pl-10 pr-4 py-3 input-theme rounded-xl text-sm outline-none focus:ring-2"
                                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                            />
                        </div>
                    </div>

                    <AnimatePresence>
                        {contactChecked && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <label className="text-sm font-medium text-theme-secondary block mb-1">
                                    {isNewUser ? 'Set a Password' : 'Password'}
                                </label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setError(''); }}
                                        placeholder={isNewUser ? 'Create a password' : 'Enter your password'}
                                        className="w-full pl-10 pr-12 py-3 input-theme rounded-xl text-sm outline-none focus:ring-2"
                                        style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {isNewUser && (
                                    <p className="text-xs text-theme-secondary mt-1">
                                        Set a password to securely access your orders
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {error && (
                        <p className="text-red-500 text-sm text-center">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{ backgroundColor: primaryColor }}
                    >
                        {isLoading ? (
                            <span className="animate-spin">⏳</span>
                        ) : (
                            <>
                                <Search size={18} />
                                {isNewUser ? 'Set Password & View Orders' : contactChecked ? 'View Orders' : 'Find Orders'}
                            </>
                        )}
                    </button>
                </form>

                <Link
                    href={basePath}
                    className="block text-center mt-6 text-sm text-theme-secondary hover:opacity-70"
                >
                    ← Back to Store
                </Link>
            </motion.div>
        </div>
    );
}
