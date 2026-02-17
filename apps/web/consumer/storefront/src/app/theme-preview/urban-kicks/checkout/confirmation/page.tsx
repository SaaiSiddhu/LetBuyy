'use client';

import PreviewShell from '../../_components/preview-shell';
import { useCheckout } from '../../_context/checkout-context';
import { formatPrice, SHIPPING_METHODS, PAYMENT_METHODS } from '../../_lib/mock-data';
import {
    CheckCircle2, Package, Truck, Mail, MapPin,
    ArrowRight, ShoppingBag, Copy, Check,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function ConfirmationPage() {
    const router = useRouter();
    const { orderId, orderDate, contact, address, shippingMethod, paymentMethod, resetCheckout } = useCheckout();
    const [copied, setCopied] = useState(false);
    const [showCheck, setShowCheck] = useState(false);

    // Animated entrance
    useEffect(() => {
        const t = setTimeout(() => setShowCheck(true), 200);
        return () => clearTimeout(t);
    }, []);

    // Redirect if no order
    useEffect(() => {
        if (!orderId) {
            router.replace('/theme-preview/urban-kicks/shop');
        }
    }, [orderId, router]);

    if (!orderId) return null;

    const shippingInfo = SHIPPING_METHODS.find(m => m.id === shippingMethod);
    const paymentInfo = PAYMENT_METHODS.find(m => m.id === paymentMethod);

    // Estimated delivery date
    const estimatedDelivery = (() => {
        const d = new Date();
        const daysMap = { standard: 7, express: 3, free: 10 };
        d.setDate(d.getDate() + (daysMap[shippingMethod || 'standard'] || 7));
        const d2 = new Date(d);
        d2.setDate(d2.getDate() + 2);
        return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${d2.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    })();

    const orderDateFormatted = orderDate
        ? new Date(orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

    const copyOrderId = () => {
        navigator.clipboard.writeText(orderId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleContinueShopping = () => {
        resetCheckout();
        router.push('/theme-preview/urban-kicks/shop');
    };

    return (
        <PreviewShell>
            <div className="max-w-2xl mx-auto px-4 py-12 md:py-20">
                {/* Success Animation */}
                <div className="text-center mb-8">
                    <div className={`w-20 h-20 mx-auto rounded-full bg-green-50 flex items-center justify-center transition-all duration-700 ${showCheck ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
                        <CheckCircle2
                            size={40}
                            className={`text-green-500 transition-all duration-500 delay-300 ${showCheck ? 'scale-100' : 'scale-0'}`}
                        />
                    </div>
                    <h1 className={`text-2xl md:text-3xl font-bold mt-5 transition-all duration-500 delay-500 ${showCheck ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                        Order Confirmed!
                    </h1>
                    <p className={`text-gray-500 text-sm mt-2 transition-all duration-500 delay-700 ${showCheck ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                        Thank you for your order{contact.name ? `, ${contact.name.split(' ')[0]}` : ''}! 🎉
                    </p>
                </div>

                {/* Order Details Card */}
                <div className="bg-gray-50 rounded-2xl p-5 md:p-6 space-y-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Order Number</p>
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm font-bold font-mono">{orderId}</p>
                                <button onClick={copyOrderId} className="text-gray-400 hover:text-black transition-colors">
                                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Date</p>
                            <p className="text-sm font-medium">{orderDateFormatted}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Payment</p>
                            <p className="text-sm font-medium">{paymentInfo?.label || 'Online'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Est. Delivery</p>
                            <p className="text-sm font-medium">{estimatedDelivery}</p>
                        </div>
                    </div>
                </div>

                {/* Shipping Info */}
                <div className="border border-gray-100 rounded-xl p-4 space-y-3 mb-6">
                    <div className="flex items-start gap-3">
                        <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">Delivering to</p>
                            <p className="text-sm font-medium">{contact.name}</p>
                            <p className="text-xs text-gray-500">
                                {address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.pinCode}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Truck size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">Shipping</p>
                            <p className="text-sm font-medium">{shippingInfo?.label} ({shippingInfo?.eta})</p>
                        </div>
                    </div>
                </div>

                {/* What's Next */}
                <div className="bg-black text-white rounded-2xl p-5 mb-6">
                    <h3 className="font-bold text-sm mb-3">What happens next?</h3>
                    <div className="space-y-2.5">
                        {[
                            { step: '1', text: 'You will receive an order confirmation email' },
                            { step: '2', text: 'We will notify you when your order ships' },
                            { step: '3', text: 'Track your delivery in real-time' },
                        ].map(item => (
                            <div key={item.step} className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                    {item.step}
                                </span>
                                <p className="text-xs text-white/80">{item.text}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Email notification */}
                <div className="flex items-center gap-2 justify-center text-xs text-gray-400 mb-8">
                    <Mail size={12} />
                    <span>Confirmation sent to <span className="font-medium text-gray-600">{contact.email || 'your email'}</span></span>
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={handleContinueShopping}
                        className="flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-black/90 transition-colors"
                    >
                        <ShoppingBag size={14} /> Continue Shopping
                    </button>
                    <Link
                        href="/theme-preview/urban-kicks/track-order"
                        className="flex items-center justify-center gap-2 border border-gray-200 text-gray-700 px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                    >
                        <Package size={14} /> Track Order <ArrowRight size={14} />
                    </Link>
                </div>
            </div>
        </PreviewShell>
    );
}
