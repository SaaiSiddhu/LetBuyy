'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SubscriptionPlanView } from '@/lib/billing/plan-ui'

/* ——————————————————————————————————————
   Subscribe Checkout Client (Inline Styles)
   Two-column: Payment form + Plan summary
   —————————————————————————————————————— */

declare global {
    interface Window {
        Razorpay: new (options: Record<string, unknown>) => {
            open: () => void
            on: (event: string, handler: () => void) => void
        }
    }
}

interface SubscribeCheckoutClientProps {
    plan: SubscriptionPlanView
    billingPeriod: 'monthly' | 'yearly'
    storeId: string
    storeName: string
    storeSlug: string
    siteType: string
    userEmail: string
    userName: string
}

/* — Shared Styles — */
const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--border, #334155)',
    background: 'var(--bg-tertiary, #1E293B)',
    color: 'var(--text-primary, #F1F5F9)',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary, #94A3B8)',
    marginBottom: 6,
}

const sectionTitleStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary, #F1F5F9)',
    margin: '0 0 16px',
}

const STATES = [
    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
    'Chandigarh', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
    'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
]

function paymentErrorMessage(payload: unknown, fallback: string) {
    if (!payload || typeof payload !== 'object') return fallback
    const error = (payload as { error?: unknown }).error
    if (typeof error === 'string') return error
    if (error && typeof error === 'object') {
        const message = (error as { message?: unknown }).message
        if (typeof message === 'string' && message.length > 0) return message
    }
    return fallback
}

export default function SubscribeCheckoutClient({
    plan,
    billingPeriod: initialBillingPeriod,
    storeId,
    storeName,
    storeSlug,
    siteType,
    userEmail,
    userName,
}: SubscribeCheckoutClientProps) {
    const router = useRouter()
    const [billingPeriod, setBillingPeriod] = useState(initialBillingPeriod)
    const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card'>('upi')
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [upiId, setUpiId] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')
    const [pinCode, setPinCode] = useState('')
    const [city, setCity] = useState('')
    const [state, setState] = useState('')

    // Price calculations
    const monthlyPrice = plan.price_monthly_inr / 100
    const yearlyPrice = plan.price_yearly_inr / 100
    const promoPrice = plan.promo_price_inr / 100
    const hasPromo = plan.promo_price_inr > 0 && plan.promo_months > 0
    const isFreePlan = plan.price_monthly_inr === 0 && plan.price_yearly_inr === 0 && !plan.requires_contact
    const currentPrice = billingPeriod === 'yearly' ? yearlyPrice : hasPromo ? promoPrice : monthlyPrice
    const yearlySavings = Math.round((monthlyPrice - yearlyPrice) * 12)

    // Timeline
    const timeline = (() => {
        const today = new Date()
        const entries: Array<{ date: string; label: string; amount: string; isActive?: boolean; description?: string }> = []

        entries.push({
            date: 'Today',
            label: 'Start your plan',
            amount: billingPeriod === 'yearly'
                ? `₹${(yearlyPrice * 12).toLocaleString('en-IN')}/year`
                : hasPromo
                    ? `₹${promoPrice.toLocaleString('en-IN')}/month`
                    : `₹${monthlyPrice.toLocaleString('en-IN')}/month`,
            isActive: true,
        })

        if (hasPromo && billingPeriod === 'monthly') {
            const promoEnd = new Date(today)
            promoEnd.setMonth(promoEnd.getMonth() + plan.promo_months)
            entries.push({
                date: promoEnd.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                label: 'Regular pricing begins',
                amount: `₹${monthlyPrice.toLocaleString('en-IN')}/month`,
                description: `₹${promoPrice} × ${plan.promo_months} months promo ends`,
            })
        }

        const renewalDate = new Date(today)
        if (billingPeriod === 'yearly') {
            renewalDate.setFullYear(renewalDate.getFullYear() + 1)
            entries.push({
                date: renewalDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                label: 'Next renewal',
                amount: `₹${(yearlyPrice * 12).toLocaleString('en-IN')}/year`,
            })
        } else if (!hasPromo) {
            renewalDate.setMonth(renewalDate.getMonth() + 1)
            entries.push({
                date: renewalDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                label: 'Next renewal',
                amount: `₹${monthlyPrice.toLocaleString('en-IN')}/month`,
            })
        }

        return entries
    })()

    // Handle payment
    const handleSubscribe = async () => {
        setIsProcessing(true)
        setError(null)

        try {
            // Step 1: Create Razorpay order
            const orderRes = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store_id: storeId,
                    plan_slug: plan.slug,
                    billing_period: billingPeriod,
                    site_type: siteType,
                }),
            })

            const orderData = await orderRes.json()
            if (!orderRes.ok) throw new Error(paymentErrorMessage(orderData, 'Failed to create order'))

            if (orderData.activated || orderData.checkout_mode === 'free_activation') {
                router.push(`/${storeSlug}/dashboard?subscribed=${plan.slug}`)
                return
            }

            if (!orderData.key_id || (!orderData.razorpay_order_id && !orderData.razorpay_subscription_id)) {
                throw new Error('Payment gateway is not configured for subscription checkout')
            }

            // Step 2: Load Razorpay checkout if needed
            if (!window.Razorpay) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script')
                    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
                    script.onload = () => resolve()
                    script.onerror = () => reject(new Error('Failed to load payment gateway'))
                    document.body.appendChild(script)
                })
            }

            // Step 3: Open Razorpay checkout
            const razorpay = new window.Razorpay({
                key: orderData.key_id,
                ...(orderData.razorpay_subscription_id
                    ? { subscription_id: orderData.razorpay_subscription_id }
                    : { order_id: orderData.razorpay_order_id }),
                amount: orderData.amount,
                currency: 'INR',
                name: 'LetBuyy',
                description: `${plan.name} Plan — ${billingPeriod === 'yearly' ? 'Annual' : 'Monthly'}`,
                prefill: {
                    email: userEmail,
                    contact: phone || undefined,
                    ...(paymentMethod === 'upi' && upiId ? { vpa: upiId } : {}),
                },
                notes: {
                    store_id: storeId,
                    plan_slug: plan.slug,
                },
                theme: { color: '#8B5CF6' },
                handler: async function (response: Record<string, string>) {
                    try {
                        const verifyRes = await fetch('/api/subscribe/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id || orderData.razorpay_order_id || undefined,
                                razorpay_subscription_id: response.razorpay_subscription_id || orderData.razorpay_subscription_id || undefined,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                store_id: storeId,
                                plan_slug: plan.slug,
                                billing_period: billingPeriod,
                                site_type: siteType,
                            }),
                        })
                        const verifyData = await verifyRes.json()
                        if (!verifyRes.ok) {
                            setError(paymentErrorMessage(verifyData, 'Payment verification failed'))
                            setIsProcessing(false)
                            return
                        }
                        router.push(`/${storeSlug}/dashboard?subscribed=${plan.slug}`)
                    } catch {
                        setError('Payment verification failed. Contact support.')
                        setIsProcessing(false)
                    }
                },
            })

            razorpay.on('payment.failed', function () {
                setError('Payment failed. Please try again.')
                setIsProcessing(false)
            })

            razorpay.open()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
            setIsProcessing(false)
        }
    }

    // ─── Main Checkout Form ───
    return (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 80px' }}>
            {/* Breadcrumb */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: 'var(--text-secondary, #94A3B8)',
                marginBottom: 32,
            }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>storefront</span>
                <span>{storeName}</span>
                <span className="material-symbols-outlined" style={{ fontSize: 14, opacity: 0.5 }}>chevron_right</span>
                <span>Subscribe</span>
            </div>

            {/* Two-column grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 380px',
                gap: 32,
                alignItems: 'start',
            }}>
                {/* Left: Payment form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                    {/* Yearly toggle */}
                    {!isFreePlan && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        borderRadius: 12,
                        background: 'rgba(34, 197, 94, 0.06)',
                        border: '1px solid rgba(34, 197, 94, 0.15)',
                    }}>
                        <div>
                            <strong style={{ color: 'var(--text-primary, #F1F5F9)', fontSize: 14 }}>Save with yearly billing</strong>
                            <div style={{ fontSize: 13, color: '#22C55E', marginTop: 2 }}>
                                ₹{yearlySavings.toLocaleString('en-IN')} off (₹{yearlyPrice.toLocaleString('en-IN')}/mo)
                            </div>
                        </div>
                        <button
                            onClick={() => setBillingPeriod(billingPeriod === 'yearly' ? 'monthly' : 'yearly')}
                            style={{
                                width: 48,
                                height: 26,
                                borderRadius: 13,
                                border: 'none',
                                cursor: 'pointer',
                                position: 'relative',
                                transition: 'background 0.2s',
                                background: billingPeriod === 'yearly' ? '#22C55E' : 'var(--border, #334155)',
                            }}
                        >
                            <span style={{
                                position: 'absolute',
                                top: 3,
                                left: billingPeriod === 'yearly' ? 25 : 3,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: '#fff',
                                transition: 'left 0.2s',
                            }} />
                        </button>
                    </div>
                    )}

                    {/* Payment method */}
                    {isFreePlan ? (
                    <div style={{
                        padding: '18px 20px',
                        borderRadius: 12,
                        background: 'rgba(34, 197, 94, 0.06)',
                        border: '1px solid rgba(34, 197, 94, 0.15)',
                    }}>
                        <h3 style={{ ...sectionTitleStyle, marginBottom: 8 }}>Activation</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary, #94A3B8)', margin: 0 }}>
                            No payment method is required for the Free plan.
                        </p>
                    </div>
                    ) : (
                    <div>
                        <h3 style={sectionTitleStyle}>Payment method</h3>

                        {/* UPI option */}
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '14px 18px',
                            borderRadius: 10,
                            cursor: 'pointer',
                            marginBottom: 8,
                            border: paymentMethod === 'upi'
                                ? '2px solid var(--primary, #8B5CF6)'
                                : '1px solid var(--border, #334155)',
                            background: paymentMethod === 'upi'
                                ? 'rgba(139, 92, 246, 0.06)'
                                : 'var(--bg-secondary, #0F172A)',
                        }}>
                            <input type="radio" name="payment" value="upi" checked={paymentMethod === 'upi'} onChange={() => setPaymentMethod('upi')} style={{ display: 'none' }} />
                            <span style={{
                                width: 18, height: 18, borderRadius: '50%',
                                border: paymentMethod === 'upi' ? '5px solid var(--primary, #8B5CF6)' : '2px solid var(--border, #334155)',
                                flexShrink: 0,
                            }} />
                            <div>
                                <strong style={{ fontSize: 14, color: 'var(--text-primary, #F1F5F9)' }}>UPI</strong>
                                <div style={{ fontSize: 12, color: 'var(--text-hint, #64748B)', marginTop: 2 }}>Google Pay, PhonePe, BHIM, etc.</div>
                            </div>
                        </label>

                        {paymentMethod === 'upi' && (
                            <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>UPI ID (optional pre-fill)</label>
                                    <input type="text" placeholder="yourname@upi" value={upiId} onChange={e => setUpiId(e.target.value)} style={inputStyle} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Phone number</label>
                                    <input type="tel" placeholder="+91 XXXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
                                </div>
                            </div>
                        )}

                        {/* Card option */}
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '14px 18px',
                            borderRadius: 10,
                            cursor: 'pointer',
                            border: paymentMethod === 'card'
                                ? '2px solid var(--primary, #8B5CF6)'
                                : '1px solid var(--border, #334155)',
                            background: paymentMethod === 'card'
                                ? 'rgba(139, 92, 246, 0.06)'
                                : 'var(--bg-secondary, #0F172A)',
                        }}>
                            <input type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} style={{ display: 'none' }} />
                            <span style={{
                                width: 18, height: 18, borderRadius: '50%',
                                border: paymentMethod === 'card' ? '5px solid var(--primary, #8B5CF6)' : '2px solid var(--border, #334155)',
                                flexShrink: 0,
                            }} />
                            <div>
                                <strong style={{ fontSize: 14, color: 'var(--text-primary, #F1F5F9)' }}>Credit or debit card</strong>
                                <div style={{ fontSize: 12, color: 'var(--text-hint, #64748B)', marginTop: 2 }}>Visa, Mastercard, Amex, RuPay</div>
                            </div>
                        </label>
                    </div>
                    )}

                    {/* Billing address */}
                    {!isFreePlan && (
                    <div>
                        <h3 style={sectionTitleStyle}>Billing address</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-hint, #64748B)', margin: '-8px 0 16px' }}>
                            For taxes, provide your business location:
                        </p>

                        <div style={{ marginBottom: 12 }}>
                            <label style={labelStyle}>Address</label>
                            <input type="text" placeholder="Street address" value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                                <label style={labelStyle}>PIN Code</label>
                                <input type="text" placeholder="6-digit PIN" value={pinCode} onChange={e => setPinCode(e.target.value)} maxLength={6} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>City</label>
                                <input type="text" placeholder="City" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={labelStyle}>State</label>
                                <select value={state} onChange={e => setState(e.target.value)} style={{ ...inputStyle, appearance: 'auto' as const }}>
                                    <option value="">Select state</option>
                                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Country</label>
                                <input type="text" value="India" disabled style={{ ...inputStyle, opacity: 0.5 }} />
                            </div>
                        </div>
                    </div>
                    )}
                </div>

                {/* Right: Plan summary */}
                <div style={{
                    position: 'sticky',
                    top: 88,
                    background: 'var(--bg-secondary, #0F172A)',
                    borderRadius: 16,
                    border: '1px solid var(--border, #334155)',
                    padding: '24px',
                }}>
                    {/* Plan header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#22C55E' }}>check_circle</span>
                            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #F1F5F9)' }}>{plan.name} plan</span>
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #F1F5F9)' }}>
                            ₹{currentPrice.toLocaleString('en-IN')}
                        </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-hint, #64748B)', margin: '0 0 20px' }}>
                        {billingPeriod === 'yearly' ? 'Annual' : 'Monthly'}
                        {hasPromo && billingPeriod === 'monthly' && ` · ₹${promoPrice} × ${plan.promo_months} mo`}
                    </p>

                    {/* Timeline */}
                    <div style={{ marginBottom: 20 }}>
                        {timeline.map((entry, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 12,
                                padding: '10px 0',
                                borderBottom: i < timeline.length - 1 ? '1px solid var(--border, #334155)' : 'none',
                            }}>
                                <span style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: entry.isActive ? 'var(--primary, #8B5CF6)' : 'var(--border, #334155)',
                                    flexShrink: 0,
                                    marginTop: 6,
                                }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F1F5F9)' }}>{entry.label}</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F1F5F9)' }}>{entry.amount}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-hint, #64748B)', marginTop: 2 }}>{entry.date}</div>
                                    {entry.description && (
                                        <div style={{ fontSize: 11, color: 'var(--text-hint, #64748B)', marginTop: 2 }}>{entry.description}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Total */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px 0',
                        borderTop: '1px solid var(--border, #334155)',
                        marginBottom: 20,
                    }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #F1F5F9)' }}>Amount due</span>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #F1F5F9)' }}>
                                ₹{currentPrice.toLocaleString('en-IN')} INR
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-hint, #64748B)' }}>
                                {isFreePlan ? 'no payment required' : 'plus applicable taxes'}
                            </div>
                        </div>
                    </div>

                    {/* Subscribe button */}
                    <button
                        onClick={handleSubscribe}
                        disabled={isProcessing}
                        style={{
                            width: '100%',
                            padding: '14px 0',
                            borderRadius: 10,
                            border: 'none',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            fontSize: 15,
                            fontWeight: 700,
                            fontFamily: 'inherit',
                            background: isProcessing ? 'var(--bg-tertiary, #1E293B)' : 'var(--primary, #8B5CF6)',
                            color: '#fff',
                            transition: 'all 0.2s',
                            marginBottom: 12,
                        }}
                    >
                        {isProcessing ? 'Processing...' : isFreePlan ? 'Activate Free plan' : `Subscribe · ₹${currentPrice.toLocaleString('en-IN')}`}
                    </button>

                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#EF4444',
                            fontSize: 13,
                            marginBottom: 12,
                        }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
                            {error}
                        </div>
                    )}

                    <p style={{
                        textAlign: 'center',
                        fontSize: 12,
                        color: 'var(--text-hint, #64748B)',
                        margin: '0 0 16px',
                    }}>
                        {isFreePlan ? 'Upgrade whenever you need higher limits.' : 'Change or cancel your plan anytime.'}
                    </p>

                    {/* Benefits */}
                    {plan.gmv_percentage > 0 && (
                        <div style={{
                            padding: '14px 16px',
                            borderRadius: 10,
                            background: 'rgba(139, 92, 246, 0.06)',
                            border: '1px solid rgba(139, 92, 246, 0.15)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary, #8B5CF6)' }}>local_offer</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F1F5F9)' }}>Included benefits</span>
                            </div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: 'var(--text-secondary, #94A3B8)' }}>
                                <li style={{ padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#22C55E' }}>check</span>
                                    Transaction fee: only {plan.gmv_percentage}% of GMV
                                </li>
                                <li style={{ padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#22C55E' }}>check</span>
                                    7-day free trial included
                                </li>
                            </ul>
                        </div>
                    )}

                    {/* Powered by */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        marginTop: 16,
                        fontSize: 11,
                        color: 'var(--text-hint, #64748B)',
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>lock</span>
                        {isFreePlan ? 'LetBuyy billing' : 'Secured by Razorpay'}
                    </div>
                </div>
            </div>
        </div>
    )
}
