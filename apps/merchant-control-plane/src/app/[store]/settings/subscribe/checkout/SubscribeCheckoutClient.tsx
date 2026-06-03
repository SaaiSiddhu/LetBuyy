'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SubscriptionPlanView } from '@/lib/billing/plan-ui'
import {
    Badge,
    Banner,
    Button,
    Card,
    Check,
    CheckCircle2,
    CreditCard,
    IndianRupee,
    Input,
    ListChecks,
    Lock,
    Phone,
    Rocket,
    Section,
    Select,
    ShieldCheck,
    Store,
    Tag,
} from '@letbuyy/ui'

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

const STATE_OPTIONS = [
    { label: 'Select state', value: '' },
    ...STATES.map((stateName) => ({ label: stateName, value: stateName })),
]

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ')
}

function formatCheckoutPrice(amount: number) {
    if (amount <= 0) return 'Free'
    return `₹${amount.toLocaleString('en-IN')}`
}

function billingPeriodLabel(value: 'monthly' | 'yearly') {
    return value === 'yearly' ? 'Annual' : 'Monthly'
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
        '#8B5CF6'
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
        <div className="grid min-w-0 gap-[var(--lb-space-4)] xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
            <div className="flex min-w-0 flex-col gap-[var(--lb-space-4)]">
                <Card>
                    <Section title="Checkout context" description="Confirm the store, site type, and billing period before payment.">
                        <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                            <div className="flex min-w-0 items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                <Store className="mt-[2px] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-primary)]" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        Store
                                    </p>
                                    <p className="m-0 truncate text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                        {storeName}
                                    </p>
                                </div>
                            </div>
                            <div className="flex min-w-0 items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                <Tag className="mt-[2px] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-primary)]" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        Site type
                                    </p>
                                    <p className="m-0 truncate text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                        {siteType}
                                    </p>
                                </div>
                            </div>
                            <div className="flex min-w-0 items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                <ListChecks className="mt-[2px] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-primary)]" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                        Billing
                                    </p>
                                    <p className="m-0 truncate text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                        {billingPeriodLabel(billingPeriod)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Section>
                </Card>

                {!isFreePlan && (
                    <Banner
                        variant="success"
                        title="Yearly billing option"
                        action={(
                            <div className="flex rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-1)]">
                                {(['monthly', 'yearly'] as const).map((period) => (
                                    <button
                                        key={period}
                                        type="button"
                                        className={cx(
                                            'inline-flex h-[var(--lb-density-icon-button-height)] items-center justify-center rounded-[var(--lb-radius-sm)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]',
                                            billingPeriod === period
                                                ? 'bg-[var(--lb-color-primary)] text-[color:var(--lb-color-text-inverse)]'
                                                : 'text-[color:var(--lb-color-text-subdued)] hover:text-[color:var(--lb-color-text)]',
                                        )}
                                        onClick={() => setBillingPeriod(period)}
                                        aria-pressed={billingPeriod === period}
                                    >
                                        {billingPeriodLabel(period)}
                                    </button>
                                ))}
                            </div>
                        )}
                    >
                        <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]">
                            {yearlySavings > 0
                                ? `Save ₹${yearlySavings.toLocaleString('en-IN')} with annual billing at ₹${yearlyPrice.toLocaleString('en-IN')}/mo.`
                                : `Annual billing is available at ₹${yearlyPrice.toLocaleString('en-IN')}/mo.`}
                        </p>
                    </Banner>
                )}

                {isFreePlan ? (
                    <Card>
                        <Section title="Activation" description="No payment method is required for the Free plan.">
                            <div className="flex items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-success)] bg-[var(--lb-color-success-soft)] p-[var(--lb-space-4)] text-[color:var(--lb-color-text)]">
                                <CheckCircle2 className="mt-[2px] h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] shrink-0 text-[var(--lb-color-success)]" aria-hidden="true" />
                                <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)]">
                                    Activate the plan now and upgrade whenever you need higher limits.
                                </p>
                            </div>
                        </Section>
                    </Card>
                ) : (
                    <Card>
                        <Section title="Payment method" description="Razorpay will collect and verify payment after this review step.">
                            <div className="grid gap-[var(--lb-space-3)]">
                                <label
                                    className={cx(
                                        'flex cursor-pointer items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border p-[var(--lb-space-4)] transition-colors',
                                        paymentMethod === 'upi'
                                            ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)]'
                                            : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] hover:bg-[var(--lb-color-surface-subdued)]',
                                    )}
                                >
                                    <input
                                        className="sr-only"
                                        type="radio"
                                        name="payment"
                                        value="upi"
                                        checked={paymentMethod === 'upi'}
                                        onChange={() => setPaymentMethod('upi')}
                                    />
                                    <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] text-[var(--lb-color-primary)]">
                                        <IndianRupee className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                            UPI
                                        </span>
                                        <span className="block text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                                            Google Pay, PhonePe, BHIM, and other UPI apps.
                                        </span>
                                    </span>
                                    {paymentMethod === 'upi' && <Check className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-primary)]" aria-hidden="true" />}
                                </label>

                                {paymentMethod === 'upi' && (
                                    <div className="grid gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] md:grid-cols-2">
                                        <Input
                                            id="upi-id"
                                            label="UPI ID"
                                            helperText="Optional pre-fill for the Razorpay checkout."
                                            type="text"
                                            placeholder="yourname@upi"
                                            value={upiId}
                                            onChange={(event) => setUpiId(event.target.value)}
                                        />
                                        <Input
                                            id="phone"
                                            label="Phone number"
                                            type="tel"
                                            placeholder="+91 XXXXXXXXXX"
                                            value={phone}
                                            onChange={(event) => setPhone(event.target.value)}
                                            leftIcon={<Phone className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                        />
                                    </div>
                                )}

                                <label
                                    className={cx(
                                        'flex cursor-pointer items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border p-[var(--lb-space-4)] transition-colors',
                                        paymentMethod === 'card'
                                            ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)]'
                                            : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] hover:bg-[var(--lb-color-surface-subdued)]',
                                    )}
                                >
                                    <input
                                        className="sr-only"
                                        type="radio"
                                        name="payment"
                                        value="card"
                                        checked={paymentMethod === 'card'}
                                        onChange={() => setPaymentMethod('card')}
                                    />
                                    <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-surface)] text-[var(--lb-color-primary)]">
                                        <CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                                            Credit or debit card
                                        </span>
                                        <span className="block text-[length:var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[color:var(--lb-color-text-subdued)]">
                                            Visa, Mastercard, Amex, and RuPay.
                                        </span>
                                    </span>
                                    {paymentMethod === 'card' && <Check className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-primary)]" aria-hidden="true" />}
                                </label>
                            </div>
                        </Section>
                    </Card>
                )}

                {!isFreePlan && (
                    <Card>
                        <Section title="Billing address" description="This address is used for taxes and subscription invoicing.">
                            <div className="grid gap-[var(--lb-space-3)]">
                                <Input
                                    id="billing-address"
                                    label="Address"
                                    type="text"
                                    placeholder="Street address"
                                    value={address}
                                    onChange={(event) => setAddress(event.target.value)}
                                />
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                    <Input
                                        id="pin-code"
                                        label="PIN code"
                                        type="text"
                                        placeholder="6-digit PIN"
                                        value={pinCode}
                                        onChange={(event) => setPinCode(event.target.value)}
                                        maxLength={6}
                                    />
                                    <Input
                                        id="city"
                                        label="City"
                                        type="text"
                                        placeholder="City"
                                        value={city}
                                        onChange={(event) => setCity(event.target.value)}
                                    />
                                </div>
                                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                                    <Select
                                        id="state"
                                        label="State"
                                        options={STATE_OPTIONS}
                                        value={state}
                                        onChange={(event) => setState(event.target.value)}
                                    />
                                    <Input id="country" label="Country" type="text" value="India" disabled />
                                </div>
                            </div>
                        </Section>
                    </Card>
                )}
            </div>

            <aside className="min-w-0 xl:sticky xl:top-[var(--lb-space-6)]" aria-label="Plan summary">
                <Card>
                    <Section
                        title="Plan summary"
                        description={`${billingPeriodLabel(billingPeriod)} billing for ${plan.name}.`}
                        action={<Badge label={plan.name} variant={isFreePlan ? 'info' : 'success'} />}
                    >
                        <div className="grid gap-[var(--lb-space-4)]">
                            <div className="rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                <div className="flex items-start justify-between gap-[var(--lb-space-3)]">
                                    <div className="min-w-0">
                                        <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                            Amount due
                                        </p>
                                        <p className="m-0 text-[length:var(--lb-font-size-heading)] font-[var(--lb-font-weight-bold)] leading-[var(--lb-line-height-heading)] text-[color:var(--lb-color-text)]">
                                            {formatCheckoutPrice(currentPrice)} INR
                                        </p>
                                    </div>
                                    <IndianRupee className="h-[var(--lb-size-icon)] w-[var(--lb-size-icon)] shrink-0 text-[var(--lb-color-primary)]" aria-hidden="true" />
                                </div>
                                <p className="m-[var(--lb-space-2)_0_0] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                    {isFreePlan ? 'No payment required' : 'Plus applicable taxes'}
                                    {hasPromo && billingPeriod === 'monthly' && ` · ${formatCheckoutPrice(promoPrice)} × ${plan.promo_months} mo`}
                                </p>
                            </div>

                            <div className="grid gap-[var(--lb-space-3)]">
                                {timeline.map((entry, index) => (
                                    <div key={`${entry.label}-${index}`} className="flex gap-[var(--lb-space-3)] border-b border-[var(--lb-color-border)] pb-[var(--lb-space-3)] last:border-b-0 last:pb-0">
                                        <span
                                            className={cx(
                                                'mt-[6px] h-[var(--lb-space-2)] w-[var(--lb-space-2)] shrink-0 rounded-[var(--lb-radius-full)]',
                                                entry.isActive ? 'bg-[var(--lb-color-primary)]' : 'bg-[var(--lb-color-border)]',
                                            )}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-[var(--lb-space-2)]">
                                                <span className="text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text)]">
                                                    {entry.label}
                                                </span>
                                                <span className="text-right text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text)]">
                                                    {entry.amount}
                                                </span>
                                            </div>
                                            <p className="m-[var(--lb-space-1)_0_0] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                {entry.date}
                                            </p>
                                            {entry.description && (
                                                <p className="m-[var(--lb-space-1)_0_0] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                                    {entry.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Button type="button" fullWidth size="lg" loading={isProcessing} onClick={handleSubscribe}>
                                <Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                {isFreePlan ? 'Activate Free plan' : `Subscribe · ${formatCheckoutPrice(currentPrice)}`}
                            </Button>

                            {error && (
                                <Banner variant="critical" title="Payment could not continue">
                                    <p className="m-0">{error}</p>
                                </Banner>
                            )}

                            <p className="m-0 text-center text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                {isFreePlan ? 'Upgrade whenever you need higher limits.' : 'Change or cancel your plan anytime.'}
                            </p>

                            {plan.gmv_percentage > 0 && (
                                <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                    <div className="mb-[var(--lb-space-2)] flex items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-small)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text)]">
                                        <ShieldCheck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[var(--lb-color-primary)]" aria-hidden="true" />
                                        Included benefits
                                    </div>
                                    <ul className="m-0 grid list-none gap-[var(--lb-space-2)] p-0 text-[length:var(--lb-font-size-small)] leading-[var(--lb-line-height-small)] text-[color:var(--lb-color-text-subdued)]">
                                        <li className="flex items-start gap-[var(--lb-space-2)]">
                                            <CheckCircle2 className="mt-[2px] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-success)]" aria-hidden="true" />
                                            Transaction fee: only {plan.gmv_percentage}% of GMV
                                        </li>
                                        <li className="flex items-start gap-[var(--lb-space-2)]">
                                            <CheckCircle2 className="mt-[2px] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-success)]" aria-hidden="true" />
                                            7-day free trial included
                                        </li>
                                    </ul>
                                </div>
                            )}

                            <div className="flex items-center justify-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                                <Lock className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                {isFreePlan ? 'LetBuyy billing' : 'Secured by Razorpay'}
                            </div>
                        </div>
                    </Section>
                </Card>
            </aside>
        </div>
    )
}
