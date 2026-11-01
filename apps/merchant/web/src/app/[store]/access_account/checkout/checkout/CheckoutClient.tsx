'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SubscriptionTaxSummarySchema, type SubscriptionTaxSummary } from '@letbuyy/api-client'
import { useRouter } from 'next/navigation'
import { type SubscriptionPlanView } from '@/lib/billing/plan-ui'
import { Button, Input, MaterialIcon } from '@letbuyy/ui'
import { retainSubscriptionCheckoutIntent, completeSubscriptionCheckoutIntent, readPendingSubscriptionCheckoutIntent, PendingSubscriptionCheckoutError, type SubscriptionCheckoutIntent } from '@/lib/billing/subscription-checkout-intent'

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

// Validate only the public canonical DTO; supplier/recipient facts stay server-side.
function validateSubscriptionTaxQuote(payload: unknown): SubscriptionTaxSummary {
    const data = isRecord(payload) ? payload : {}
    const parsed = SubscriptionTaxSummarySchema.safeParse(data.tax)
    if (!parsed.success || !Number.isSafeInteger(data.amount) || data.currency !== 'INR'
        || parsed.data.gross_minor !== data.amount) {
        throw new Error('The saved subscription quote needs review. Recover the original checkout or contact support.')
    }
    return parsed.data
}

function formatMinor(value: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100)
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
    const [serverQuote, setServerQuote] = useState<{ tax: SubscriptionTaxSummary; planSlug: string; period: string } | null>(null)
    const [pendingCheckout, setPendingCheckout] = useState<SubscriptionCheckoutIntent | null>(null)
    useEffect(() => {
        let current = true
        if (navigator.locks) {
            void readPendingSubscriptionCheckoutIntent(userId, localStorage, navigator.locks).then(intent => {
                if (current) setPendingCheckout(intent)
            }).catch(() => { if (current) setError('Pending checkout details are unavailable. Keep browser data and contact support.') })
        }
        return () => { current = false }
    }, [userId])

    // Optional Razorpay contact prefill. Invoice facts come from the saved store profile.
    const [fullName, setFullName] = useState('')
    const [phone, setPhone] = useState('')

    // Coupon
    const [couponInput, setCouponInput] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)
    const [couponError, setCouponError] = useState<string | null>(null)
    const [couponLoading, setCouponLoading] = useState(false)
    useEffect(() => { setServerQuote(null) }, [billingPeriod, appliedCoupon])

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

    const handleSubscribe = async (recovery?: SubscriptionCheckoutIntent) => {
        setIsProcessing(true)
        setError(null)
        setServerQuote(null)

        try {
            if (!navigator.locks) throw new Error('Please use an updated browser to keep checkout progress safe.')
            const requestedBody = {
                store_id: storeId,
                plan_slug: plan.slug,
                billing_period: billingPeriod,
                site_type: siteType,
                ...(appliedCoupon ? { coupon_code: appliedCoupon.code } : {}),
            }
            if (recovery && recovery.actorId !== userId) throw new Error('Your account changed. Reopen checkout in the current account.')
            const intent = recovery || await retainSubscriptionCheckoutIntent(userId, requestedBody, localStorage, navigator.locks, undefined,
                `/${storeSlug}/dashboard?subscribed=${plan.slug}`)
            setPendingCheckout(intent)
            const orderBody = intent.body
            const destination = intent.returnPath || (orderBody.store_id === storeId ? `/${storeSlug}/dashboard?subscribed=${orderBody.plan_slug}` : '/')
            const orderRes = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': intent.key },
                body: JSON.stringify({...orderBody, expected_actor_id: userId}),
            })

            const orderPayload = await orderRes.json().catch(() => null)
            if (!orderRes.ok) {
                const code = isRecord(orderPayload) && isRecord(orderPayload.error) ? orderPayload.error.code : null
                // Only named validation failures prove this request had no effect.
                // Network/5xx/source conflicts retain the immutable pending intent.
                if (orderRes.status === 400 && ['VALIDATION_ERROR', 'INVALID_INPUT', 'CHECKOUT_ACTOR_REQUIRED', 'IDEMPOTENCY_KEY_REQUIRED'].includes(String(code))) {
                    await completeSubscriptionCheckoutIntent(intent, localStorage, navigator.locks)
                    setPendingCheckout(null)
                }
                throw new Error(paymentErrorMessage(orderPayload, 'Checkout is pending. Recover the original checkout to retry safely.'))
            }

            const orderData = normalizeOrderData(orderPayload)

            if (orderData.activated || orderData.checkout_mode === 'free_activation') {
                await completeSubscriptionCheckoutIntent(intent, localStorage, navigator.locks).catch(() => {})
                setPendingCheckout(null)
                router.push(destination)
                return
            }

            const tax = validateSubscriptionTaxQuote(orderPayload)
            setServerQuote({ tax, planSlug: orderBody.plan_slug, period: orderBody.billing_period })

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
                description: `${orderBody.plan_slug} Plan - ${orderBody.billing_period === 'yearly' ? 'Annual' : 'Monthly'}`,
                prefill: {
                    name: fullName || undefined,
                    email: userEmail,
                    contact: phone || undefined,
                },
                notes: {
                    store_id: orderBody.store_id,
                    plan_slug: orderBody.plan_slug,
                    ...(orderBody.coupon_code ? { coupon_code: orderBody.coupon_code } : {}),
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
                                expected_actor_id: userId,
                                razorpay_order_id: response.razorpay_order_id || orderData.razorpay_order_id || undefined,
                                razorpay_subscription_id: response.razorpay_subscription_id || orderData.razorpay_subscription_id || undefined,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                ...orderBody,
                            }),
                        })
                        const verifyData = await verifyRes.json().catch(() => null)
                        if (!verifyRes.ok) {
                            setError(paymentErrorMessage(verifyData, 'Payment verification failed'))
                            setIsProcessing(false)
                            return
                        }
                        await completeSubscriptionCheckoutIntent(intent, localStorage, navigator.locks).catch(() => {})
                        setPendingCheckout(null)
                        router.push(destination)
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
            if (err instanceof PendingSubscriptionCheckoutError) setPendingCheckout(err.intent)
            setError(err instanceof Error ? err.message : 'Checkout is pending. Recover the original checkout to retry safely.')
            setIsProcessing(false)
        }
    }

    const cadenceLabel = billingPeriod === 'yearly' ? 'Annual subscription' : 'Monthly subscription'
    const pendingStoreName = pendingCheckout?.body.store_id === storeId ? storeName : pendingCheckout?.returnPath?.split('/')[1] || 'the original store'

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
                        <section className="checkout-card" aria-label="Payment contact">
                            <div className="checkout-card-head">
                                <div>
                                    <h2 className="checkout-card-title">Payment contact</h2>
                                    <p className="checkout-card-sub">Optional details to prefill your payment window.</p>
                                </div>
                            </div>
                            <div className="checkout-fields checkout-fields--stack">
                                <div className="checkout-fields">
                                    <Input
                                        label="Full name"
                                        value={fullName}
                                        onChange={(event) => setFullName(event.target.value)}
                                        placeholder="Contact name"
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
                                <p className="checkout-card-sub">
                                    Invoices use your saved business name, tax ID and billing address.
                                    {' '}Review <Link href={`/${storeSlug}/settings/general`}>Business details</Link>
                                    {' '}and <Link href={`/${storeSlug}/settings/billing/profile`}>Billing profile</Link> before paying.
                                    {' '}Advertised subscription prices include applicable tax. A GSTIN alone does not create an exemption.
                                </p>
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
                                <span className="checkout-brand-name">{serverQuote ? serverQuote.planSlug : plan.name} plan</span>
                                <span className="checkout-brand-sub">{serverQuote ? `Saved ${serverQuote.period} checkout` : cadenceLabel}</span>
                            </div>
                        </div>

                        <div className="checkout-amount-row">
                            <span className="checkout-amount-label">{serverQuote || isFreePlan ? 'Amount due today' : 'Estimated subtotal before tax'}</span>
                            <span className="checkout-amount-stack">
                                {!serverQuote && appliedCoupon && discountDue > 0 && (
                                    <span className="checkout-amount-was">{formatRupees(baseDue)}</span>
                                )}
                                <span className="checkout-amount">{serverQuote ? formatMinor(serverQuote.tax.gross_minor) : isFreePlan ? 'Free' : formatRupees(finalDue)}</span>
                            </span>
                        </div>

                        {!serverQuote && appliedCoupon && discountDue > 0 && (
                            <div className="checkout-summary-discount">
                                <span><MaterialIcon name="local_offer" size={14} /> {appliedCoupon.code}</span>
                                <span>−{formatRupees(discountDue)}</span>
                            </div>
                        )}

                        {serverQuote && (
                            <section aria-label="Saved subscription tax quote" aria-live="polite">
                                <p>Tax is included in this saved subscription total.</p>
                                <dl>
                                    <div><dt>Taxable value</dt><dd>{formatMinor(serverQuote.tax.taxable_minor)}</dd></div>
                                    {serverQuote.tax.supply_type === 'intra_state' ? <>
                                        <div><dt>CGST</dt><dd>{formatMinor(serverQuote.tax.cgst_minor)}</dd></div>
                                        <div><dt>SGST</dt><dd>{formatMinor(serverQuote.tax.sgst_minor)}</dd></div>
                                    </> : <div><dt>IGST</dt><dd>{formatMinor(serverQuote.tax.igst_minor)}</dd></div>}
                                    <div><dt>Final total</dt><dd>{formatMinor(serverQuote.tax.gross_minor)}</dd></div>
                                </dl>
                            </section>
                        )}

                        <div className="checkout-divider" />

                        {!serverQuote && <ol className="checkout-timeline">
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
                        </ol>}

                        {error && (
                            <div className="checkout-error" role="alert">
                                <MaterialIcon name="error" size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        {pendingCheckout && (
                            <div role="status" className="checkout-pending">
                                <p>A checkout for {pendingStoreName} may still be pending. Recover its original {pendingCheckout.body.billing_period} {pendingCheckout.body.plan_slug} request.</p>
                                <Button type="button" onClick={() => void handleSubscribe(pendingCheckout)} disabled={isProcessing} fullWidth>
                                    Recover pending checkout
                                </Button>
                            </div>
                        )}
                        <Button type="button" onClick={() => void handleSubscribe(serverQuote && pendingCheckout ? pendingCheckout : undefined)} loading={isProcessing} fullWidth>
                            {isFreePlan && !serverQuote ? (
                                <>
                                    <MaterialIcon name="check_circle" size={18} />
                                    Activate {plan.name} plan
                                </>
                            ) : (
                                <>
                                    <MaterialIcon name="lock" size={18} />
                                    {serverQuote ? `Continue saved checkout — ${formatMinor(serverQuote.tax.gross_minor)}` : 'Continue to payment'}
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
