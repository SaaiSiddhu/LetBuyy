'use client';

import { CartContext } from '@/context/cart-context';
import { useContext, useEffect, useRef, useState } from 'react';
import Image, { type ImageLoaderProps } from 'next/image';
import { Button, Input,
    AlertCircle, ArrowLeft, CheckCircle, CreditCard, Loader2, Lock,
    ShieldCheck, MapPin, Truck, Clock, Package, User, Phone, Mail, Home
} from '@letbuyy/ui';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Script from 'next/script';
import {
    readStorefrontApiJson,
    storefrontBrowserApiFetch,
    storefrontApiErrorMessage,
} from '@/lib/api/browser-client';
import { StorefrontEmptyState } from '@/components/storefront/storefront-states';

interface RazorpaySuccessResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

interface RazorpayFailureResponse {
    error?: {
        description?: string;
        reason?: string;
    };
}

interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    image: string;
    order_id: string;
    handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
    prefill: {
        name: string;
        email: string;
        contact: string;
    };
    notes: Record<string, string>;
    theme: {
        color: string;
    };
    modal: {
        ondismiss: () => void;
    };
}

interface RazorpayInstance {
    on(event: 'payment.failed', handler: (response: RazorpayFailureResponse) => void): void;
    open(): void;
}

declare global {
    interface Window {
        Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
    }
}

// T6/W2/W4 — a checkout.<root>-hosted line, sourced server-side from the verified handoff's own
// cart snapshot (services/api-gateway's GET /checkout/:cartId/verify-handoff), never from
// browser storage — checkout.<root> is a different origin than the merchant's storefront, so
// the CartProvider-backed useCart() below (localStorage-scoped to the storefront's own origin)
// is unreachable there by design, not by oversight.
export interface CheckoutOriginCartLine {
    id: string;
    variantId?: string | null;
    name: string;
    images: string[];
    price: number;
    quantity: number;
    selectedVariant?: Record<string, string>;
}

interface CheckoutClientProps {
    storeId: string;
    sellerId: string;
    subdomain: string;
    storeName: string;
    codEnabled: boolean;
    onlinePaymentEnabled: boolean;
    // When set, this render is on the checkout-origin tree: cart lines come from this prop
    // (server-verified handoff data) instead of useCart(), and basePath points at the real
    // storefront origin (an absolute URL) instead of a same-origin /store/<subdomain> path,
    // since checkout.<root> serves no /store/** tree at all.
    checkoutOrigin?: {
        storefrontBaseUrl: string;
        cartLines: CheckoutOriginCartLine[];
    };
}

interface FormData {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
}

interface SavedAddress {
    id: string;
    label?: string | null;
    full_name?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    customer_phone?: string | null;
}

type DeliveryOption = 'standard' | 'express';
// V1 ships Razorpay+COD; Stripe and PayPal deferred (LB-2)
type PaymentMethod = 'online' | 'cod';
type ProviderOrderMethod = 'razorpay' | 'cod';
const productImageFallback = '/images/banners/new-arrivals-1.png';
const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

interface StoreShippingRate {
    id: string;
    name: string;
    type: string;
    amount_minor: number;
    estimated_days_min?: number | null;
    estimated_days_max?: number | null;
}

interface CreateOrderResult {
    success?: boolean;
    error?: string;
    order?: {
        id: string;
        orderNumber: string;
        status: string;
        total: number;
    };
}

interface AppliedCoupon {
    code: string;
    type: string;
    value: number;
    discount: number;
    freeShipping?: boolean;
}

type RazorpayOrderData = {
    keyId?: string;
    key_id?: string;
    razorpayOrderId?: string;
    razorpay_order_id?: string;
    amount?: number;
    currency?: string;
};


function scrollToCheckoutTop() {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
    });
}

export default function CheckoutClient({ storeId, sellerId, subdomain, storeName, codEnabled, onlinePaymentEnabled, checkoutOrigin }: CheckoutClientProps) {
    // useContext (not useCart()) never throws when there is no CartProvider ancestor — true on
    // the checkout-origin tree, which mounts no CartProvider at all (it belongs to
    // app/store/[subdomain]/layout.tsx only). checkoutOrigin's own cart lines take priority when
    // present; the storefront-origin render (checkoutOrigin undefined) is byte-for-byte the same
    // behaviour as before this prop existed.
    const cartContext = useContext(CartContext);
    // Normalized to one consistent shape (CheckoutOriginCartLine) regardless of source, so every
    // existing `.map`/`.reduce` below needs no branching of its own.
    const items: CheckoutOriginCartLine[] = checkoutOrigin
        ? checkoutOrigin.cartLines
        : (cartContext?.items ?? []).map((item) => ({
            id: item.id,
            variantId: (item as typeof item & { variantId?: string | null }).variantId ?? null,
            name: item.name,
            images: item.images,
            price: item.price,
            quantity: item.quantity,
            selectedVariant: item.selectedVariant,
        }));
    const cartTotal = checkoutOrigin
        ? items.reduce((sum, line) => sum + line.price * line.quantity, 0)
        : cartContext?.cartTotal ?? 0;
    // The checkout-origin's browser has no access to the storefront origin's localStorage cart
    // to clear in the first place (different origin) — a no-op there is correct, not a gap; the
    // storefront's own cart badge count self-corrects the next time that origin's CartProvider
    // reads its (now stale) local cart against the real order it already placed.
    const clearCart = cartContext?.clearCart ?? (() => {});
    const basePath = checkoutOrigin ? checkoutOrigin.storefrontBaseUrl : `/store/${subdomain}`;
    const hasPaymentMethods = onlinePaymentEnabled || codEnabled;
    const initialPaymentMethod: PaymentMethod = onlinePaymentEnabled ? 'online' : codEnabled ? 'cod' : 'online';

    const [step, setStep] = useState(1); // 1: Address, 2: Review & Pay
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [orderNumber, setOrderNumber] = useState('');
    const [deliveryOption, setDeliveryOption] = useState<DeliveryOption>('standard');
    const [razorpayLoaded, setRazorpayLoaded] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialPaymentMethod);
    const [couponInput, setCouponInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
    const [couponError, setCouponError] = useState('');
    const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);
    const [checkoutError, setCheckoutError] = useState('');
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
    // V1 LB-7: real shipping rates from store config.
    const [storeRates, setStoreRates] = useState<StoreShippingRate[] | null>(null);
    const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
    const idempotencyKeysRef = useRef<Record<string, string>>({});

    const [formData, setFormData] = useState<FormData>({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
    });

    const [errors, setErrors] = useState<Partial<FormData>>({});

    // Theme
    const primaryColor = 'var(--primary, rgb(99 102 241))';

    useEffect(() => {
        let isMounted = true;

        fetch('/api/customer/addresses')
            .then(response => response.ok ? response.json() : { addresses: [] })
            .then(payload => {
                if (!isMounted) return;
                setSavedAddresses(Array.isArray(payload.addresses) ? payload.addresses : []);
            })
            .catch(() => {
                if (isMounted) setSavedAddresses([]);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (isSuccess) {
            scrollToCheckoutTop();
        }
    }, [isSuccess]);

    // V1 LB-7: fetch real shipping rates for this store.
    useEffect(() => {
        let isMounted = true;
        const subtotalMinor = Math.round(cartTotal * 100);
        fetch('/api/shipping/rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                store_id: storeId,
                pincode: '000000', // placeholder — real pincode available at form-fill
                subtotal_minor: subtotalMinor,
            }),
        })
            .then(res => res.ok ? res.json() : null)
            .then(payload => {
                if (!isMounted) return;
                const rates: StoreShippingRate[] = Array.isArray(payload?.data?.rates)
                    ? (payload.data.rates as StoreShippingRate[]).filter(r => typeof r.id === 'string' && r.id && r.id !== 'sandbox-standard')
                    : [];
                if (rates.length > 0) {
                    setStoreRates(rates);
                    setSelectedRateId(rates[0].id);
                } else {
                    setStoreRates(null); // Fall back to hardcoded standard/express
                }
            })
            .catch(() => {
                if (isMounted) setStoreRates(null);
            });
        return () => {
            isMounted = false;
        };
    }, [storeId, cartTotal]);

    // Delivery costs
    const selectedRate = storeRates ? storeRates.find(r => r.id === selectedRateId) ?? storeRates[0] : null;
    const deliveryCharges = selectedRate
        ? (selectedRate.type === 'free' ? 0 : selectedRate.amount_minor / 100)
        : (deliveryOption === 'express' ? 99 : 0);
    const discountAmount = appliedCoupon?.discount || 0;
    const effectiveDeliveryCharges = appliedCoupon?.freeShipping ? 0 : deliveryCharges;
    const totalAmount = Math.max(0, cartTotal + effectiveDeliveryCharges - discountAmount);
    const itemCount = items.reduce((count, item) => count + item.quantity, 0);
    const getIdempotencyKey = (scope: string) => {
        if (!idempotencyKeysRef.current[scope]) {
            idempotencyKeysRef.current[scope] = `checkout-${scope}-${crypto.randomUUID()}`;
        }
        return idempotencyKeysRef.current[scope];
    };

    const showCheckoutError = (message: string) => {
        setCheckoutError(message);
        scrollToCheckoutTop();
    };

    const updateFormField = (field: keyof FormData, value: string) => {
        const normalizedValue = field === 'phone'
            ? value.replace(/[^\d+\-\s]/g, '').slice(0, 16)
            : field === 'pincode'
                ? value.replace(/\D/g, '').slice(0, 6)
                : value;

        setFormData(prev => ({ ...prev, [field]: normalizedValue }));
        setErrors(prev => ({ ...prev, [field]: undefined }));
        setCheckoutError('');
    };

    const applySavedAddress = (address: SavedAddress) => {
        setFormData(prev => ({
            ...prev,
            name: address.full_name || prev.name,
            phone: address.customer_phone || prev.phone,
            address: [address.address_line1, address.address_line2].filter(Boolean).join(', '),
            city: address.city || '',
            state: address.state || '',
            pincode: address.postal_code || '',
        }));
        setErrors({});
        setCheckoutError('');
    };

    // Auto-create customer record after order
    const autoCreateCustomer = async () => {
        try {
            await fetch('/api/customer/auto-create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email.toLowerCase(),
                    fullName: formData.name,
                    phone: formData.phone,
                    storeId,
                }),
            });
        } catch {
            // Silently fail — customer creation should not block checkout success
        }
    };

    // Validate form
    const validateForm = (): boolean => {
        const newErrors: Partial<FormData> = {};
        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) newErrors.email = 'Valid email required';
        if (formData.phone.replace(/\D/g, '').length < 10) newErrors.phone = 'Valid phone required';
        if (!formData.address.trim()) newErrors.address = 'Address is required';
        if (!formData.city.trim()) newErrors.city = 'City is required';
        if (!formData.state.trim()) newErrors.state = 'State is required';
        if (formData.pincode.length !== 6) newErrors.pincode = 'Valid 6-digit pincode';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Proceed to payment step
    const proceedToPayment = () => {
        if (validateForm()) {
            setCheckoutError('');
            setStep(2);
            scrollToCheckoutTop();
        } else {
            showCheckoutError('Complete the highlighted delivery fields before continuing.');
        }
    };

    const buildOrderPayload = (method: ProviderOrderMethod) => ({
        storeId,
        sellerId,
        subdomain,
        idempotencyKey: getIdempotencyKey(`order-${method}`),
        customer: {
            name: formData.name,
            email: formData.email.toLowerCase(),
            phone: formData.phone,
            address: {
                address: formData.address,
                city: formData.city,
                state: formData.state,
                pincode: formData.pincode,
            }
        },
        items: items.map(item => ({
            productId: item.id,
            variantId: (item as typeof item & { variantId?: string | null }).variantId ?? null,
            quantity: item.quantity,
        })),
        paymentMethod: method,
        deliveryOption,
        couponCode: appliedCoupon?.code,
        // V1 LB-7: send server-resolvable rate ID; back-compat when store has no rates.
        shippingRateId: selectedRate?.id ?? null,
    });

    const applyCoupon = async () => {
        const code = couponInput.trim().toUpperCase();
        if (!code) {
            setCouponError('Enter a coupon code');
            return;
        }

        setIsCheckingCoupon(true);
        setCouponError('');

        try {
            const query = new URLSearchParams({
                code,
                subdomain,
                subtotal: String(cartTotal),
            });
            const response = await fetch(`/api/coupons/validate?${query.toString()}`);
            const payload = await response.json();

            if (!response.ok || !payload.valid || !payload.coupon) {
                setAppliedCoupon(null);
                setCouponError(payload.error || 'Invalid coupon code');
                return;
            }

            setAppliedCoupon({
                code: payload.coupon.code,
                type: payload.coupon.type,
                value: Number(payload.coupon.value || 0),
                discount: Number(payload.coupon.discount || 0),
                freeShipping: Boolean(payload.coupon.freeShipping),
            });
            setCouponInput(payload.coupon.code);
        } catch {
            setAppliedCoupon(null);
            setCouponError('Unable to validate coupon');
        } finally {
            setIsCheckingCoupon(false);
        }
    };

    const removeCoupon = () => {
        setAppliedCoupon(null);
        setCouponError('');
        setCouponInput('');
    };

    const createCheckoutOrder = async (method: ProviderOrderMethod): Promise<CreateOrderResult> => {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildOrderPayload(method)),
        });

        return res.json();
    };

    // Handle COD order
    const handleCODOrder = async () => {
        setIsProcessing(true);
        try {
            const result = await createCheckoutOrder('cod');

            if (result.success && result.order) {
                setOrderNumber(result.order.orderNumber);
                setIsSuccess(true);
                clearCart();
                autoCreateCustomer();
            } else {
                showCheckoutError('Order creation failed. Please try again.');
            }
        } catch {
            showCheckoutError('Order creation failed. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    // Initialize Razorpay payment
    const handlePayment = async () => {
        if (!razorpayLoaded) {
            showCheckoutError('Payment gateway is loading. Please try again.');
            return;
        }

        if (!window.Razorpay) {
            showCheckoutError('Payment gateway is unavailable. Please try again.');
            return;
        }

        setIsProcessing(true);

        try {
            const orderResult = await createCheckoutOrder('razorpay');
            if (!orderResult.success || !orderResult.order) {
                showCheckoutError('Order creation failed. Please try again.');
                setIsProcessing(false);
                return;
            }

            const paymentRes = await storefrontBrowserApiFetch(subdomain, '/payments/razorpay/order', {
                method: 'POST',
                body: JSON.stringify({
                    orderId: orderResult.order.id,
                    idempotencyKey: getIdempotencyKey(`razorpay-create-${orderResult.order.id}`),
                }),
            });

            const paymentResult = await readStorefrontApiJson<RazorpayOrderData>(paymentRes);
            const paymentData = paymentResult.data;
            const keyId = paymentData?.keyId || paymentData?.key_id;
            const razorpayOrderId = paymentData?.razorpayOrderId || paymentData?.razorpay_order_id;
            if (!paymentRes.ok || paymentResult.success === false || !keyId || !razorpayOrderId || !paymentData?.amount) {
                showCheckoutError(storefrontApiErrorMessage(paymentResult, 'Online payment is not configured for this store yet.'));
                setIsProcessing(false);
                return;
            }

            const options: RazorpayOptions = {
                key: keyId,
                amount: paymentData.amount,
                currency: paymentData.currency || 'INR',
                name: storeName,
                description: `Order ${orderResult.order.orderNumber}`,
                image: '/logo.png',
                order_id: razorpayOrderId,
                handler: async (response) => {
                    try {
                        const verifyRes = await storefrontBrowserApiFetch(subdomain, '/payments/razorpay/verify', {
                            method: 'POST',
                            body: JSON.stringify({
                                orderId: orderResult.order!.id,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                idempotencyKey: getIdempotencyKey(`razorpay-verify-${response.razorpay_payment_id}`),
                            }),
                        });

                        const verifyResult = await readStorefrontApiJson<{ verified?: boolean }>(verifyRes);
                        if (verifyRes.ok && verifyResult.success !== false) {
                            setOrderNumber(orderResult.order!.orderNumber);
                            setIsSuccess(true);
                            clearCart();
                            autoCreateCustomer();
                        } else {
                            showCheckoutError(storefrontApiErrorMessage(verifyResult, 'Payment verification failed. Please contact support.'));
                        }
                    } catch {
                        showCheckoutError('Payment verification failed. Please contact support.');
                    } finally {
                        setIsProcessing(false);
                    }
                },
                prefill: {
                    name: formData.name,
                    email: formData.email,
                    contact: formData.phone,
                },
                notes: {
                    order_id: orderResult.order.id,
                    store_id: storeId,
                    subdomain,
                },
                theme: {
                    color: 'rgb(99 102 241)',
                },
                modal: {
                    ondismiss: function () {
                        setIsProcessing(false);
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function () {
                setIsProcessing(false);
                showCheckoutError('Payment failed. Please try again.');
            });
            rzp.open();
        } catch {
            setIsProcessing(false);
            showCheckoutError('Payment failed. Please try again.');
        }
    };

    // Success Screen
    if (isSuccess) {
        return (
            <div className="min-h-screen pt-20 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--background)' }}>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-md rounded-2xl border border-slate-200 bg-[var(--lb-color-surface)] p-8 text-center text-slate-900 shadow-xl"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6"
                    >
                        <CheckCircle size={32} />
                    </motion.div>
                    <h1 className="mb-2 text-2xl font-bold text-slate-950">Order Confirmed!</h1>
                    <p className="mb-2 text-sm text-slate-600">
                        Thank you for your purchase. We will send order updates to the contact details you provided.
                    </p>
                    {orderNumber && (
                        <p className="mb-6 inline-block rounded-lg bg-slate-50 px-4 py-2 text-xs text-slate-700">
                            Order Number: <span className="font-mono font-semibold">{orderNumber}</span>
                        </p>
                    )}
                    <p className="mb-6 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                        {paymentMethod === 'cod'
                            ? 'COD order confirmed. Keep the order amount ready for the delivery partner.'
                            : 'Payment confirmation is complete. Keep this order number for support.'}
                    </p>
                    <div className="space-y-3">
                        <Link
                            href={`${basePath}/orders`}
                            className="block w-full text-white py-3 rounded-xl font-semibold"
                            style={{ backgroundColor: primaryColor }}
                        >
                            Track Your Order
                        </Link>
                        <Link
                            href={basePath}
                            className="block w-full rounded-xl border border-slate-200 py-3 font-semibold text-slate-600"
                        >
                            Continue Shopping
                        </Link>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Empty Cart
    if (items.length === 0 && !isSuccess) {
        return (
            <div className="min-h-screen pt-20 flex items-center justify-center px-4">
                <StorefrontEmptyState
                    icon={<Package size={28} aria-hidden="true" />}
                    title="Your cart is empty"
                    body="Add products to your bag before checkout."
                    actionHref={`${basePath}/shop`}
                    actionLabel="Browse products"
                    actionIcon={<Package size={16} aria-hidden="true" />}
                />
            </div>
        );
    }

    return (
        <>
            {/* Razorpay Script */}
            <Script
                src="https://checkout.razorpay.com/v1/checkout.js"
                onLoad={() => setRazorpayLoaded(true)}
            />

            <div className="min-h-screen pt-20" style={{ backgroundColor: 'var(--background, rgb(249 250 251))' }}>
                <div className="container mx-auto px-4 max-w-5xl pb-8">
                    {/* Header */}
                    <div className="py-4">
                        <Link href={`${basePath}/cart`} className="inline-flex items-center text-sm text-theme-secondary hover:opacity-70">
                            <ArrowLeft size={16} className="mr-2" /> Back to Cart
                        </Link>
                    </div>

                    {checkoutError && (
                        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                            <AlertCircle size={18} className="mt-0.5 shrink-0" />
                            <div className="min-w-0">
                                <p className="font-semibold">Checkout needs attention</p>
                                <p>{checkoutError}</p>
                            </div>
                        </div>
                    )}

                    {/* Progress Steps */}
                    <div className="flex items-center justify-center mb-8">
                        <div className="flex items-center gap-2 text-sm">
                            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-theme' : 'text-theme-muted'}`}>
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold ${step >= 1 ? '' : 'bg-surface'}`}
                                    style={{ backgroundColor: step >= 1 ? primaryColor : undefined }}
                                >
                                    {step > 1 ? <CheckCircle size={16} /> : '1'}
                                </div>
                                <span className="hidden sm:inline font-medium">Address</span>
                            </div>
                            <div className={`w-12 h-0.5 ${step >= 2 ? '' : 'bg-surface'}`} style={{ backgroundColor: step >= 2 ? primaryColor : undefined }} />
                            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-theme' : 'text-theme-muted'}`}>
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step >= 2 ? 'text-white' : 'bg-surface text-theme-muted'}`}
                                    style={{ backgroundColor: step >= 2 ? primaryColor : undefined }}
                                >
                                    2
                                </div>
                                <span className="hidden sm:inline font-medium">Payment</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main Content */}
                        <div className="lg:col-span-2">
                            <AnimatePresence mode="wait">
                                {step === 1 && (
                                    <motion.div
                                        key="address"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="card-theme p-5 rounded-xl shadow-sm"
                                    >
                                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <MapPin size={18} style={{ color: primaryColor }} />
                                            Delivery Address
                                        </h2>

                                        <div className="mb-4 rounded-xl border border-card p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold">Saved address autofill</p>
                                                    <p className="mt-1 text-xs text-theme-secondary">
                                                        {savedAddresses.length > 0
                                                            ? 'Choose a saved customer address to fill the delivery form.'
                                                            : 'Saved customer addresses will appear here when available.'}
                                                    </p>
                                                </div>
                                                <MapPin size={18} style={{ color: primaryColor }} />
                                            </div>
                                            {savedAddresses.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {savedAddresses.map(address => (
                                                        <Button unstyled
                                                            key={address.id}
                                                            type="button"
                                                            onClick={() => applySavedAddress(address)}
                                                            className="min-h-11 rounded-full border px-3 text-xs font-semibold capitalize"
                                                            style={{ borderColor: 'var(--border, rgb(229 231 235))', color: primaryColor }}
                                                        >
                                                            {address.label || 'Address'}
                                                        </Button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                <div>
                                                    <label className="text-xs font-medium text-theme-secondary mb-1 block">Full Name *</label>
                                                    <div className="relative">
                                                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                                                        <Input unstyled
                                                            type="text"
                                                            value={formData.name}
                                                            onChange={e => updateFormField('name', e.target.value)}
                                                            className={`min-h-11 w-full pl-9 pr-3 py-2.5 input-theme rounded-lg text-sm outline-none focus:ring-2 focus:ring-opacity-50 ${errors.name ? 'ring-2 ring-red-300' : ''}`}
                                                            placeholder="John Doe"
                                                        />
                                                    </div>
                                                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-theme-secondary mb-1 block">Phone *</label>
                                                    <div className="relative">
                                                        <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                                                        <Input unstyled
                                                            type="tel"
                                                            value={formData.phone}
                                                            onChange={e => updateFormField('phone', e.target.value)}
                                                            inputMode="tel"
                                                            className={`min-h-11 w-full pl-9 pr-3 py-2.5 input-theme rounded-lg text-sm outline-none focus:ring-2 focus:ring-opacity-50 ${errors.phone ? 'ring-2 ring-red-300' : ''}`}
                                                            placeholder="9876543210"
                                                        />
                                                    </div>
                                                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs font-medium text-theme-secondary mb-1 block">Email *</label>
                                                <div className="relative">
                                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                                                    <Input unstyled
                                                        type="email"
                                                        value={formData.email}
                                                        onChange={e => updateFormField('email', e.target.value)}
                                                        className={`min-h-11 w-full pl-9 pr-3 py-2.5 input-theme rounded-lg text-sm outline-none focus:ring-2 focus:ring-opacity-50 ${errors.email ? 'ring-2 ring-red-300' : ''}`}
                                                        placeholder="john@example.com"
                                                    />
                                                </div>
                                                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                                            </div>

                                            <div>
                                                <label className="text-xs font-medium text-theme-secondary mb-1 block">Address *</label>
                                                <div className="relative">
                                                    <Home size={16} className="absolute left-3 top-3 text-theme-muted" />
                                                    <textarea
                                                        value={formData.address}
                                                        onChange={e => updateFormField('address', e.target.value)}
                                                        rows={2}
                                                        className={`min-h-[88px] w-full pl-9 pr-3 py-2.5 input-theme rounded-lg text-sm outline-none focus:ring-2 focus:ring-opacity-50 resize-none ${errors.address ? 'ring-2 ring-red-300' : ''}`}
                                                        placeholder="House/Flat No, Street, Landmark..."
                                                    />
                                                </div>
                                                {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                <div>
                                                    <label className="text-xs font-medium text-theme-secondary mb-1 block">City *</label>
                                                    <Input unstyled
                                                        type="text"
                                                        value={formData.city}
                                                        onChange={e => updateFormField('city', e.target.value)}
                                                        className={`min-h-11 w-full px-3 py-2.5 input-theme rounded-lg text-sm outline-none focus:ring-2 focus:ring-opacity-50 ${errors.city ? 'ring-2 ring-red-300' : ''}`}
                                                        placeholder="Bengaluru"
                                                    />
                                                    {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-theme-secondary mb-1 block">State *</label>
                                                    <Input unstyled
                                                        type="text"
                                                        value={formData.state}
                                                        onChange={e => updateFormField('state', e.target.value)}
                                                        className={`min-h-11 w-full px-3 py-2.5 input-theme rounded-lg text-sm outline-none focus:ring-2 focus:ring-opacity-50 ${errors.state ? 'ring-2 ring-red-300' : ''}`}
                                                        placeholder="Karnataka"
                                                    />
                                                    {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-theme-secondary mb-1 block">Pincode *</label>
                                                    <Input unstyled
                                                        type="text"
                                                        maxLength={6}
                                                        value={formData.pincode}
                                                        onChange={e => updateFormField('pincode', e.target.value)}
                                                        inputMode="numeric"
                                                        pattern="[0-9]{6}"
                                                        className={`min-h-11 w-full px-3 py-2.5 input-theme rounded-lg text-sm outline-none focus:ring-2 focus:ring-opacity-50 ${errors.pincode ? 'ring-2 ring-red-300' : ''}`}
                                                        placeholder="560001"
                                                    />
                                                    {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode}</p>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Delivery Options — real store rates when configured, fallback otherwise */}
                                        <div className="mt-6 pt-4 border-t border-card">
                                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                                <Truck size={16} style={{ color: primaryColor }} />
                                                Delivery Speed
                                            </h3>
                                            {storeRates && storeRates.length > 0 ? (
                                                <div className="grid grid-cols-1 gap-3">
                                                    {storeRates.map(rate => {
                                                        const isSelected = selectedRateId === rate.id;
                                                        const rateAmount = rate.type === 'free' ? 0 : rate.amount_minor / 100;
                                                        const daysLabel = rate.estimated_days_min != null && rate.estimated_days_max != null
                                                            ? `${rate.estimated_days_min}–${rate.estimated_days_max} days`
                                                            : null;
                                                        return (
                                                            <Button unstyled key={rate.id}
                                                                onClick={() => {
                                                                    setSelectedRateId(rate.id);
                                                                    setDeliveryOption('standard');
                                                                }}
                                                                className={`min-h-11 p-3 rounded-lg border-2 text-left transition-all ${isSelected ? 'border-[color:var(--lb-color-primary)]' : 'border-card'}`}
                                                            >
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="font-semibold text-sm">{rate.name}</span>
                                                                    <span className="text-xs font-medium text-theme-secondary">
                                                                        {rateAmount === 0 ? 'FREE' : `₹${rateAmount.toLocaleString('en-IN')}`}
                                                                    </span>
                                                                </div>
                                                                {daysLabel && (
                                                                    <p className="text-xs text-theme-secondary flex items-center gap-1">
                                                                        <Clock size={12} /> {daysLabel}
                                                                    </p>
                                                                )}
                                                            </Button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <Button unstyled
                                                        onClick={() => setDeliveryOption('standard')}
                                                        className={`min-h-11 p-3 rounded-lg border-2 text-left transition-all ${deliveryOption === 'standard' ? 'border-opacity-100' : 'border-card'}`}
                                                        style={{ borderColor: deliveryOption === 'standard' ? primaryColor : undefined }}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-semibold text-sm">Standard</span>
                                                            <span className="text-green-600 text-xs font-medium">FREE</span>
                                                        </div>
                                                        <p className="text-xs text-theme-secondary flex items-center gap-1">
                                                            <Clock size={12} /> 5-7 days
                                                        </p>
                                                    </Button>
                                                    <Button unstyled
                                                        onClick={() => setDeliveryOption('express')}
                                                        className={`min-h-11 p-3 rounded-lg border-2 text-left transition-all ${deliveryOption === 'express' ? 'border-opacity-100' : 'border-card'}`}
                                                        style={{ borderColor: deliveryOption === 'express' ? primaryColor : undefined }}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="font-semibold text-sm">Express</span>
                                                            <span className="text-xs font-medium" style={{ color: primaryColor }}>₹99</span>
                                                        </div>
                                                        <p className="text-xs text-theme-secondary flex items-center gap-1">
                                                            <Clock size={12} /> 2-3 days
                                                        </p>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        <Button unstyled
                                            onClick={proceedToPayment}
                                            className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-white"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            Continue to Payment
                                        </Button>
                                    </motion.div>
                                )}

                                {step === 2 && (
                                    <motion.div
                                        key="payment"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        {/* Address Summary */}
                                        <div className="card-theme p-4 rounded-xl shadow-sm">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                                    <MapPin size={16} style={{ color: primaryColor }} />
                                                    Delivering to
                                                </h3>
                                                <Button unstyled
                                                    onClick={() => setStep(1)}
                                                    className="flex min-h-11 items-center text-xs font-medium"
                                                    style={{ color: primaryColor }}
                                                >
                                                    Change
                                                </Button>
                                            </div>
                                            <div className="text-sm text-theme-secondary">
                                                <p className="font-semibold text-theme">{formData.name}</p>
                                                <p>{formData.address}</p>
                                                <p>{formData.city}, {formData.state} - {formData.pincode}</p>
                                                <p className="mt-1 text-theme-muted">{formData.phone} • {formData.email}</p>
                                            </div>
                                        </div>

                                        {/* Items */}
                                        <div className="card-theme p-4 rounded-xl shadow-sm">
                                            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                                <Package size={16} style={{ color: primaryColor }} />
                                                Items ({items.length})
                                            </h3>
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                                {items.map(item => (
                                                    <div key={item.id} className="flex items-center gap-3 p-2 card-theme-secondary rounded-lg">
                                                        <Image
                                                            loader={passthroughImageLoader}
                                                            unoptimized
                                                            src={item.images[0] || productImageFallback}
                                                            alt={item.name}
                                                            width={48}
                                                            height={48}
                                                            className="w-12 h-12 rounded-lg object-cover"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{item.name}</p>
                                                            <p className="text-xs text-theme-secondary">Qty: {item.quantity}</p>
                                                        </div>
                                                        <p className="text-sm font-semibold">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Payment Method Selection */}
                                        <div className="card-theme p-4 rounded-xl shadow-sm">
                                            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                                <CreditCard size={16} style={{ color: primaryColor }} />
                                                Payment Method
                                            </h3>
                                            <div className="space-y-2">
                                                {onlinePaymentEnabled && (
                                                    <label
                                                        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-all ${paymentMethod === 'online' ? 'border-indigo-500 bg-indigo-50' : 'border-card hover:bg-surface-hover'}`}
                                                        onClick={() => setPaymentMethod('online')}
                                                    >
                                                        <Input unstyled
                                                            type="radio"
                                                            checked={paymentMethod === 'online'}
                                                            onChange={() => setPaymentMethod('online')}
                                                            className="accent-indigo-500"
                                                        />
                                                        <CreditCard size={20} className="text-indigo-500" />
                                                        <div>
                                                            <p className="font-medium text-sm">Pay Online (Razorpay)</p>
                                                            <p className="text-xs text-theme-secondary">UPI, Cards, Net Banking</p>
                                                        </div>
                                                    </label>
                                                )}
                                                {codEnabled && (
                                                    <label
                                                        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-all ${paymentMethod === 'cod' ? 'border-green-500 bg-green-50' : 'border-card hover:bg-surface-hover'}`}
                                                        onClick={() => setPaymentMethod('cod')}
                                                    >
                                                        <Input unstyled
                                                            type="radio"
                                                            checked={paymentMethod === 'cod'}
                                                            onChange={() => setPaymentMethod('cod')}
                                                            className="accent-green-500"
                                                        />
                                                        <Truck size={20} className="text-green-600" />
                                                        <div>
                                                            <p className="font-medium text-sm">Cash on Delivery (COD)</p>
                                                            <p className="text-xs text-theme-secondary">
                                                                Pay cash when the courier delivers. Keep the exact order amount ready.
                                                            </p>
                                                        </div>
                                                    </label>
                                                )}
                                                {!hasPaymentMethods && (
                                                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="font-semibold">Payment methods unavailable</p>
                                                            <p className="text-xs">This store needs a checkout payment method enabled before orders can be placed.</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Payment Button */}
                                        <Button unstyled
                                            onClick={paymentMethod === 'online' ? handlePayment : handleCODOrder}
                                            disabled={!hasPaymentMethods || isProcessing || (paymentMethod === 'online' && !razorpayLoaded)}
                                            className="flex min-h-11 w-full items-center justify-center gap-3 rounded-xl py-4 text-lg font-bold text-white shadow-lg disabled:opacity-60"
                                            style={{ backgroundColor: paymentMethod === 'cod' ? 'rgb(22 163 74)' : 'rgb(26 26 46)' }}
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={22} /> Processing...
                                                </>
                                            ) : paymentMethod === 'cod' ? (
                                                <>
                                                    <Truck size={22} /> Confirm COD order
                                                </>
                                            ) : (
                                                <>
                                                    <CreditCard size={22} /> Pay ₹{totalAmount.toLocaleString('en-IN')}
                                                </>
                                            )}
                                        </Button>

                                        <div className="flex items-center justify-center gap-2 text-xs text-theme-muted">
                                            <Lock size={12} />
                                            <span>{paymentMethod === 'cod' ? 'COD order is confirmed server-side' : 'Secured by Razorpay'}</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Order Summary Sidebar */}
                        <div className="lg:col-span-1">
                            <div className="card-theme p-4 rounded-xl shadow-sm sticky top-24">
                                <h2 className="font-bold mb-4">Order Summary</h2>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-theme-secondary">
                                        <span>Subtotal ({items.reduce((a, i) => a + i.quantity, 0)} items)</span>
                                        <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between text-theme-secondary">
                                        <span>Delivery</span>
                                        <span className={effectiveDeliveryCharges === 0 ? 'text-green-600 font-medium' : ''}>
                                            {effectiveDeliveryCharges === 0 ? 'Free' : `₹${effectiveDeliveryCharges}`}
                                        </span>
                                    </div>
                                    {appliedCoupon && (
                                        <div className="flex justify-between text-green-600">
                                            <span>Coupon ({appliedCoupon.code})</span>
                                            <span>
                                                {appliedCoupon.freeShipping && discountAmount === 0
                                                    ? 'Free delivery'
                                                    : `-₹${discountAmount.toLocaleString('en-IN')}`}
                                            </span>
                                        </div>
                                    )}
                                    <div className="border-t border-card pt-2 flex justify-between font-bold text-lg">
                                        <span>Total</span>
                                        <span style={{ color: primaryColor }}>₹{totalAmount.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-card">
                                    {appliedCoupon ? (
                                        <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                                            <div>
                                                <p className="text-sm font-semibold text-green-700">{appliedCoupon.code}</p>
                                                <p className="text-xs text-green-700">
                                                    {appliedCoupon.freeShipping
                                                        ? 'Free delivery applied'
                                                        : `₹${discountAmount.toLocaleString('en-IN')} off applied`}
                                                </p>
                                            </div>
                                            <Button unstyled
                                                type="button"
                                                onClick={removeCoupon}
                                                className="text-xs font-semibold text-green-700 hover:text-green-900"
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <Input unstyled
                                                    type="text"
                                                    value={couponInput}
                                                    onChange={e => {
                                                        setCouponInput(e.target.value.toUpperCase());
                                                        setCouponError('');
                                                    }}
                                                    placeholder="Coupon code"
                                                    className="min-h-11 min-w-0 flex-1 px-3 py-2 input-theme rounded-lg text-sm outline-none"
                                                />
                                                <Button unstyled
                                                    type="button"
                                                    onClick={applyCoupon}
                                                    disabled={isCheckingCoupon}
                                                    className="min-h-11 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                                                    style={{ backgroundColor: primaryColor }}
                                                >
                                                    {isCheckingCoupon ? 'Checking' : 'Apply'}
                                                </Button>
                                            </div>
                                            {couponError && <p className="text-xs text-red-500">{couponError}</p>}
                                        </div>
                                    )}
                                </div>

                                {/* Trust Badges */}
                                <div className="mt-4 pt-4 border-t border-card flex justify-center gap-4">
                                    <div className="flex flex-col items-center text-center">
                                        <ShieldCheck size={20} className="text-green-500 mb-1" />
                                        <span className="text-[10px] text-theme-secondary">Secure</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <Truck size={20} className="text-blue-500 mb-1" />
                                        <span className="text-[10px] text-theme-secondary">Fast</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <Package size={20} className="text-purple-500 mb-1" />
                                        <span className="text-[10px] text-theme-secondary">Safe</span>
                                    </div>
                                </div>

                                {/* Payment Partners */}
                                <div className="mt-4 pt-4 border-t border-card flex items-center justify-center gap-4">
                                    <Image
                                        loader={passthroughImageLoader}
                                        unoptimized
                                        src="https://razorpay.com/assets/razorpay-logo.svg"
                                        alt="Razorpay"
                                        width={96}
                                        height={16}
                                        className="h-4 w-auto opacity-50"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
