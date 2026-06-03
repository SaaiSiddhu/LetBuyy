'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SubscriptionPlanView } from '@/lib/billing/plan-ui'
import { MaterialIcon } from '@letbuyy/ui'

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

const STATES = [
    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
    'Chandigarh', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
    'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
]

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ')
}

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

function checkoutThemeColor() {
    const rootStyle = getComputedStyle(document.documentElement)
    return (
        rootStyle.getPropertyValue('--lb-color-primary').trim() ||
        rootStyle.getPropertyValue('--primary').trim() ||
        '#2563eb'
    )
}

export default function SubscribeCheckoutClient({
    plan,
    billingPeriod: initialBillingPeriod,
    storeId,
    storeName,
    storeSlug,
    siteType,
    userEmail,
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

    const monthlyPrice = plan.price_monthly_inr / 100
    const yearlyPrice = plan.price_yearly_inr / 100
    const promoPrice = plan.promo_price_inr / 100
    const hasPromo = plan.promo_price_inr > 0 && plan.promo_months > 0
    const isFreePlan = plan.price_monthly_inr === 0 && plan.price_yearly_inr === 0 && !plan.requires_contact
    const currentPrice = billingPeriod === 'yearly' ? yearlyPrice : hasPromo ? promoPrice : monthlyPrice
    const yearlySavings = Math.round((monthlyPrice - yearlyPrice) * 12)

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

    const handleSubscribe = async () => {
        setIsProcessing(true)
        setError(null)

        try {
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

            if (!window.Razorpay) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script')
                    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
                    script.onload = () => resolve()
                    script.onerror = () => reject(new Error('Failed to load payment gateway'))
                    document.body.appendChild(script)
                })
            }

            const razorpay = new window.Razorpay({
                key: orderData.key_id,
                ...(orderData.razorpay_subscription_id
                    ? { subscription_id: orderData.razorpay_subscription_id }
                    : { order_id: orderData.razorpay_order_id }),
                amount: orderData.amount,
                currency: 'INR',
                name: 'LetBuyy',
                description: `${plan.name} Plan - ${billingPeriod === 'yearly' ? 'Annual' : 'Monthly'}`,
                prefill: {
                    email: userEmail,
                    contact: phone || undefined,
                    ...(paymentMethod === 'upi' && upiId ? { vpa: upiId } : {}),
                },
                notes: {
                    store_id: storeId,
                    plan_slug: plan.slug,
                },
                theme: { color: checkoutThemeColor() },
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

    return (
        <div className="subscribe-checkout-page">
            <div className="subscribe-checkout-breadcrumb" aria-label="Checkout context">
                <MaterialIcon name="storefront" size={16} />
                <span>{storeName}</span>
                <MaterialIcon name="chevron_right" size={14} className="select-plan-muted-icon" />
                <span>Subscribe</span>
            </div>

            <div className="subscribe-checkout-grid">
                <div className="subscribe-checkout-form">
                    {!isFreePlan && (
                        <section className="subscribe-checkout-callout subscribe-checkout-callout--success">
                            <div>
                                <strong>Save with yearly billing</strong>
                                <p>₹{yearlySavings.toLocaleString('en-IN')} off (₹{yearlyPrice.toLocaleString('en-IN')}/mo)</p>
                            </div>
                            <button
                                type="button"
                                className={cx('subscribe-checkout-toggle', billingPeriod === 'yearly' && 'is-active')}
                                onClick={() => setBillingPeriod(billingPeriod === 'yearly' ? 'monthly' : 'yearly')}
                                aria-pressed={billingPeriod === 'yearly'}
                                aria-label="Toggle yearly billing"
                            >
                                <span className="subscribe-checkout-toggle-knob" />
                            </button>
                        </section>
                    )}

                    {isFreePlan ? (
                        <section className="subscribe-checkout-section subscribe-checkout-callout subscribe-checkout-callout--success">
                            <h2 className="subscribe-checkout-section-title">Activation</h2>
                            <p>No payment method is required for the Free plan.</p>
                        </section>
                    ) : (
                        <section className="subscribe-checkout-section">
                            <h2 className="subscribe-checkout-section-title">Payment method</h2>

                            <label className={cx('subscribe-checkout-payment-option', paymentMethod === 'upi' && 'is-selected')}>
                                <input
                                    className="subscribe-checkout-payment-input"
                                    type="radio"
                                    name="payment"
                                    value="upi"
                                    checked={paymentMethod === 'upi'}
                                    onChange={() => setPaymentMethod('upi')}
                                />
                                <span className="subscribe-checkout-radio-mark" aria-hidden="true" />
                                <span>
                                    <strong>UPI</strong>
                                    <span>Google Pay, PhonePe, BHIM, etc.</span>
                                </span>
                            </label>

                            {paymentMethod === 'upi' && (
                                <div className="subscribe-checkout-form-row">
                                    <div className="subscribe-checkout-field">
                                        <label htmlFor="upi-id">UPI ID (optional pre-fill)</label>
                                        <input id="upi-id" type="text" placeholder="yourname@upi" value={upiId} onChange={e => setUpiId(e.target.value)} />
                                    </div>
                                    <div className="subscribe-checkout-field">
                                        <label htmlFor="phone">Phone number</label>
                                        <input id="phone" type="tel" placeholder="+91 XXXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
                                    </div>
                                </div>
                            )}

                            <label className={cx('subscribe-checkout-payment-option', paymentMethod === 'card' && 'is-selected')}>
                                <input
                                    className="subscribe-checkout-payment-input"
                                    type="radio"
                                    name="payment"
                                    value="card"
                                    checked={paymentMethod === 'card'}
                                    onChange={() => setPaymentMethod('card')}
                                />
                                <span className="subscribe-checkout-radio-mark" aria-hidden="true" />
                                <span>
                                    <strong>Credit or debit card</strong>
                                    <span>Visa, Mastercard, Amex, RuPay</span>
                                </span>
                            </label>
                        </section>
                    )}

                    {!isFreePlan && (
                        <section className="subscribe-checkout-section">
                            <h2 className="subscribe-checkout-section-title">Billing address</h2>
                            <p className="subscribe-checkout-help">For taxes, provide your business location:</p>

                            <div className="subscribe-checkout-field">
                                <label htmlFor="billing-address">Address</label>
                                <input id="billing-address" type="text" placeholder="Street address" value={address} onChange={e => setAddress(e.target.value)} />
                            </div>

                            <div className="subscribe-checkout-form-row">
                                <div className="subscribe-checkout-field">
                                    <label htmlFor="pin-code">PIN Code</label>
                                    <input id="pin-code" type="text" placeholder="6-digit PIN" value={pinCode} onChange={e => setPinCode(e.target.value)} maxLength={6} />
                                </div>
                                <div className="subscribe-checkout-field">
                                    <label htmlFor="city">City</label>
                                    <input id="city" type="text" placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
                                </div>
                            </div>

                            <div className="subscribe-checkout-form-row">
                                <div className="subscribe-checkout-field">
                                    <label htmlFor="state">State</label>
                                    <select id="state" value={state} onChange={e => setState(e.target.value)}>
                                        <option value="">Select state</option>
                                        {STATES.map(stateName => <option key={stateName} value={stateName}>{stateName}</option>)}
                                    </select>
                                </div>
                                <div className="subscribe-checkout-field">
                                    <label htmlFor="country">Country</label>
                                    <input id="country" type="text" value="India" disabled />
                                </div>
                            </div>
                        </section>
                    )}
                </div>

                <aside className="subscribe-checkout-summary" aria-label="Plan summary">
                    <div className="subscribe-checkout-summary-header">
                        <div className="subscribe-checkout-plan-name">
                            <MaterialIcon name="check_circle" size={20} className="select-plan-success-icon" />
                            <span>{plan.name} plan</span>
                        </div>
                        <strong>₹{currentPrice.toLocaleString('en-IN')}</strong>
                    </div>
                    <p className="subscribe-checkout-summary-note">
                        {billingPeriod === 'yearly' ? 'Annual' : 'Monthly'}
                        {hasPromo && billingPeriod === 'monthly' && ` · ₹${promoPrice} × ${plan.promo_months} mo`}
                    </p>

                    <div className="subscribe-checkout-timeline">
                        {timeline.map((entry, index) => (
                            <div key={index} className="subscribe-checkout-timeline-item">
                                <span className={cx('subscribe-checkout-timeline-dot', entry.isActive && 'is-active')} />
                                <div className="subscribe-checkout-timeline-content">
                                    <div className="subscribe-checkout-timeline-row">
                                        <span>{entry.label}</span>
                                        <span>{entry.amount}</span>
                                    </div>
                                    <p>{entry.date}</p>
                                    {entry.description && <p>{entry.description}</p>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="subscribe-checkout-total">
                        <span>Amount due</span>
                        <div>
                            <strong>₹{currentPrice.toLocaleString('en-IN')} INR</strong>
                            <p>{isFreePlan ? 'no payment required' : 'plus applicable taxes'}</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="subscribe-checkout-submit"
                        onClick={handleSubscribe}
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Processing...' : isFreePlan ? 'Activate Free plan' : `Subscribe · ₹${currentPrice.toLocaleString('en-IN')}`}
                    </button>

                    {error && (
                        <div className="subscribe-checkout-error" role="alert">
                            <MaterialIcon name="error" size={16} />
                            {error}
                        </div>
                    )}

                    <p className="subscribe-checkout-policy">
                        {isFreePlan ? 'Upgrade whenever you need higher limits.' : 'Change or cancel your plan anytime.'}
                    </p>

                    {plan.gmv_percentage > 0 && (
                        <div className="subscribe-checkout-benefits">
                            <div className="subscribe-checkout-benefits-title">
                                <MaterialIcon name="local_offer" size={16} className="select-plan-primary-icon" />
                                <span>Included benefits</span>
                            </div>
                            <ul>
                                <li>
                                    <MaterialIcon name="check" size={14} className="select-plan-success-icon" />
                                    Transaction fee: only {plan.gmv_percentage}% of GMV
                                </li>
                                <li>
                                    <MaterialIcon name="check" size={14} className="select-plan-success-icon" />
                                    7-day free trial included
                                </li>
                            </ul>
                        </div>
                    )}

                    <div className="subscribe-checkout-powered">
                        <MaterialIcon name="lock" size={12} />
                        {isFreePlan ? 'LetBuyy billing' : 'Secured by Razorpay'}
                    </div>
                </aside>
            </div>
        </div>
    )
}
