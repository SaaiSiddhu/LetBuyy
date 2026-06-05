'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    letbuyy_price_inr: number;
};

type CheckoutApiEnvelope<TData> = {
    success?: boolean;
    data?: TData;
    error?: {
        code?: string;
        message?: string;
    };
};

type PurchaseOrderData = {
    purchase_id: string;
    theme: string;
    status: string;
    already_purchased?: boolean;
    payment_required?: boolean;
    provider?: string;
    razorpay_order_id?: string;
    amount?: number;
    currency?: string;
    key_id?: string;
};

type RazorpayPaymentResponse = {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
};

type VerifyPurchaseData = {
    purchase_id: string;
    status: string;
};

type RazorpayCheckoutOptions = {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    prefill: {
        name: string;
        email: string;
    };
    handler: (response: RazorpayPaymentResponse) => void;
    modal?: {
        ondismiss?: () => void;
    };
};

type RazorpayCheckoutInstance = {
    open: () => void;
    on: (event: 'payment.failed', handler: (response: unknown) => void) => void;
};

declare global {
    interface Window {
        Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
    }
}

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
        letbuyy_price_inr: numberValue(theme, 'letbuyy_price_inr'),
    };
}

function displayPrice(theme: CheckoutTheme): string {
    return theme.letbuyy_price_inr > 0
        ? formatPrice(theme.letbuyy_price_inr, 'INR')
        : formatPrice(theme.letbuyy_price_usd);
}

function checkoutErrorMessage<TData>(payload: CheckoutApiEnvelope<TData>, fallback: string): string {
    if (payload.error?.code === 'PAYMENT_UNAVAILABLE') {
        return 'Theme payments are not configured for this environment.';
    }

    return payload.error?.message || fallback;
}

function loadRazorpayCheckout(): Promise<boolean> {
    if (window.Razorpay) return Promise.resolve(true);

    return new Promise((resolve) => {
        const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true });
            existingScript.addEventListener('error', () => resolve(false), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true });
        script.addEventListener('error', () => resolve(false), { once: true });
        document.body.appendChild(script);
    });
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
    const router = useRouter();
    const searchParams = useSearchParams();
    const themeSlug = searchParams.get('theme');
    const { notify } = useToast();
    const [theme, setTheme] = useState<CheckoutTheme | null>(null);
    const [loading, setLoading] = useState(Boolean(themeSlug));
    const [paymentMethod] = useState<'razorpay'>('razorpay');
    const [coupon, setCoupon] = useState('');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [purchasePending, setPurchasePending] = useState(false);
    const [purchaseError, setPurchaseError] = useState<string | null>(null);

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

    function handleApplyCoupon() {
        notify({
            title: 'Theme coupons are not configured',
            description: 'The current theme purchase contract does not accept coupon codes yet.',
            variant: 'warning',
        });
    }

    async function verifyRazorpayPayment(themeSlugValue: string, response: RazorpayPaymentResponse): Promise<VerifyPurchaseData> {
        const verifyResponse = await fetch(`/api/themes/${themeSlugValue}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'verify_purchase',
                provider: 'razorpay',
                provider_proof: response,
            }),
        });
        const verifyPayload = await verifyResponse.json().catch(() => ({})) as CheckoutApiEnvelope<VerifyPurchaseData>;

        if (!verifyResponse.ok || !verifyPayload.success || !verifyPayload.data) {
            throw new Error(checkoutErrorMessage(verifyPayload, 'Payment verification failed.'));
        }

        return verifyPayload.data;
    }

    async function openRazorpay(themeValue: CheckoutTheme, order: PurchaseOrderData) {
        const loaded = await loadRazorpayCheckout();
        const Razorpay = window.Razorpay;
        if (!loaded || !Razorpay) {
            throw new Error('Razorpay checkout could not be loaded.');
        }

        const key = order.key_id;
        const orderId = order.razorpay_order_id;
        const amount = order.amount;
        const currency = order.currency;
        if (!key || !orderId || !amount || !currency) {
            throw new Error('Theme payments are not configured for this environment.');
        }

        await new Promise<void>((resolve, reject) => {
            const checkout = new Razorpay({
                key,
                amount,
                currency,
                name: 'LetBuyy Theme Marketplace',
                description: themeValue.name,
                order_id: orderId,
                prefill: {
                    name,
                    email,
                },
                handler: (paymentResponse) => {
                    verifyRazorpayPayment(themeValue.slug, paymentResponse)
                        .then((verified) => {
                            router.push(`/checkout/success?theme=${themeValue.slug}&purchase=${verified.purchase_id}`);
                            resolve();
                        })
                        .catch(reject);
                },
                modal: {
                    ondismiss: () => reject(new Error('Payment was cancelled.')),
                },
            });

            checkout.on('payment.failed', () => reject(new Error('Payment failed before verification.')));
            checkout.open();
        });
    }

    async function handlePurchase() {
        if (!theme || purchasePending) return;

        if (!email.trim() || !name.trim()) {
            notify({
                title: 'Billing information required',
                description: 'Enter your name and email before starting checkout.',
                variant: 'warning',
            });
            return;
        }

        setPurchasePending(true);
        setPurchaseError(null);

        try {
            const response = await fetch(`/api/themes/${theme.slug}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'purchase',
                    currency: 'INR',
                    idempotency_key: `theme_${theme.slug}_${crypto.randomUUID()}`,
                }),
            });
            const payload = await response.json().catch(() => ({})) as CheckoutApiEnvelope<PurchaseOrderData>;

            if (!response.ok || !payload.success || !payload.data) {
                throw new Error(checkoutErrorMessage(payload, 'Theme purchase could not be started.'));
            }

            const order = payload.data;
            if (order.already_purchased || order.payment_required === false || order.status === 'completed') {
                router.push(`/checkout/success?theme=${theme.slug}&purchase=${order.purchase_id}`);
                return;
            }

            if (order.provider !== 'razorpay') {
                throw new Error('Theme payments are not configured for this environment.');
            }

            await openRazorpay(theme, order);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Theme purchase could not be started.';
            setPurchaseError(message);
            notify({
                title: 'Theme checkout unavailable',
                description: message,
                variant: 'critical',
            });
        } finally {
            setPurchasePending(false);
        }
    }

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
            <Link href={`/themes/${theme.slug}`} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-heading mb-8">
                <ArrowLeft className="w-4 h-4" />
                Back to {theme.name}
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-3 space-y-6">
                    <h1 className="text-2xl font-bold">Checkout</h1>

                    <div>
                        <h3 className="text-sm font-semibold text-text-heading mb-3">Payment Method</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                disabled
                                className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-4 text-center opacity-60"
                                type="button"
                            >
                                <CreditCard className="w-5 h-5 mx-auto mb-2 text-text-subtle" />
                                <p className="text-sm font-medium text-text-heading">Stripe</p>
                                <p className="text-[10px] text-text-subtle">Not configured</p>
                            </button>
                            <button
                                className={cn(
                                    'rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-4 text-center transition-all',
                                    paymentMethod === 'razorpay' ? 'ring-2 ring-primary/60 border-primary/40' : '',
                                )}
                                type="button"
                                aria-pressed={paymentMethod === 'razorpay'}
                            >
                                <Shield className="w-5 h-5 mx-auto mb-2 text-secondary" />
                                <p className="text-sm font-medium text-text-heading">Razorpay</p>
                                <p className="text-[10px] text-text-subtle">UPI, Netbanking, Cards</p>
                            </button>
                        </div>
                    </div>

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
                            <button type="button" onClick={handleApplyCoupon} className="btn-secondary text-sm py-3 px-5">Apply</button>
                        </div>
                    </div>

                    {purchaseError && (
                        <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-component-banner-critical-border)] bg-[var(--lb-component-banner-critical-bg)] p-4 text-sm text-[color:var(--lb-component-banner-critical-text)]">
                            {purchaseError}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handlePurchase}
                        disabled={purchasePending}
                        className="btn-primary w-full text-center py-4 flex items-center justify-center gap-2 text-base disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Lock className="w-4 h-4" />
                        {purchasePending ? 'Starting secure checkout...' : `Pay ${displayPrice(theme)}`}
                    </button>

                    <p className="text-xs text-text-subtle text-center">
                        Secure checkout - provider-verified payment before license issue
                    </p>
                </div>

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
                                <p className="text-[11px] text-text-muted capitalize">{theme.category} Theme - Single License</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-text-muted">Subtotal</span>
                                <span className="text-text-heading">{displayPrice(theme)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-text-muted">Tax</span>
                                <span className="text-text-heading">Calculated by provider</span>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-border flex items-center justify-between">
                            <span className="text-sm font-semibold text-text-heading">Total</span>
                            <span className="text-lg font-bold text-text-heading">{displayPrice(theme)}</span>
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
