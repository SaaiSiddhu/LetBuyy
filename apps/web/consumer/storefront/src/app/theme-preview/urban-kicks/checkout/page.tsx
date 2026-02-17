'use client';

import PreviewShell from '../_components/preview-shell';
import { useCart } from '@/context/cart-context';
import { useCheckout } from '../_context/checkout-context';
import {
    formatPrice, SHIPPING_METHODS, PAYMENT_METHODS, INDIAN_STATES,
} from '../_lib/mock-data';
import {
    ChevronRight, ArrowLeft, ArrowRight, Truck, Shield, RotateCcw,
    CreditCard, Banknote, MapPin, Mail, Phone, User, Package,
    Lock, ChevronDown, ChevronUp, Check, CircleDot, Circle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';

// ============= STEP INDICATOR =============

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
    const steps = [
        { num: 1, label: 'Contact & Address' },
        { num: 2, label: 'Shipping' },
        { num: 3, label: 'Payment & Review' },
    ] as const;

    return (
        <div className="flex items-center justify-center gap-0 mb-8">
            {steps.map((step, idx) => (
                <div key={step.num} className="flex items-center">
                    <div className="flex flex-col items-center">
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                                ${step.num < current ? 'bg-black text-white' : ''}
                                ${step.num === current ? 'bg-black text-white ring-4 ring-black/10' : ''}
                                ${step.num > current ? 'bg-gray-100 text-gray-400' : ''}
                            `}
                        >
                            {step.num < current ? <Check size={14} /> : step.num}
                        </div>
                        <span className={`text-[10px] mt-1.5 font-medium whitespace-nowrap
                            ${step.num <= current ? 'text-black' : 'text-gray-400'}
                        `}>
                            {step.label}
                        </span>
                    </div>
                    {idx < steps.length - 1 && (
                        <div className={`w-12 sm:w-20 h-0.5 mx-1 mb-5 transition-colors
                            ${step.num < current ? 'bg-black' : 'bg-gray-200'}
                        `} />
                    )}
                </div>
            ))}
        </div>
    );
}

// ============= STEP 1: CONTACT & ADDRESS =============

function StepContact({
    onNext,
}: {
    onNext: () => void;
}) {
    const { contact, address, setContact, setAddress } = useCheckout();

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const e: Record<string, string> = {};
        if (!contact.email.trim()) e.email = 'Required';
        else if (!/\S+@\S+\.\S+/.test(contact.email)) e.email = 'Invalid email';
        if (!contact.name.trim()) e.name = 'Required';
        if (!contact.phone.trim()) e.phone = 'Required';
        if (!address.line1.trim()) e.line1 = 'Required';
        if (!address.city.trim()) e.city = 'Required';
        if (!address.state) e.state = 'Required';
        if (!address.pinCode.trim()) e.pinCode = 'Required';
        else if (!/^\d{6}$/.test(address.pinCode)) e.pinCode = 'Must be 6 digits';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) onNext();
    };

    const inputCls = (field: string) =>
        `w-full px-3 py-2.5 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 transition-all
        ${errors[field] ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-black/10 focus:border-black/20'}`;

    return (
        <div className="space-y-6">
            {/* Contact */}
            <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-3 flex items-center gap-2">
                    <Mail size={14} /> Contact Information
                </h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Email *</label>
                        <input
                            type="email"
                            value={contact.email}
                            onChange={e => setContact({ ...contact, email: e.target.value })}
                            placeholder="you@example.com"
                            className={inputCls('email')}
                        />
                        {errors.email && <p className="text-[10px] text-red-500 mt-0.5">{errors.email}</p>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Full Name *</label>
                            <input
                                type="text"
                                value={contact.name}
                                onChange={e => setContact({ ...contact, name: e.target.value })}
                                placeholder="Priya Sharma"
                                className={inputCls('name')}
                            />
                            {errors.name && <p className="text-[10px] text-red-500 mt-0.5">{errors.name}</p>}
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Phone *</label>
                            <input
                                type="tel"
                                value={contact.phone}
                                onChange={e => setContact({ ...contact, phone: e.target.value })}
                                placeholder="+91 98765 43210"
                                className={inputCls('phone')}
                            />
                            {errors.phone && <p className="text-[10px] text-red-500 mt-0.5">{errors.phone}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Address */}
            <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin size={14} /> Shipping Address
                </h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Address Line 1 *</label>
                        <input
                            type="text"
                            value={address.line1}
                            onChange={e => setAddress({ ...address, line1: e.target.value })}
                            placeholder="42, Marine Drive"
                            className={inputCls('line1')}
                        />
                        {errors.line1 && <p className="text-[10px] text-red-500 mt-0.5">{errors.line1}</p>}
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Address Line 2</label>
                        <input
                            type="text"
                            value={address.line2}
                            onChange={e => setAddress({ ...address, line2: e.target.value })}
                            placeholder="Apartment, suite, etc. (optional)"
                            className={inputCls('line2')}
                        />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">City *</label>
                            <input
                                type="text"
                                value={address.city}
                                onChange={e => setAddress({ ...address, city: e.target.value })}
                                placeholder="Mumbai"
                                className={inputCls('city')}
                            />
                            {errors.city && <p className="text-[10px] text-red-500 mt-0.5">{errors.city}</p>}
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">State *</label>
                            <select
                                value={address.state}
                                onChange={e => setAddress({ ...address, state: e.target.value })}
                                className={inputCls('state')}
                            >
                                <option value="">Select</option>
                                {INDIAN_STATES.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            {errors.state && <p className="text-[10px] text-red-500 mt-0.5">{errors.state}</p>}
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">PIN Code *</label>
                            <input
                                type="text"
                                maxLength={6}
                                value={address.pinCode}
                                onChange={e => setAddress({ ...address, pinCode: e.target.value.replace(/\D/g, '') })}
                                placeholder="400020"
                                className={inputCls('pinCode')}
                            />
                            {errors.pinCode && <p className="text-[10px] text-red-500 mt-0.5">{errors.pinCode}</p>}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Country</label>
                        <select
                            value={address.country}
                            onChange={e => setAddress({ ...address, country: e.target.value })}
                            className={inputCls('country')}
                        >
                            <option value="India">India</option>
                        </select>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={address.saveAddress}
                            onChange={e => setAddress({ ...address, saveAddress: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                        />
                        <span className="text-xs text-gray-600">Save address for future orders</span>
                    </label>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <Link
                    href="/theme-preview/urban-kicks/cart"
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black transition-colors"
                >
                    <ArrowLeft size={14} /> Back to Cart
                </Link>
                <button
                    onClick={handleSubmit}
                    className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-black/90 active:scale-[0.98] transition-all"
                >
                    Continue to Shipping <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
}

// ============= STEP 2: SHIPPING METHOD =============

function StepShipping({
    onNext,
    onBack,
    cartTotal,
}: {
    onNext: () => void;
    onBack: () => void;
    cartTotal: number;
}) {
    const { shippingMethod, setShippingMethod } = useCheckout();
    const [error, setError] = useState('');

    const handleContinue = () => {
        if (!shippingMethod) {
            setError('Please select a shipping method');
            return;
        }
        onNext();
    };

    return (
        <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
                <Truck size={14} /> Choose Shipping Method
            </h3>

            <div className="space-y-3">
                {SHIPPING_METHODS.map(method => {
                    const disabled = method.minOrder !== undefined && cartTotal < method.minOrder;
                    const selected = shippingMethod === method.id;

                    return (
                        <button
                            key={method.id}
                            disabled={disabled}
                            onClick={() => { setShippingMethod(method.id); setError(''); }}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all
                                ${selected ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-200'}
                                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                        >
                            <div className="flex-shrink-0">
                                {selected
                                    ? <CircleDot size={20} className="text-black" />
                                    : <Circle size={20} className="text-gray-300" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold">{method.label}</span>
                                    {method.badge && (
                                        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                            {method.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{method.eta}</p>
                                {disabled && method.minOrder && (
                                    <p className="text-[10px] text-red-500 mt-0.5">
                                        Requires minimum order of {formatPrice(method.minOrder)}
                                    </p>
                                )}
                            </div>
                            <span className={`text-sm font-bold ${method.price === 0 ? 'text-green-600' : ''}`}>
                                {method.price === 0 ? 'FREE' : formatPrice(method.price)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black transition-colors"
                >
                    <ArrowLeft size={14} /> Back
                </button>
                <button
                    onClick={handleContinue}
                    className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-black/90 active:scale-[0.98] transition-all"
                >
                    Continue to Payment <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
}

// ============= STEP 3: PAYMENT & REVIEW =============

function StepPayment({
    onBack,
    onPlaceOrder,
    orderTotal,
}: {
    onBack: () => void;
    onPlaceOrder: () => void;
    orderTotal: number;
}) {
    const {
        paymentMethod, setPaymentMethod,
        contact, address, shippingMethod,
    } = useCheckout();
    const [error, setError] = useState('');
    const [placing, setPlacing] = useState(false);

    const shippingLabel = SHIPPING_METHODS.find(m => m.id === shippingMethod)?.label || '';
    const shippingEta = SHIPPING_METHODS.find(m => m.id === shippingMethod)?.eta || '';

    const handlePlaceOrder = () => {
        if (!paymentMethod) {
            setError('Please select a payment method');
            return;
        }
        setPlacing(true);
        // Simulate processing delay
        setTimeout(() => {
            onPlaceOrder();
        }, 1500);
    };

    return (
        <div className="space-y-6">
            {/* Payment Method */}
            <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-3 flex items-center gap-2">
                    <CreditCard size={14} /> Payment Method
                </h3>
                <div className="space-y-3">
                    {PAYMENT_METHODS.map(method => {
                        const selected = paymentMethod === method.id;
                        return (
                            <button
                                key={method.id}
                                onClick={() => { setPaymentMethod(method.id); setError(''); }}
                                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all
                                    ${selected ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-200'}
                                `}
                            >
                                <div className="flex-shrink-0">
                                    {selected
                                        ? <CircleDot size={20} className="text-black" />
                                        : <Circle size={20} className="text-gray-300" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        {method.id === 'razorpay'
                                            ? <CreditCard size={16} className="text-blue-600" />
                                            : <Banknote size={16} className="text-green-600" />
                                        }
                                        <span className="text-sm font-semibold">{method.label}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{method.description}</p>
                                </div>
                                {method.extraFee && (
                                    <span className="text-[10px] text-amber-600 font-medium">
                                        +{formatPrice(method.extraFee)} fee
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            {/* Review Summary */}
            <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-3 flex items-center gap-2">
                    <Package size={14} /> Review Your Order
                </h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                        <Mail size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium">{contact.name}</p>
                            <p className="text-xs text-gray-500">{contact.email} · {contact.phone}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-500">
                                {address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.pinCode}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Truck size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-500">{shippingLabel} ({shippingEta})</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black transition-colors"
                >
                    <ArrowLeft size={14} /> Back
                </button>
                <button
                    onClick={handlePlaceOrder}
                    disabled={placing}
                    className={`flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all
                        ${placing ? 'opacity-70 cursor-wait' : 'hover:bg-black/90 active:scale-[0.98]'}
                    `}
                >
                    {placing ? (
                        <>
                            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Lock size={14} />
                            Place Order · {formatPrice(orderTotal)}
                            <ArrowRight size={14} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

// ============= ORDER SUMMARY SIDEBAR =============

function OrderSummary({
    shippingCost,
    discount,
    couponApplied,
}: {
    shippingCost: number;
    discount: number;
    couponApplied: boolean;
}) {
    const { items, cartTotal, cartCount } = useCart();
    const { paymentMethod } = useCheckout();
    const [expanded, setExpanded] = useState(true);

    const codFee = paymentMethod === 'cod' ? 49 : 0;
    const subtotalAfterDiscount = cartTotal - discount;
    const tax = Math.round(subtotalAfterDiscount * 0.18);
    const total = subtotalAfterDiscount + shippingCost + tax + codFee;

    return (
        <div className="bg-gray-50 rounded-2xl overflow-hidden">
            {/* Header — clickable on mobile */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-5 lg:cursor-default"
            >
                <h3 className="font-bold text-base">Order Summary</h3>
                <div className="flex items-center gap-2 lg:hidden">
                    <span className="text-sm font-bold">{formatPrice(total)}</span>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            <div className={`${expanded ? 'block' : 'hidden lg:block'} px-5 pb-5 space-y-4`}>
                {/* Items */}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                    {items.map(item => (
                        <div key={item.id} className="flex items-center gap-3">
                            <div className="relative w-12 h-12 bg-white rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                                <img
                                    src={item.images?.[0] || ''}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                />
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-black text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                    {item.quantity}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{item.name}</p>
                                <p className="text-[10px] text-gray-400">UK 9 · Default</p>
                            </div>
                            <span className="text-xs font-semibold">{formatPrice(item.price * item.quantity)}</span>
                        </div>
                    ))}
                </div>

                {/* Totals */}
                <div className="border-t border-gray-200 pt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal ({cartCount} items)</span>
                        <span className="font-medium">{formatPrice(cartTotal)}</span>
                    </div>
                    {couponApplied && discount > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>Discount (10%)</span>
                            <span className="font-medium">−{formatPrice(discount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-gray-500">Shipping</span>
                        <span className={`font-medium ${shippingCost === 0 ? 'text-green-600' : ''}`}>
                            {shippingCost === 0 ? 'FREE' : formatPrice(shippingCost)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Tax (GST 18%)</span>
                        <span className="font-medium">{formatPrice(tax)}</span>
                    </div>
                    {codFee > 0 && (
                        <div className="flex justify-between text-amber-600">
                            <span>COD Handling Fee</span>
                            <span className="font-medium">{formatPrice(codFee)}</span>
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-200 pt-3 flex justify-between items-baseline">
                    <span className="font-bold">Total</span>
                    <span className="font-bold text-xl">{formatPrice(total)}</span>
                </div>

                {/* Trust badges */}
                <div className="grid grid-cols-3 gap-1 pt-2">
                    {[
                        { icon: Lock, label: 'Secure Pay' },
                        { icon: Truck, label: 'Free Ship 2K+' },
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
    );
}

// ============= MAIN CHECKOUT PAGE =============

export default function CheckoutPage() {
    const router = useRouter();
    const { items, cartTotal, cartCount, clearCart } = useCart();
    const checkout = useCheckout();
    const { step, setStep, shippingMethod, paymentMethod, placeOrder, resetCheckout } = checkout;

    // Redirect to cart if empty
    useEffect(() => {
        if (items.length === 0 && !checkout.orderId) {
            router.replace('/theme-preview/urban-kicks/cart');
        }
    }, [items.length, checkout.orderId, router]);

    // Calculate prices
    const couponApplied = false; // Read from cart if coupon was applied — simplified for preview
    const discount = couponApplied ? Math.round(cartTotal * 0.1) : 0;
    const shippingCost = shippingMethod
        ? (SHIPPING_METHODS.find(m => m.id === shippingMethod)?.price ?? 0)
        : 0;
    const codFee = paymentMethod === 'cod' ? 49 : 0;
    const subtotalAfterDiscount = cartTotal - discount;
    const tax = Math.round(subtotalAfterDiscount * 0.18);
    const orderTotal = subtotalAfterDiscount + shippingCost + tax + codFee;

    const handlePlaceOrder = () => {
        const orderId = placeOrder();
        clearCart();
        router.push('/theme-preview/urban-kicks/checkout/confirmation');
    };

    if (items.length === 0 && !checkout.orderId) return null;

    return (
        <PreviewShell hideFooter showWatermark>
            <div className="max-w-screen-xl mx-auto px-4 py-6 md:py-10">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
                    <Link href="/theme-preview/urban-kicks" className="hover:text-black transition-colors">Home</Link>
                    <ChevronRight size={12} />
                    <Link href="/theme-preview/urban-kicks/cart" className="hover:text-black transition-colors">Cart</Link>
                    <ChevronRight size={12} />
                    <span className="text-black font-medium">Checkout</span>
                </nav>

                {/* Header */}
                <h1 className="text-xl md:text-2xl font-bold tracking-tight mb-6">Checkout</h1>

                {/* Step Indicator */}
                <StepIndicator current={step} />

                {/* Main layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                    {/* Form Column */}
                    <div className="lg:col-span-7 xl:col-span-8">
                        {step === 1 && (
                            <StepContact
                                onNext={() => setStep(2)}
                            />
                        )}
                        {step === 2 && (
                            <StepShipping
                                onNext={() => setStep(3)}
                                onBack={() => setStep(1)}
                                cartTotal={cartTotal}
                            />
                        )}
                        {step === 3 && (
                            <StepPayment
                                onBack={() => setStep(2)}
                                onPlaceOrder={handlePlaceOrder}
                                orderTotal={orderTotal}
                            />
                        )}
                    </div>

                    {/* Order Summary Column */}
                    <div className="lg:col-span-5 xl:col-span-4">
                        <div className="sticky top-36">
                            <OrderSummary
                                shippingCost={shippingCost}
                                discount={discount}
                                couponApplied={couponApplied}
                            />
                        </div>
                    </div>
                </div>
            </div>

        </PreviewShell>
    );
}
