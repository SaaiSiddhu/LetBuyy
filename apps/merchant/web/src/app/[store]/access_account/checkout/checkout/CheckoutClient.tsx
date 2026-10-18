'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SUBSCRIPTION_OFFERS, type SubscriptionPlanView } from '@/lib/billing/plan-ui'
import { Button, Input, Select, MaterialIcon } from '@letbuyy/ui'
import { retainSubscriptionCheckoutIntent, completeSubscriptionCheckoutIntent } from '@/lib/billing/subscription-checkout-intent'

declare global {
    interface Window {
        Razorpay: new (options: Record<string, unknown>) => {
            open: () => void
            on: (event: string, handler: () => void) => void
        }
    }
}

interface CheckoutClientProps {
    plan: SubscriptionPlanView
    billingPeriod: 'monthly' | 'yearly'
    storeId: string
    storeName: string
    storeSlug: string
    siteType: string
    userId: string
    userEmail: string
    userName: string
}

interface AppliedCoupon {
    code: string
    discount_minor: number
    final_minor: number
    amount_minor: number
    description: string | null
}

const STATES = [
    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
    'Chandigarh', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
    'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
]

const stateOptions = [
    { value: '', label: 'Select state' },
    ...STATES.map((stateName) => ({ value: stateName, label: stateName })),
]

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ')
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readString(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function paymentErrorMessage(payload: unknown, fallback: string) {
    if (!isRecord(payload)) return fallback
    const error = payload.error
    if (typeof error === 'string') return error
    if (isRecord(error)) {
        const message = error.message
        if (typeof message === 'string' && message.length > 0) return message
    }
    return fallback
}

function checkoutThemeColor() {
    const rootStyle = getComputedStyle(document.documentElement)
    return (
        rootStyle.getPropertyValue('--lb-color-primary').trim() ||
        rootStyle.getPropertyValue('--primary').trim() ||
        'rgb(37 99 235)'
    )
}

function formatRupees(value: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(value)
}

function coerceNumber(value: unknown) {
    const amount = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
    return Number.isFinite(amount) ? amount : 0
}

function normalizeOrderData(payload: unknown) {
    const data = isRecord(payload) ? payload : {}

    return {
        activated: data.activated === true,
        checkout_mode: readString(data.checkout_mode),
        key_id: readString(data.key_id),
        razorpay_order_id: readString(data.razorpay_order_id),
        razorpay_subscription_id: readString(data.razorpay_subscription_id),
        amount: coerceNumber(data.amount),
    }
}

export default function CheckoutClient({
    plan,
    billingPeriod: initialBillingPeriod,
    storeId,
    storeName,
    storeSlug,
    siteType,
    userId,
    userEmail,
}: CheckoutClientProps) {
    const router = useRouter()
    const [billingPeriod, setBillingPeriod] = useState(initialBillingPeriod)
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Billing address (used for payment + GST invoicing)
    const [fullName, setFullName] = useState('')
    const [businessName, setBusinessName] = useState('')
    const [gstin, setGstin] = useState('')
    const [phone, setPhone] = useState('')
    const [address1, setAddress1] = useState('')
    const [address2, setAddress2] = useState('')
    const [city, setCity] = useState('')
    const [pinCode, setPinCode] = useState('')
    const [state, setState] = useState('')

    // Coupon
    const [couponInput, setCouponInput] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
    const [couponError, setCouponError] = useState<string | null>(null)
    const [couponLoading, setCouponLoading] = useState(false)

    const monthlyCents = coerceNumber(plan.price_monthly_inr)
    const yearlyCents = coerceNumber(plan.price_yearly_inr)
    const promoCents = coerceNumber(plan.promo_price_inr)
    const promoMonths = Math.max(0, Math.floor(coerceNumber(plan.promo_months)))
    const monthlyPrice = monthlyCents / 100
    const yearlyPerMonth = yearlyCents / 100
    const yearlyTotal = yearlyPerMonth * 12
    const promoPrice = promoCents / 100
    const hasPromo = promoCents > 0 && promoMonths > 0
    const isFreePlan = monthlyCents === 0 && yearlyCents === 0 && !plan.requires_contact

    // Amount charged today: the full annual amount for yearly, the monthly (or promo) amount otherwise.
    const baseDue = billingPeriod === 'yearly' ? yearlyTotal : hasPromo ? promoPrice : monthlyPrice
    const discountDue = appliedCoupon ? appliedCoupon.discount_minor / 100 : 0
    const finalDue = appliedCoupon ? appliedCoupon.final_minor / 100 : baseDue
    const yearlySavings = Math.max(0, Math.round((monthlyPrice - yearlyPerMonth) * 12))

    const changeBillingPeriod = (period: 'monthly' | 'yearly') => {
        setBillingPeriod(period)
        // Eligibility + amount changed — clear any applied coupon so it is re-checked.
        setAppliedCoupon(null)
        setCouponError(null)
    }

    const timeline = useMemo(() => {
        const today = new Date()
        const entries: Array<{ date: string; label: string; amount: string; isActive?: boolean; description?: string }> = []

        entries.push({
            date: 'Today',
            label: 'Start your plan',
            amount: billingPeriod === 'yearly'
                ? `${formatRupees(yearlyTotal)}/year`
                : hasPromo
                    ? `${formatRupees(promoPrice)}/month`
                    : `${formatRupees(monthlyPrice)}/month`,
            isActive: true,
        })

        if (hasPromo && billingPeriod === 'monthly') {
            const promoEnd = new Date(today)
            promoEnd.setMonth(promoEnd.getMonth() + promoMonths)
            entries.push({
                date: promoEnd.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                label: 'Regular pricing begins',
                amount: `${formatRupees(monthlyPrice)}/month`,
                description: `${formatRupees(promoPrice)} x ${promoMonths} months promo ends`,
            })
        }

        const renewalDate = new Date(today)
        if (billingPeriod === 'yearly') {
            renewalDate.setFullYear(renewalDate.getFullYear() + 1)
            entries.push({
                date: renewalDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                label: 'Next renewal',
                amount: `${formatRupees(yearlyTotal)}/year`,
            })
        } else if (!hasPromo) {
            renewalDate.setMonth(renewalDate.getMonth() + 1)
            entries.push({
                date: renewalDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                label: 'Next renewal',
                amount: `${formatRupees(monthlyPrice)}/month`,
            })
        }

        return entries
    }, [billingPeriod, hasPromo, monthlyPrice, promoMonths, promoPrice, yearlyTotal])

    const handleApplyCoupon = async () => {
        const code = couponInput.trim()
        if (!code) return
        setCouponLoading(true)
        setCouponError(null)
        try {
            const res = await fetch('/api/subscribe/coupon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store_id: storeId,
                    plan_slug: plan.slug,
                    billing_period: billingPeriod,
                    site_type: siteType,
                    coupon_code: code,
                }),
            })
            const data = await res.json().catch(() => null)
            if (!res.ok || !isRecord(data) || data.valid !== true) {
                setAppliedCoupon(null)
                setCouponError(
                    (isRecord(data) && typeof data.message === 'string' && data.message)
                        || paymentErrorMessage(data, 'Coupon could not be applied'),
                )
                return
            }
            setAppliedCoupon({
                code: String(data.code || code).toUpperCase(),
                discount_minor: coerceNumber(data.discount_minor),
                final_minor: coerceNumber(data.final_minor),
                amount_minor: coerceNumber(data.amount_minor),
                description: typeof data.description === 'string' ? data.description : null,
            })
            setCouponError(null)
        } catch {
            setAppliedCoupon(null)
            setCouponError('Coupon could not be applied. Try again.')
        } finally {
            setCouponLoading(false)
        }
    }

    const handleRemoveCoupon = () => {
        setAppliedCoupon(null)
        setCouponInput('')
        setCouponError(null)
    }

    const handleSubscribe = async () => {
        setIsProcessing(true)
        setError(null)

        try {
            if (!navigator.locks) throw new Error('Please use an updated browser to keep checkout progress safe.')
            const orderBody = {
                store_id: storeId,
                plan_slug: plan.slug,
                billing_period: billingPeriod,
                site_type: siteType,
                ...(appliedCoupon ? { coupon_code: appliedCoupon.code } : {}),
            }
            const intent = await retainSubscriptionCheckoutIntent(userId, orderBody, localStorage, navigator.locks)
            const orderRes = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': intent.key },
                body: JSON.stringify(orderBody),
            })

            const orderPayload = await orderRes.json().catch(() => null)
            if (!orderRes.ok) throw new Error(paymentErrorMessage(orderPayload, 'Failed to create order'))

            const orderData = normalizeOrderData(orderPayload)

            if (orderData.activated || orderData.checkout_mode === 'free_activation') {
                await completeSubscriptionCheckoutIntent(intent, localStorage, navigator.locks).catch(() => {})
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
                    name: fullName || undefined,
                    email: userEmail,
                    contact: phone || undefined,
                },
                notes: {
                    store_id: storeId,
                    plan_slug: plan.slug,
                    ...(appliedCoupon ? { coupon_code: appliedCoupon.code } : {}),
                },
                theme: { color: checkoutThemeColor() },
                modal: {
                    // Closing the Razorpay modal (X or Esc) fires neither `handler`
                    // nor `payment.failed`, and the outer catch has already been
                    // passed by the time `open()` runs — so without this the
                    // `isProcessing` set before the request was never cleared. The
                    // CTA is `loading={isProcessing}`, and loading hard-disables the
                    // button, so a merchant who backed out of payment could not
                    // retry without reloading the page.
                    // Dismissal is a deliberate choice, not a failure: restore the
                    // form rather than showing an error.
                    ondismiss: () => {
                        setIsProcessing(false)
                    },
                },
                handler: async function (response: Record<string, string>) {
                    try {
                        const verifyRes = await fetch('/api/subscribe/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': `subscription-verify:${response.razorpay_payment_id}` },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id || orderData.razorpay_order_id || undefined,
                                razorpay_subscription_id: response.razorpay_subscription_id || orderData.razorpay_subscription_id || undefined,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                store_id: storeId,
                                plan_slug: plan.slug,
                                billing_period: billingPeriod,
                                site_type: siteType,
                                ...(appliedCoupon ? { coupon_code: appliedCoupon.code } : {}),
                            }),
                        })
                        const verifyData = await verifyRes.json().catch(() => null)
                        if (!verifyRes.ok) {
                            setError(paymentErrorMessage(verifyData, 'Payment verification failed'))
                            setIsProcessing(false)
                            return
                        }
                        await completeSubscriptionCheckoutIntent(intent, localStorage, navigator.locks).catch(() => {})
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

    const cadenceLabel = billingPeriod === 'yearly' ? 'Annual subscription' : 'Monthly subscription'

    return (
        <div className="select-plan-page">
            <section className="select-plan-hero">
                <div className="select-plan-breadcrumb" aria-label="Checkout context">
                    <MaterialIcon name="storefront" size={16} />
                    <Link href={`/${storeSlug}/access_account/checkout/select-plan`} className="checkout-crumb-link">
                        Select Plan
                    </Link>
                    <MaterialIcon name="chevron_right" size={14} className="select-plan-muted-icon" />
                    <span>Checkout</span>
                </div>

                <h1 className="select-plan-title">
                    {isFreePlan ? `Activate your ${plan.name} plan` : 'Complete your subscription'}
                </h1>

                <div className="select-plan-highlights" aria-label="Checkout assurances">
                    {[
                        { icon: 'lock', text: 'Secured by Razorpay' },
                        { icon: 'currency_rupee', text: 'UPI, cards & netbanking' },
                        { icon: 'receipt_long', text: 'GST invoice included' },
                        { icon: 'autorenew', text: 'Cancel anytime' },
                    ].map((highlight, index) => (
                        <div key={index} className="select-plan-highlight">
                            <MaterialIcon name={highlight.icon} size={16} className="select-plan-primary-icon" />
                            <span>{highlight.text}</span>
                        </div>
                    ))}
                </div>
            </section>

            <div className="checkout-grid">
                <div className="checkout-main">
                    {!isFreePlan && (
                        <section className="checkout-card" aria-label="Billing cadence">
                            <div className="checkout-card-head">
                                <div>
                                    <h2 className="checkout-card-title">Billing cadence</h2>
                                    <p className="checkout-card-sub">Choose how you want to pay for this plan.</p>
                                </div>
                                {yearlySavings > 0 && (
                                    <span className="checkout-save">Save {formatRupees(yearlySavings)}/yr</span>
                                )}
                            </div>
                            <div className="checkout-options checkout-options--2">
                                <label className={cx('checkout-option', billingPeriod === 'monthly' && 'is-active')}>
                                    <Input
                                        unstyled
                                        type="radio"
                                        name="billing-period"
                                        value="monthly"
                                        checked={billingPeriod === 'monthly'}
                                        onChange={() => changeBillingPeriod('monthly')}
                                        className="checkout-option-input"
                                    />
                                    <span className="checkout-option-radio" aria-hidden="true" />
                                    <span className="checkout-option-body">
                                        <span className="checkout-option-title">Monthly</span>
                                        <span className="checkout-option-desc">
                                            {hasPromo
                                                ? `${formatRupees(promoPrice)} promo, then ${formatRupees(monthlyPrice)}/mo`
                                                : `${formatRupees(monthlyPrice)} per month`}
                                        </span>
                                    </span>
                                </label>
                                <label className={cx('checkout-option', billingPeriod === 'yearly' && 'is-active')}>
                                    <Input
                                        unstyled
                                        type="radio"
                                        name="billing-period"
                                        value="yearly"
                                        checked={billingPeriod === 'yearly'}
                                        onChange={() => changeBillingPeriod('yearly')}
                                        className="checkout-option-input"
                                    />
                                    <span className="checkout-option-radio" aria-hidden="true" />
                                    <span className="checkout-option-body">
                                        <span className="checkout-option-title">
                                            Yearly
                                            {yearlySavings > 0 && <span className="checkout-cadence-badge">Best value</span>}
                                        </span>
                                        <span className="checkout-option-desc">{formatRupees(yearlyTotal)} per year</span>
                                    </span>
                                </label>
                            </div>
                        </section>
                    )}

                    {!isFreePlan && (
                        <section className="checkout-card" aria-label="Discount code">
                            <div className="checkout-card-head">
                                <div>
                                    <h2 className="checkout-card-title">Have a coupon?</h2>
                                    <p className="checkout-card-sub">Apply a discount code to your first payment.</p>
                                </div>
                            </div>
                            {appliedCoupon ? (
                                <div className="checkout-coupon-applied">
                                    <span className="checkout-coupon-applied-icon">
                                        <MaterialIcon name="check_circle" size={18} />
                                    </span>
                                    <span className="checkout-coupon-applied-body">
                                        <span className="checkout-coupon-applied-code">{appliedCoupon.code} applied</span>
                                        <span className="checkout-coupon-applied-desc">
                                            You save {formatRupees(appliedCoupon.discount_minor / 100)}
                                            {appliedCoupon.description ? ` · ${appliedCoupon.description}` : ''}
                                        </span>
                                    </span>
                                    <Button unstyled type="button" className="checkout-coupon-remove" onClick={handleRemoveCoupon}>
                                        Remove
                                    </Button>
                                </div>
                            ) : (
                                <div className="checkout-coupon-form">
                                    <Input
                                        value={couponInput}
                                        onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                                        placeholder="Enter coupon code"
                                        aria-label="Coupon code"
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault()
                                                handleApplyCoupon()
                                            }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={handleApplyCoupon}
                                        loading={couponLoading}
                                        disabled={!couponInput.trim()}
                                    >
                                        Apply
                                    </Button>
                                </div>
                            )}
                            {couponError && (
                                <p className="checkout-coupon-error" role="alert">
                                    <MaterialIcon name="error" size={14} />
                                    {couponError}
                                </p>
                            )}
                        </section>
                    )}

                    {!isFreePlan && (
                        <section className="checkout-card" aria-label="Billing address">
                            <div className="checkout-card-head">
                                <div>
                                    <h2 className="checkout-card-title">Billing details</h2>
                                    <p className="checkout-card-sub">Used for payment and your GST invoice.</p>
                                </div>
                            </div>
                            <div className="checkout-fields checkout-fields--stack">
                                <div className="checkout-fields">
                                    <Input
                                        label="Full name"
                                        value={fullName}
                                        onChange={(event) => setFullName(event.target.value)}
                                        placeholder="Name on the invoice"
                                        autoComplete="name"
                                    />
                                    <Input
                                        label="Phone number"
                                        type="tel"
                                        value={phone}
                                        onChange={(event) => setPhone(event.target.value)}
                                        placeholder="+91 XXXXXXXXXX"
                                        autoComplete="tel"
                                    />
                                </div>
                                <div className="checkout-fields">
                                    <Input
                                        label="Business name"
                                        value={businessName}
                                        onChange={(event) => setBusinessName(event.target.value)}
                                        placeholder="Registered business (optional)"
                                        autoComplete="organization"
                                    />
                                    <Input
                                        label="GSTIN"
                                        value={gstin}
                                        onChange={(event) => setGstin(event.target.value.toUpperCase())}
                                        placeholder="15-digit GSTIN (optional)"
                                        maxLength={15}
                                    />
                                </div>
                                <Input
                                    label="Address line 1"
                                    value={address1}
                                    onChange={(event) => setAddress1(event.target.value)}
                                    placeholder="Street address"
                                    autoComplete="address-line1"
                                />
                                <Input
                                    label="Address line 2"
                                    value={address2}
                                    onChange={(event) => setAddress2(event.target.value)}
                                    placeholder="Apartment, suite, etc. (optional)"
                                    autoComplete="address-line2"
                                />
                                <div className="checkout-fields">
                                    <Input
                                        label="City"
                                        value={city}
                                        onChange={(event) => setCity(event.target.value)}
                                        placeholder="City"
                                        autoComplete="address-level2"
                                    />
                                    <Input
                                        label="PIN code"
                                        value={pinCode}
                                        onChange={(event) => setPinCode(event.target.value)}
                                        placeholder="6-digit PIN"
                                        maxLength={6}
                                        autoComplete="postal-code"
                                    />
                                </div>
                                <div className="checkout-fields">
                                    <Select
                                        label="State"
                                        value={state}
                                        onChange={(event) => setState(event.target.value)}
                                        options={stateOptions}
                                    />
                                    <Input label="Country" value="India" disabled />
                                </div>
                            </div>
                        </section>
                    )}
                </div>

                <aside className="checkout-summary-wrap" aria-label="Order summary">
                    <div className="checkout-summary">
                        <div className="checkout-summary-head">
                            <span className="checkout-brand-mark" aria-hidden="true">
                                <MaterialIcon name="storefront" size={20} />
                            </span>
                            <div className="checkout-brand-copy">
                                <span className="checkout-brand-name">{plan.name} plan</span>
                                <span className="checkout-brand-sub">{cadenceLabel}</span>
                            </div>
                        </div>

                        <div className="checkout-amount-row">
                            <span className="checkout-amount-label">Amount due today</span>
                            <span className="checkout-amount-stack">
                                {appliedCoupon && discountDue > 0 && (
                                    <span className="checkout-amount-was">{formatRupees(baseDue)}</span>
                                )}
                                <span className="checkout-amount">{isFreePlan ? 'Free' : formatRupees(finalDue)}</span>
                            </span>
                        </div>

                        {appliedCoupon && discountDue > 0 && (
                            <div className="checkout-summary-discount">
                                <span><MaterialIcon name="local_offer" size={14} /> {appliedCoupon.code}</span>
                                <span>−{formatRupees(discountDue)}</span>
                            </div>
                        )}

                        <div className="checkout-divider" />

                        <ol className="checkout-timeline">
                            {timeline.map((entry, index) => (
                                <li key={`${entry.label}-${index}`} className="checkout-timeline-item">
                                    <span className={cx('checkout-timeline-dot', entry.isActive && 'is-active')}>
                                        <MaterialIcon name="check_circle" size={16} />
                                    </span>
                                    <span className="checkout-timeline-body">
                                        <span className="checkout-timeline-top">
                                            <span className="checkout-timeline-label">{entry.label}</span>
                                            <span className="checkout-timeline-amount">{entry.amount}</span>
                                        </span>
                                        <span className="checkout-timeline-date">{entry.date}</span>
                                        {entry.description && (
                                            <span className="checkout-timeline-date">{entry.description}</span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ol>

                        {!isFreePlan && SUBSCRIPTION_OFFERS.length > 0 && (
                            <>
                                <div className="checkout-divider" />
                                <details className="checkout-offers">
                                    <summary className="checkout-offers-summary">
                                        <span className="checkout-offers-head">
                                            <MaterialIcon name="check_circle" size={16} className="checkout-offers-check" />
                                            {SUBSCRIPTION_OFFERS.length} offers included
                                        </span>
                                        <MaterialIcon name="expand_more" size={18} className="checkout-offers-chevron" />
                                    </summary>
                                    <div className="checkout-offers-body">
                                        {SUBSCRIPTION_OFFERS.map((offer, index) => (
                                            <p key={index} className="checkout-offer">
                                                <span className="checkout-offer-title">{offer.title}:</span> {offer.body}
                                            </p>
                                        ))}
                                    </div>
                                </details>
                            </>
                        )}

                        {error && (
                            <div className="checkout-error" role="alert">
                                <MaterialIcon name="error" size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button type="button" onClick={handleSubscribe} loading={isProcessing} fullWidth>
                            {isFreePlan ? (
                                <>
                                    <MaterialIcon name="check_circle" size={18} />
                                    Activate {plan.name} plan
                                </>
                            ) : (
                                <>
                                    <MaterialIcon name="lock" size={18} />
                                    Subscribe — {formatRupees(finalDue)}
                                </>
                            )}
                        </Button>

                        <p className="checkout-secure">
                            <MaterialIcon name={isFreePlan ? 'currency_rupee' : 'lock'} size={14} />
                            {isFreePlan ? 'LetBuyy billing' : 'Secured by Razorpay · 0% platform commission'}
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    )
}
