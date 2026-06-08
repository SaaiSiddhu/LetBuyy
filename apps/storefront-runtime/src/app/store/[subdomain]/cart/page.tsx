'use client';

import { useCart } from '@/context/cart-context';
import Link from 'next/link';
import { Button, Plus, Minus, ArrowRight, ArrowLeft, ShoppingBag, X, Shield, Truck, Package } from '@letbuyy/ui';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { StorefrontEmptyState } from '@/components/storefront/storefront-states';

const productImageFallback = '/images/banners/new-arrivals-1.png';

export default function CartPage() {
    const { items, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart();
    const params = useParams();
    const subdomain = params.subdomain as string;
    const basePath = `/store/${subdomain}`;

    // Theme colors - would come from store context in production
    const primaryColor = 'var(--primary, rgb(99 102 241))';
    const finalTotal = cartTotal;

    if (items.length === 0) {
        return (
            <div className="min-h-screen pt-20">
                <div className="min-h-[60vh] p-4">
                    <StorefrontEmptyState
                        icon={<ShoppingBag size={32} aria-hidden="true" />}
                        title="Your bag is empty"
                        body="Start shopping to add items to your bag."
                        actionHref={`${basePath}/shop`}
                        actionLabel="Browse products"
                        actionIcon={<ShoppingBag size={18} aria-hidden="true" />}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-20" style={{ backgroundColor: 'var(--background, rgb(249 250 251))' }}>
            <div className="container mx-auto px-4 max-w-5xl pb-8">
                {/* Header */}
                <div className="py-4">
                    <Link href={basePath} className="inline-flex items-center text-sm hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                        <ArrowLeft size={16} className="mr-2" /> Continue Shopping
                    </Link>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Shopping Bag</h1>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{items.length} item{items.length > 1 ? 's' : ''}</p>
                    </div>
                    <Button unstyled
                        onClick={clearCart}
                        aria-label="Clear all items from cart"
                        className="flex min-h-11 items-center px-2 text-sm hover:text-red-500 transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        Clear All
                    </Button>
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
                                    <Link href={`${basePath}/product/${item.id}`} className="flex-shrink-0">
                                        <div className="relative h-20 w-20 overflow-hidden rounded-lg card-theme-secondary">
                                            <Image
                                                src={item.images[0] || productImageFallback}
                                                alt={item.name}
                                                fill
                                                sizes="80px"
                                                className="object-cover"
                                                unoptimized
                                            />
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
                                            <Button unstyled
                                                onClick={() => removeFromCart(item.id)}
                                                aria-label={`Remove ${item.name} from cart`}
                                                className="flex h-11 w-11 items-center justify-center text-card-muted hover:text-red-500 transition-colors"
                                            >
                                                <X size={16} />
                                            </Button>
                                        </div>

                                        {/* Quantity & Total */}
                                        <div className="flex justify-between items-center mt-2">
                                            <div className="flex items-center border border-card rounded-lg overflow-hidden">
                                                <Button unstyled
                                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                    aria-label={`Decrease quantity of ${item.name}`}
                                                    className="flex h-11 w-11 items-center justify-center hover:bg-surface-hover transition-colors text-card"
                                                >
                                                    <Minus size={12} />
                                                </Button>
                                                <span className="text-xs font-semibold w-6 text-center text-card" aria-live="polite">{item.quantity}</span>
                                                <Button unstyled
                                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                    aria-label={`Increase quantity of ${item.name}`}
                                                    className="flex h-11 w-11 items-center justify-center hover:bg-surface-hover transition-colors text-card"
                                                >
                                                    <Plus size={12} />
                                                </Button>
                                            </div>
                                            <p className="text-base font-bold" style={{ color: primaryColor }}>
                                                ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
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

                                <div className="flex justify-between text-card-muted">
                                    <span>Shipping</span>
                                    <span className="text-green-600 font-medium">Free</span>
                                </div>

                                <div className="border-t pt-3 flex justify-between font-bold text-lg" style={{ borderColor: 'var(--card-border)', color: 'var(--card-text)' }}>
                                    <span>Total</span>
                                    <span style={{ color: 'var(--card-text)' }}>₹{finalTotal.toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                            <Link
                                href={`${basePath}/checkout`}
                                className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold shadow-lg transition-all hover:opacity-90"
                                style={{ backgroundColor: 'var(--card-bg)', color: 'var(--card-text)' }}
                            >
                                Proceed to Checkout <ArrowRight size={18} />
                            </Link>
                            <p className="mt-3 text-center text-xs" style={{ color: 'var(--card-text-muted)' }}>
                                Taxes, discounts, and final payment availability are verified during checkout.
                            </p>

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
