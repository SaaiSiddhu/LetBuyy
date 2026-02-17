'use client';

import PreviewShell from '../_components/preview-shell';
import { MOCK_PRODUCTS, formatPrice } from '../_lib/mock-data';
import { useCart } from '@/context/cart-context';
import {
    Minus, Plus, Trash2, ShoppingBag, ArrowRight, Truck, Shield,
    RotateCcw, Tag, ChevronRight, Heart, Sparkles, Star
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function CartPage() {
    const { items, updateQuantity, removeFromCart, cartTotal, cartCount, clearCart } = useCart();
    const [coupon, setCoupon] = useState('');
    const [couponApplied, setCouponApplied] = useState(false);

    const discount = couponApplied ? Math.round(cartTotal * 0.1) : 0;
    const shipping = cartTotal >= 2000 ? 0 : 99;
    const subtotalAfterDiscount = cartTotal - discount;
    const tax = Math.round(subtotalAfterDiscount * 0.18);
    const orderTotal = subtotalAfterDiscount + shipping + tax;

    const handleApplyCoupon = () => {
        if (coupon.toLowerCase() === 'urban10') {
            setCouponApplied(true);
        }
    };

    // Suggested products (not in cart)
    const cartIds = new Set(items.map(i => i.id));
    const suggested = MOCK_PRODUCTS.filter(p => !cartIds.has(p.id)).slice(0, 4);

    return (
        <PreviewShell hideFooter showWatermark>
            <div className="max-w-screen-xl mx-auto px-4 py-6 md:py-10">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
                    <Link href="/theme-preview/urban-kicks" className="hover:text-black transition-colors">Home</Link>
                    <ChevronRight size={12} />
                    <span className="text-black font-medium">Cart</span>
                </nav>

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Shopping Cart</h1>
                        {cartCount > 0 && (
                            <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full font-medium">
                                {cartCount} {cartCount === 1 ? 'item' : 'items'}
                            </span>
                        )}
                    </div>
                    {items.length > 0 && (
                        <button
                            onClick={clearCart}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                        >
                            <Trash2 size={12} /> Clear All
                        </button>
                    )}
                </div>

                {items.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                        {/* ═══ Cart Items ═══ */}
                        <div className="lg:col-span-7 xl:col-span-8">
                            {/* Free shipping progress */}
                            {cartTotal < 2000 && (
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 flex items-center gap-2.5">
                                    <Truck size={16} className="text-amber-600 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-xs text-amber-800">
                                            Add <span className="font-bold">{formatPrice(2000 - cartTotal)}</span> more for <span className="font-semibold text-green-700">FREE shipping!</span>
                                        </p>
                                        <div className="mt-1.5 h-1.5 w-full bg-amber-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min((cartTotal / 2000) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Items list */}
                            <div className="space-y-3">
                                {items.map(item => (
                                    <div
                                        key={item.id}
                                        className="flex gap-3 bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-all group"
                                    >
                                        {/* Thumbnail — compact fixed size */}
                                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                                            <img
                                                src={item.images?.[0] || ''}
                                                alt={item.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{item.category}</p>
                                                        <h3 className="font-semibold text-sm leading-tight truncate">{item.name}</h3>
                                                        <p className="text-[11px] text-gray-400 mt-0.5">Size: UK 9 · Color: Default</p>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100 sm:opacity-100"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between mt-2">
                                                {/* Quantity stepper */}
                                                <div className="inline-flex items-center border border-gray-200 rounded-lg h-8">
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                        className="w-8 h-full flex items-center justify-center hover:bg-gray-50 transition-colors rounded-l-lg"
                                                    >
                                                        <Minus size={12} />
                                                    </button>
                                                    <span className="w-8 text-center text-xs font-semibold border-x border-gray-200">{item.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                        className="w-8 h-full flex items-center justify-center hover:bg-gray-50 transition-colors rounded-r-lg"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>

                                                {/* Price */}
                                                <div className="text-right">
                                                    <p className="font-bold text-sm">{formatPrice(item.price * item.quantity)}</p>
                                                    {item.quantity > 1 && (
                                                        <p className="text-[10px] text-gray-400">{formatPrice(item.price)} each</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Continue Shopping */}
                            <Link
                                href="/theme-preview/urban-kicks/shop"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black transition-colors mt-4"
                            >
                                <ArrowRight size={12} className="rotate-180" /> Continue Shopping
                            </Link>
                        </div>

                        {/* ═══ Order Summary ═══ */}
                        <div className="lg:col-span-5 xl:col-span-4">
                            <div className="bg-gray-50 rounded-2xl p-5 sticky top-36 space-y-4">
                                <h3 className="font-bold text-base">Order Summary</h3>

                                {/* Line items */}
                                <div className="space-y-2.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Subtotal ({cartCount} items)</span>
                                        <span className="font-medium">{formatPrice(cartTotal)}</span>
                                    </div>
                                    {couponApplied && (
                                        <div className="flex justify-between text-green-600">
                                            <span className="flex items-center gap-1">
                                                <Tag size={12} /> Discount (10%)
                                            </span>
                                            <span className="font-medium">−{formatPrice(discount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Shipping</span>
                                        <span className={`font-medium ${shipping === 0 ? 'text-green-600' : ''}`}>
                                            {shipping === 0 ? 'FREE' : formatPrice(shipping)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Tax (GST 18%)</span>
                                        <span className="font-medium">{formatPrice(tax)}</span>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 pt-3 flex justify-between items-baseline">
                                    <span className="font-bold">Total</span>
                                    <div className="text-right">
                                        <p className="font-bold text-xl">{formatPrice(orderTotal)}</p>
                                        {couponApplied && (
                                            <p className="text-[10px] text-green-600 font-medium">You save {formatPrice(discount)}!</p>
                                        )}
                                    </div>
                                </div>

                                {/* Coupon */}
                                <div>
                                    {couponApplied ? (
                                        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                            <span className="text-xs font-medium text-green-700 flex items-center gap-1">
                                                <Tag size={12} /> URBAN10 applied
                                            </span>
                                            <button
                                                onClick={() => { setCouponApplied(false); setCoupon(''); }}
                                                className="text-xs text-green-600 hover:text-red-500 font-medium"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={coupon}
                                                onChange={e => setCoupon(e.target.value)}
                                                placeholder="Coupon code"
                                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                                            />
                                            <button
                                                onClick={handleApplyCoupon}
                                                className="px-3 py-2 border border-black rounded-lg text-xs font-semibold hover:bg-black hover:text-white transition-colors"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    )}
                                    {!couponApplied && (
                                        <p className="text-[10px] text-gray-400 mt-1.5">Try: <span className="font-medium text-black">URBAN10</span> for 10% off</p>
                                    )}
                                </div>

                                {/* CTA */}
                                <Link
                                    href="/theme-preview/urban-kicks/checkout"
                                    className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-xl text-sm font-semibold hover:bg-black/90 active:scale-[0.98] transition-all"
                                >
                                    Checkout · {formatPrice(orderTotal)} <ArrowRight size={14} />
                                </Link>

                                {/* Trust */}
                                <div className="grid grid-cols-3 gap-1 pt-2">
                                    {[
                                        { icon: Truck, label: 'Free Ship 2K+' },
                                        { icon: Shield, label: 'Secure Pay' },
                                        { icon: RotateCcw, label: '7-Day Return' },
                                    ].map(({ icon: Icon, label }) => (
                                        <div key={label} className="text-center py-2">
                                            <Icon size={14} className="mx-auto text-gray-400 mb-0.5" />
                                            <p className="text-[9px] text-gray-500 leading-tight font-medium">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ═══ Empty Cart ═══ */
                    <div className="text-center py-16 md:py-24">
                        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <ShoppingBag size={32} className="text-gray-300" />
                        </div>
                        <h2 className="text-lg font-bold mb-1">Your cart is empty</h2>
                        <p className="text-gray-500 text-sm mb-6">Looks like you haven&apos;t added anything yet.</p>
                        <Link
                            href="/theme-preview/urban-kicks/shop"
                            className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-black/90 transition-colors"
                        >
                            <ShoppingBag size={14} /> Start Shopping
                        </Link>
                    </div>
                )}

                {/* ═══ You May Also Like ═══ */}
                {items.length > 0 && suggested.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                                <Sparkles size={16} /> You May Also Like
                            </h2>
                            <Link href="/theme-preview/urban-kicks/shop" className="text-xs font-medium text-gray-500 hover:text-black transition-colors flex items-center gap-1">
                                View All <ChevronRight size={12} />
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {suggested.map(product => (
                                <div key={product.id} className="group bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-all">
                                    <div className="relative aspect-square bg-gray-50 overflow-hidden">
                                        <img
                                            src={product.images?.[0] || ''}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        {product.isNew && (
                                            <span className="absolute top-1.5 left-1.5 bg-black text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">New</span>
                                        )}
                                    </div>
                                    <div className="p-2.5">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{product.category}</p>
                                        <h4 className="text-xs font-semibold leading-tight truncate mt-0.5">{product.name}</h4>
                                        <div className="flex items-center justify-between mt-1.5">
                                            <span className="font-bold text-xs">{formatPrice(product.price)}</span>
                                            {product.rating && (
                                                <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                                    <Star size={10} className="fill-yellow-400 text-yellow-400" /> {product.rating}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

        </PreviewShell>
    );
}
