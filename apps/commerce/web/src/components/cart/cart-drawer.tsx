'use client';

import { useCart } from '@/context/cart-context';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, ArrowRight, Minus, Plus, ShoppingBag, X } from '@letbuyy/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';

interface CartDrawerProps {
    basePath: string;
    primaryColor: string;
}

const productImageFallback = '/images/banners/new-arrivals-1.png';

const formatPrice = (amount: number, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount);

export default function CartDrawer({ basePath, primaryColor }: CartDrawerProps) {
    const {
        items,
        removeFromCart,
        updateQuantity,
        cartTotal,
        cartCount,
        isOpen,
        setIsOpen,
    } = useCart();

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, setIsOpen]);

    const closeDrawer = () => setIsOpen(false);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.button
                        aria-label="Close cart"
                        className="fixed inset-0 z-[80] bg-black/50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeDrawer}
                    />
                    <motion.aside
                        aria-label="Shopping cart"
                        aria-modal="true"
                        role="dialog"
                        className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col card-theme shadow-2xl sm:max-w-md"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                    >
                        <div className="flex min-h-[64px] items-center justify-between border-b border-card px-5">
                            <div>
                                <p className="text-xs font-semibold uppercase text-card-muted">Cart</p>
                                <h2 className="text-lg font-bold text-card">
                                    {cartCount} item{cartCount === 1 ? '' : 's'}
                                </h2>
                            </div>
                            <Button unstyled
                                type="button"
                                aria-label="Close cart"
                                onClick={closeDrawer}
                                className="flex h-11 w-11 items-center justify-center rounded-lg text-card-muted transition-colors hover:bg-surface-hover hover:text-card"
                            >
                                <X size={20} />
                            </Button>
                        </div>

                        {items.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full card-theme-secondary">
                                    <ShoppingBag size={32} className="text-card-muted" />
                                </div>
                                <h3 className="text-xl font-bold text-card">Your bag is empty</h3>
                                <p className="mt-2 max-w-xs text-sm text-card-muted">
                                    Add a pair to your bag and check out when you are ready.
                                </p>
                                <Link
                                    href={`${basePath}/shop`}
                                    onClick={closeDrawer}
                                    className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    Browse products
                                </Link>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 overflow-y-auto px-4 py-4">
                                    <div className="space-y-3">
                                        {items.map((item) => {
                                            const imageUrl = item.images[0] || productImageFallback;
                                            const currency = item.currency || 'INR';

                                            return (
                                                <div
                                                    key={item.id}
                                                    className="flex gap-3 rounded-lg border border-card p-3"
                                                >
                                                    <Link
                                                        href={`${basePath}/product/${item.id}`}
                                                        onClick={closeDrawer}
                                                        className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg card-theme-secondary"
                                                    >
                                                        <Image
                                                            src={imageUrl}
                                                            alt={item.name}
                                                            fill
                                                            sizes="80px"
                                                            className="object-cover"
                                                            unoptimized
                                                        />
                                                    </Link>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <Link
                                                                    href={`${basePath}/product/${item.id}`}
                                                                    onClick={closeDrawer}
                                                                    className="block truncate text-sm font-semibold text-card hover:opacity-80"
                                                                >
                                                                    {item.name}
                                                                </Link>
                                                                <p className="mt-1 text-xs text-card-muted">
                                                                    {formatPrice(item.price, currency)} each
                                                                </p>
                                                            </div>
                                                            <Button unstyled
                                                                type="button"
                                                                aria-label={`Remove ${item.name}`}
                                                                onClick={() => removeFromCart(item.id)}
                                                                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-card-muted transition-colors hover:bg-surface-hover hover:text-red-500"
                                                            >
                                                                <X size={16} />
                                                            </Button>
                                                        </div>

                                                        {item.selectedVariant && Object.keys(item.selectedVariant).length > 0 && (
                                                            <div className="mt-2 flex flex-wrap gap-1">
                                                                {Object.entries(item.selectedVariant).map(([key, value]) => (
                                                                    <span
                                                                        key={`${item.id}-${key}`}
                                                                        className="rounded card-theme-secondary px-2 py-1 text-[11px] text-card-muted"
                                                                    >
                                                                        {key}: {value}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="mt-3 flex items-center justify-between gap-3">
                                                            <div className="flex min-h-11 items-center overflow-hidden rounded-lg border border-card">
                                                                <Button unstyled
                                                                    type="button"
                                                                    aria-label={`Decrease quantity for ${item.name}`}
                                                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                                    className="flex h-11 w-11 items-center justify-center text-card transition-colors hover:bg-surface-hover"
                                                                >
                                                                    <Minus size={14} />
                                                                </Button>
                                                                <span className="w-9 text-center text-sm font-semibold text-card">
                                                                    {item.quantity}
                                                                </span>
                                                                <Button unstyled
                                                                    type="button"
                                                                    aria-label={`Increase quantity for ${item.name}`}
                                                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                                    className="flex h-11 w-11 items-center justify-center text-card transition-colors hover:bg-surface-hover"
                                                                >
                                                                    <Plus size={14} />
                                                                </Button>
                                                            </div>
                                                            <p className="text-sm font-bold text-card">
                                                                {formatPrice(item.price * item.quantity, currency)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="border-t border-card p-5">
                                    <div className="mb-4 flex items-center justify-between text-base font-bold text-card">
                                        <span>Subtotal</span>
                                        <span>{formatPrice(cartTotal, items[0]?.currency || 'INR')}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Link
                                            href={`${basePath}/cart`}
                                            onClick={closeDrawer}
                                            className="flex min-h-11 items-center justify-center rounded-lg border border-card px-4 text-sm font-semibold text-card transition-colors hover:bg-surface-hover"
                                        >
                                            View bag
                                        </Link>
                                        <Link
                                            href={`${basePath}/checkout`}
                                            onClick={closeDrawer}
                                            className="flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            Checkout <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
