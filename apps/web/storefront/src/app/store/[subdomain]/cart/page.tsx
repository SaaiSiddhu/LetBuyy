'use client';

import { useCart } from '@/context/cart-context';
import Link from 'next/link';
import { Trash2, Plus, Minus, ArrowRight, ArrowLeft, ShoppingBag, Tag, X, Check, Ticket, Shield, Truck, Package } from 'lucide-react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface Coupon {
    code: string;
    discount: number;
    type: 'percent' | 'flat';
    minOrder: number;
    description: string;
}

// Demo coupons - in production this would come from Firestore
const DEMO_COUPONS: Coupon[] = [
    { code: 'SAVE10', discount: 10, type: 'percent', minOrder: 500, description: '10% off on orders above ₹500' },
    { code: 'FLAT50', discount: 50, type: 'flat', minOrder: 300, description: '₹50 off on orders above ₹300' },
    { code: 'FIRST100', discount: 100, type: 'flat', minOrder: 0, description: '₹100 off for new customers' },
];

export default function CartPage() {
    const { items, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart();
    const params = useParams();
    const subdomain = params.subdomain as string;

    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
    const [couponError, setCouponError] = useState('');
    const [showCoupons, setShowCoupons] = useState(false);

    // Theme colors - would come from store context in production
    const primaryColor = 'var(--primary, #6366f1)';

    // Calculate discount
    const calculateDiscount = () => {
        if (!appliedCoupon) return 0;
        if (appliedCoupon.type === 'percent') {
            return Math.round(cartTotal * (appliedCoupon.discount / 100));
        }
        return appliedCoupon.discount;
    };

    const discountAmount = calculateDiscount();
    const finalTotal = cartTotal - discountAmount;

    const applyCoupon = () => {
        setCouponError('');
        const coupon = DEMO_COUPONS.find(c => c.code.toLowerCase() === couponCode.toLowerCase());

        if (!coupon) {
            setCouponError('Invalid coupon code');
            return;
        }

        if (cartTotal < coupon.minOrder) {
            setCouponError(`Minimum order ₹${coupon.minOrder} required`);
            return;
        }

        setAppliedCoupon(coupon);
        setCouponCode('');
    };

    const removeCoupon = () => {
        setAppliedCoupon(null);
        setCouponError('');
    };

    if (items.length === 0) {
        return (
            <div className="min-h-screen pt-20">
                <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-4">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-20 h-20 card-theme-secondary rounded-full flex items-center justify-center mb-6 shadow-inner"
                    >
                        <ShoppingBag size={32} className="text-theme-hint" />
                    </motion.div>
                    <h1 className="text-2xl font-bold mb-2 text-theme">Your Bag is Empty</h1>
                    <p className="text-theme-secondary mb-6 text-sm max-w-xs">Start shopping to add items to your bag</p>
                    <Link
                        href={`/shop`}
                        className="text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition-all hover:-translate-y-0.5"
                        style={{ backgroundColor: primaryColor }}
                    >
                        Browse Products
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-20" style={{ backgroundColor: 'var(--background, #f9fafb)' }}>
            <div className="container mx-auto px-4 max-w-5xl pb-8">
                {/* Header */}
                <div className="py-4">
                    <Link href={`/`} className="inline-flex items-center text-sm hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                        <ArrowLeft size={16} className="mr-2" /> Continue Shopping
                    </Link>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Shopping Bag</h1>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{items.length} item{items.length > 1 ? 's' : ''}</p>
                    </div>
                    <button
                        onClick={clearCart}
                        className="text-sm hover:text-red-500 transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        Clear All
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Cart Items - Compact */}
                    <div className="lg:col-span-2 space-y-3">
                        <AnimatePresence>
                            {items.map((item) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="card-theme p-3 rounded-xl shadow-sm border border-card flex gap-3"
                                >
                                    {/* Image - Compact */}
                                    <Link href={`/product/${item.id}`} className="flex-shrink-0">
                                        <div className="w-20 h-20 card-theme-secondary rounded-lg overflow-hidden">
                                            <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                                        </div>
                                    </Link>

                                    {/* Details */}
                                    <div className="flex-grow min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <h3 className="font-semibold text-sm text-card truncate">{item.name}</h3>
                                                {/* Variants Display */}
                                                {item.selectedVariant && Object.keys(item.selectedVariant).length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {Object.entries(item.selectedVariant).map(([key, value]) => (
                                                            <span key={key} className="text-[10px] px-1.5 py-0.5 card-theme-secondary text-card-muted rounded">
                                                                {key}: {value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Unit Price */}
                                                <p className="text-xs text-card-muted mt-1">₹{item.price.toLocaleString('en-IN')} each</p>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.id)}
                                                className="p-1.5 text-card-muted hover:text-red-500 transition-colors"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>

                                        {/* Quantity & Total */}
                                        <div className="flex justify-between items-center mt-2">
                                            <div className="flex items-center border border-card rounded-lg overflow-hidden">
                                                <button
                                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                    className="p-1.5 hover:bg-surface-hover transition-colors text-card"
                                                >
                                                    <Minus size={12} />
                                                </button>
                                                <span className="text-xs font-semibold w-6 text-center text-card">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                    className="p-1.5 hover:bg-surface-hover transition-colors text-card"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                            <p className="text-base font-bold" style={{ color: primaryColor }}>
                                                ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Coupon Section */}
                        <div className="card-theme p-4 rounded-xl shadow-sm border border-card">
                            <div className="flex items-center gap-2 mb-3">
                                <Ticket size={18} style={{ color: primaryColor }} />
                                <span className="font-semibold text-sm text-card">Apply Coupon</span>
                            </div>

                            {/* Applied Coupon */}
                            {appliedCoupon && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg mb-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <Check size={16} className="text-green-600" />
                                        <div>
                                            <p className="text-sm font-semibold text-green-700">{appliedCoupon.code}</p>
                                            <p className="text-xs text-green-600">Saving ₹{discountAmount}</p>
                                        </div>
                                    </div>
                                    <button onClick={removeCoupon} className="text-green-600 hover:text-green-800">
                                        <X size={16} />
                                    </button>
                                </motion.div>
                            )}

                            {/* Coupon Input */}
                            {!appliedCoupon && (
                                <>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                            placeholder="Enter coupon code"
                                            className="flex-1 px-3 py-2 border border-card rounded-lg text-sm outline-none text-card card-theme-secondary uppercase"
                                        />
                                        <button
                                            onClick={applyCoupon}
                                            disabled={!couponCode}
                                            className="px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-opacity"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                    {couponError && (
                                        <p className="text-red-500 text-xs mt-2">{couponError}</p>
                                    )}

                                    {/* Available Coupons */}
                                    <button
                                        onClick={() => setShowCoupons(!showCoupons)}
                                        className="text-xs mt-3 flex items-center gap-1 hover:opacity-70"
                                        style={{ color: 'var(--card-text-muted)' }}
                                    >
                                        <Tag size={12} />
                                        {showCoupons ? 'Hide available coupons' : 'View available coupons'}
                                    </button>

                                    <AnimatePresence>
                                        {showCoupons && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-3 space-y-2">
                                                    {DEMO_COUPONS.map((coupon) => (
                                                        <div
                                                            key={coupon.code}
                                                            className="flex items-center justify-between p-2 card-theme-secondary rounded-lg border border-dashed border-card"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-semibold text-card">{coupon.code}</p>
                                                                <p className="text-xs text-card-muted">{coupon.description}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setCouponCode(coupon.code);
                                                                    setShowCoupons(false);
                                                                }}
                                                                className="text-xs font-semibold"
                                                                style={{ color: primaryColor }}
                                                            >
                                                                Apply
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Order Summary - Sticky */}
                    <div className="lg:col-span-1">
                        <div className="card-theme p-5 rounded-xl shadow-sm border border-card sticky top-24">
                            <h2 className="text-lg font-bold mb-4 text-card">Order Summary</h2>

                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-card-muted">
                                    <span>Subtotal ({items.reduce((a, i) => a + i.quantity, 0)} items)</span>
                                    <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                                </div>

                                {appliedCoupon && (
                                    <div className="flex justify-between text-green-600">
                                        <span>Discount ({appliedCoupon.code})</span>
                                        <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                                    </div>
                                )}

                                <div className="flex justify-between text-card-muted">
                                    <span>Shipping</span>
                                    <span className="text-green-600 font-medium">Free</span>
                                </div>

                                <div className="border-t pt-3 flex justify-between font-bold text-lg" style={{ borderColor: 'var(--card-border)', color: 'var(--card-text)' }}>
                                    <span>Total</span>
                                    <span style={{ color: 'var(--card-text)' }}>₹{finalTotal.toLocaleString('en-IN')}</span>
                                </div>

                                {discountAmount > 0 && (
                                    <p className="text-xs text-green-600 text-center bg-green-50 py-1 rounded">
                                        🎉 You're saving ₹{discountAmount.toLocaleString('en-IN')}!
                                    </p>
                                )}
                            </div>

                            <Link
                                href={`/checkout`}
                                className="w-full mt-4 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:opacity-90"
                                style={{ backgroundColor: 'var(--card-bg)', color: 'var(--card-text)' }}
                            >
                                Proceed to Checkout <ArrowRight size={18} />
                            </Link>

                            {/* Trust Badges */}
                            <div className="mt-4 pt-4 grid grid-cols-3 gap-2" style={{ borderTop: '1px solid var(--card-border)' }}>
                                {[
                                    { icon: Shield, label: 'Secure' },
                                    { icon: Truck, label: 'Fast' },
                                    { icon: Package, label: 'Safe' },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex flex-col items-center text-center">
                                        <Icon size={16} style={{ color: 'var(--card-text-muted)', marginBottom: '4px' }} />
                                        <span className="text-[10px]" style={{ color: 'var(--card-text-muted)' }}>{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
