'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CreditCard, Shield, ArrowLeft, Lock, Skeleton, useToast } from '@letbuyy/ui';
import { formatPrice, cn } from '@/lib/utils';

type CheckoutTheme = {
    slug: string;
    name: string;
    category: string;
    thumbnail_url: string;
    letbuyy_price_usd: number;
};

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(record: Record<string, unknown>, key: string, fallback = ''): string {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(record: Record<string, unknown>, key: string, fallback = 0): number {
    const value = record[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeCheckoutTheme(payload: unknown): CheckoutTheme | null {
    const root = recordValue(payload);
    const theme = recordValue(root.theme);
    const slug = stringValue(theme, 'slug');
    const name = stringValue(theme, 'name');

    if (!slug || !name) return null;

    return {
        slug,
        name,
        category: stringValue(theme, 'category', 'theme'),
        thumbnail_url: stringValue(theme, 'thumbnail_url', '/previews/store.png'),
        letbuyy_price_usd: numberValue(theme, 'letbuyy_price_usd'),
    };
}

function CheckoutSkeleton() {
    return (
        <div className="container-main py-10 md:py-16 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-3 space-y-6">
                    <Skeleton lines={2} />
                    <Card className="p-5">
                        <Skeleton variant="card" className="h-28" />
                    </Card>
                    <Card className="p-5">
                        <Skeleton lines={4} />
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <Card className="p-5">
                        <Skeleton variant="card" className="h-56" />
                    </Card>
                </div>
            </div>
        </div>
    );
}

function CheckoutContent() {
    const searchParams = useSearchParams();
    const themeSlug = searchParams.get('theme');
    const { notify } = useToast();
    const [theme, setTheme] = useState<CheckoutTheme | null>(null);
    const [loading, setLoading] = useState(Boolean(themeSlug));
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'razorpay'>('stripe');
    const [coupon, setCoupon] = useState('');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');

    useEffect(() => {
        if (!themeSlug) {
            return;
        }
        let cancelled = false;

        fetch(`/api/themes/${themeSlug}`)
            .then(res => res.json())
            .then(data => {
                if (!cancelled) setTheme(normalizeCheckoutTheme(data));
            })
            .catch(() => {
                if (cancelled) return;
                setTheme(null);
                notify({
                    title: 'Theme checkout unavailable',
                    description: 'Theme details could not be loaded for checkout.',
                    variant: 'critical',
                });
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [notify, themeSlug]);

    if (loading) {
        return <CheckoutSkeleton />;
    }

    if (!theme) {
        return (
            <div className="container-main py-20 text-center">
                <h1 className="text-2xl font-bold mb-4">No theme selected</h1>
                <Link href="/themes" className="btn-primary">Browse Themes</Link>
            </div>
        );
    }

    return (
        <div className="container-main py-10 md:py-16 max-w-4xl mx-auto">
            {/* Back */}
            <Link href={`/themes/${theme.slug}`} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-heading mb-8">
                <ArrowLeft className="w-4 h-4" />
                Back to {theme.name}
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Checkout Form */}
                <div className="lg:col-span-3 space-y-6">
                    <h1 className="text-2xl font-bold">Checkout</h1>

                    {/* Payment Method */}
                    <div>
                        <h3 className="text-sm font-semibold text-text-heading mb-3">Payment Method</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setPaymentMethod('stripe')}
                                className={cn(
                                    'rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-4 text-center transition-all',
                                    paymentMethod === 'stripe' ? 'ring-2 ring-primary/60 border-primary/40' : '',
                                )}
                                type="button"
                            >
                                <CreditCard className="w-5 h-5 mx-auto mb-2 text-primary-light" />
                                <p className="text-sm font-medium text-text-heading">Stripe</p>
                                <p className="text-[10px] text-text-subtle">Cards, Apple Pay</p>
                            </button>
                            <button
                                onClick={() => setPaymentMethod('razorpay')}
                                className={cn(
                                    'rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-4 text-center transition-all',
                                    paymentMethod === 'razorpay' ? 'ring-2 ring-primary/60 border-primary/40' : '',
                                )}
                                type="button"
                            >
                                <Shield className="w-5 h-5 mx-auto mb-2 text-secondary" />
                                <p className="text-sm font-medium text-text-heading">Razorpay</p>
                                <p className="text-[10px] text-text-subtle">UPI, Netbanking, Cards</p>
                            </button>
                        </div>
                    </div>

                    {/* Billing Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-text-heading mb-3">Billing Information</h3>
                        <div className="space-y-3">
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-text-heading placeholder-text-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <input
                                type="text"
                                placeholder="Full name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg bg-bg-card border border-border text-text-heading placeholder-text-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    {/* Coupon */}
                    <div>
                        <h3 className="text-sm font-semibold text-text-heading mb-3">Coupon Code</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Enter coupon code"
                                value={coupon}
                                onChange={e => setCoupon(e.target.value)}
                                className="flex-grow px-4 py-3 rounded-lg bg-bg-card border border-border text-text-heading placeholder-text-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <button className="btn-secondary text-sm py-3 px-5">Apply</button>
                        </div>
                    </div>

                    {/* Submit */}
                    <Link
                        href={`/checkout/success?theme=${theme.slug}`}
                        onClick={() => notify({
                            title: 'Starting purchase',
                            description: `${theme.name} is being prepared for checkout.`,
                            variant: 'info',
                        })}
                        className="btn-primary w-full text-center py-4 flex items-center justify-center gap-2 text-base"
                    >
                        <Lock className="w-4 h-4" />
                        Pay {formatPrice(theme.letbuyy_price_usd)}
                    </Link>

                    <p className="text-xs text-text-subtle text-center">
                        🔒 Secure checkout • 30-day money-back guarantee
                    </p>
                </div>

                {/* Order Summary */}
                <div className="lg:col-span-2">
                    <div className="glass-card p-5 sticky top-24">
                        <h3 className="text-sm font-semibold text-text-heading mb-4">Order Summary</h3>

                        <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
                            <div className="relative w-16 h-12 overflow-hidden rounded-lg flex-shrink-0 border border-border bg-surface">
                                <Image
                                    src={theme.thumbnail_url}
                                    alt={theme.name}
                                    fill
                                    className="object-cover"
                                    sizes="64px"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-text-heading">{theme.name}</p>
                                <p className="text-[11px] text-text-muted capitalize">{theme.category} Theme • Single License</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-text-muted">Subtotal</span>
                                <span className="text-text-heading">{formatPrice(theme.letbuyy_price_usd)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-text-muted">Tax</span>
                                <span className="text-text-heading">$0.00</span>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-border flex items-center justify-between">
                            <span className="text-sm font-semibold text-text-heading">Total</span>
                            <span className="text-lg font-bold text-text-heading">{formatPrice(theme.letbuyy_price_usd)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={<CheckoutSkeleton />}>
            <CheckoutContent />
        </Suspense>
    );
}
