'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SubscriptionPlanView } from '@/lib/billing/plan-ui'
import { SettingsPane } from '@/components/settings/SettingsPane'
import {
    Badge,
    Banner,
    Button,
    Card,
    CheckCircle2,
    CreditCard,
    IndianRupee,
    Input,
    Lock,
    Section,
    Select,
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
        '#2563eb'
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

interface PaymentMethodOptionProps {
    value: 'upi' | 'card'
    selected: boolean
    title: string
    description: string
    onSelect: () => void
}

function PaymentMethodOption({ value, selected, title, description, onSelect }: PaymentMethodOptionProps) {
    return (
        <label
            className={cx(
                'flex cursor-pointer items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border p-[var(--lb-space-4)] transition-colors duration-[var(--lb-motion-fast)]',
                selected
                    ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)]'
                    : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] hover:bg-[var(--lb-color-surface-subdued)]',
            )}
        >
            <input
                type="radio"
                name="payment-method"
                value={value}
                checked={selected}
                onChange={onSelect}
                className="mt-[var(--lb-space-1)] h-[var(--lb-space-4)] w-[var(--lb-space-4)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
            />
            <span className="min-w-0">
                <span className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                    {title}
                </span>
                <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {description}
                </span>
            </span>
        </label>
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

    const monthlyCents = coerceNumber(plan.price_monthly_inr)
    const yearlyCents = coerceNumber(plan.price_yearly_inr)
    const promoCents = coerceNumber(plan.promo_price_inr)
    const promoMonths = Math.max(0, Math.floor(coerceNumber(plan.promo_months)))
    const monthlyPrice = monthlyCents / 100
    const yearlyPrice = yearlyCents / 100
    const promoPrice = promoCents / 100
    const hasPromo = promoCents > 0 && promoMonths > 0
    const isFreePlan = monthlyCents === 0 && yearlyCents === 0 && !plan.requires_contact
    const currentPrice = billingPeriod === 'yearly' ? yearlyPrice : hasPromo ? promoPrice : monthlyPrice
    const yearlySavings = Math.max(0, Math.round((monthlyPrice - yearlyPrice) * 12))

    const timeline = useMemo(() => {
        const today = new Date()
        const entries: Array<{ date: string; label: string; amount: string; isActive?: boolean; description?: string }> = []

        entries.push({
            date: 'Today',
            label: 'Start your plan',
            amount: billingPeriod === 'yearly'
                ? `${formatRupees(yearlyPrice * 12)}/year`
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
                amount: `${formatRupees(yearlyPrice * 12)}/year`,
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
    }, [billingPeriod, hasPromo, monthlyPrice, promoMonths, promoPrice, yearlyPrice])

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

            const orderPayload = await orderRes.json().catch(() => null)
            if (!orderRes.ok) throw new Error(paymentErrorMessage(orderPayload, 'Failed to create order'))

            const orderData = normalizeOrderData(orderPayload)

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
                        const verifyData = await verifyRes.json().catch(() => null)
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
        <SettingsPane
            store={storeSlug}
            title="Subscribe checkout"
            description={`Activate the ${plan.name} plan for ${storeName}.`}
            guidance={{
                title: isFreePlan ? 'No payment required' : 'Subscription billing uses Razorpay',
                body: isFreePlan
                    ? 'The Free plan activates immediately and can be upgraded later.'
                    : 'Payment orders are still created and verified by the existing subscription API routes.',
                variant: isFreePlan ? 'success' : 'info',
            }}
        >
            <div className="grid gap-[var(--lb-space-5)] xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="flex min-w-0 flex-col gap-[var(--lb-space-5)]">
                    {!isFreePlan && (
                        <Card>
                            <Section
                                title="Billing cadence"
                                description="Choose the cadence that matches how you want to pay for this plan."
                                action={yearlySavings > 0 ? <Badge label={`Save ${formatRupees(yearlySavings)}`} variant="success" /> : undefined}
                            >
                                <div className="grid gap-[var(--lb-space-3)] sm:grid-cols-2">
                                    {(['monthly', 'yearly'] as const).map((period) => (
                                        <label
                                            key={period}
                                            className={cx(
                                                'flex cursor-pointer items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border p-[var(--lb-space-4)] transition-colors duration-[var(--lb-motion-fast)]',
                                                billingPeriod === period
                                                    ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)]'
                                                    : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] hover:bg-[var(--lb-color-surface-subdued)]',
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="billing-period"
                                                checked={billingPeriod === period}
                                                onChange={() => setBillingPeriod(period)}
                                                className="mt-[var(--lb-space-1)] h-[var(--lb-space-4)] w-[var(--lb-space-4)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                            />
                                            <span>
                                                <span className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] capitalize leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                    {period}
                                                </span>
                                                <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                    {period === 'yearly'
                                                        ? `${formatRupees(yearlyPrice * 12)} per year`
                                                        : hasPromo
                                                            ? `${formatRupees(promoPrice)} promo, then ${formatRupees(monthlyPrice)}`
                                                            : `${formatRupees(monthlyPrice)} per month`}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </Section>
                        </Card>
                    )}

                    <Card>
                        <Section
                            title={isFreePlan ? 'Activation' : 'Payment method'}
                            description={isFreePlan ? 'No payment method is required for the Free plan.' : 'Select the payment method Razorpay should prefill when checkout opens.'}
                        >
                            {isFreePlan ? (
                                <Banner variant="success" title="Free plan activation">
                                    Continue to activate this plan immediately for the current store.
                                </Banner>
                            ) : (
                                <div className="grid gap-[var(--lb-space-3)]">
                                    <PaymentMethodOption
                                        value="upi"
                                        selected={paymentMethod === 'upi'}
                                        title="UPI"
                                        description="Google Pay, PhonePe, BHIM, and other UPI apps."
                                        onSelect={() => setPaymentMethod('upi')}
                                    />
                                    {paymentMethod === 'upi' && (
                                        <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                            <Input
                                                label="UPI ID"
                                                value={upiId}
                                                onChange={(event) => setUpiId(event.target.value)}
                                                placeholder="yourname@upi"
                                                helperText="Optional. Used only as a Razorpay checkout prefill."
                                            />
                                            <Input
                                                label="Phone number"
                                                type="tel"
                                                value={phone}
                                                onChange={(event) => setPhone(event.target.value)}
                                                placeholder="+91 XXXXXXXXXX"
                                            />
                                        </div>
                                    )}
                                    <PaymentMethodOption
                                        value="card"
                                        selected={paymentMethod === 'card'}
                                        title="Credit or debit card"
                                        description="Visa, Mastercard, Amex, and RuPay cards."
                                        onSelect={() => setPaymentMethod('card')}
                                    />
                                </div>
                            )}
                        </Section>
                    </Card>

                    {!isFreePlan && (
                        <Card>
                            <Section
                                title="Billing address"
                                description="The existing subscription flow uses this information for payment and tax context."
                            >
                                <Input
                                    label="Address"
                                    value={address}
                                    onChange={(event) => setAddress(event.target.value)}
                                    placeholder="Street address"
                                    autoComplete="street-address"
                                />
                                <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                    <Input
                                        label="PIN code"
                                        value={pinCode}
                                        onChange={(event) => setPinCode(event.target.value)}
                                        placeholder="6-digit PIN"
                                        maxLength={6}
                                        autoComplete="postal-code"
                                    />
                                    <Input
                                        label="City"
                                        value={city}
                                        onChange={(event) => setCity(event.target.value)}
                                        placeholder="City"
                                        autoComplete="address-level2"
                                    />
                                </div>
                                <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                    <Select
                                        label="State"
                                        value={state}
                                        onChange={(event) => setState(event.target.value)}
                                        options={stateOptions}
                                    />
                                    <Input label="Country" value="India" disabled />
                                </div>
                            </Section>
                        </Card>
                    )}
                </div>

                <aside className="min-w-0" aria-label="Plan summary">
                    <Card>
                        <Section
                            title={`${plan.name} plan`}
                            description={billingPeriod === 'yearly' ? 'Annual subscription' : 'Monthly subscription'}
                            action={<Badge label={isFreePlan ? 'Free' : 'Razorpay'} variant={isFreePlan ? 'success' : 'info'} />}
                        >
                            <div className="flex items-baseline justify-between gap-[var(--lb-space-3)]">
                                <span className="text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                    Amount due
                                </span>
                                <span className="text-[var(--lb-font-size-display)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-display)] text-[var(--lb-color-text)]">
                                    {formatRupees(currentPrice)}
                                </span>
                            </div>

                            <div className="grid gap-[var(--lb-space-3)]">
                                {timeline.map((entry, index) => (
                                    <div key={`${entry.label}-${index}`} className="flex gap-[var(--lb-space-3)]">
                                        <span className={cx(
                                            'mt-[var(--lb-space-1)] flex h-[var(--lb-space-5)] w-[var(--lb-space-5)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] border',
                                            entry.isActive
                                                ? 'border-[var(--lb-color-success)] bg-[var(--lb-color-success-soft)] text-[var(--lb-color-success)]'
                                                : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] text-[var(--lb-color-text-subdued)]',
                                        )}>
                                            <CheckCircle2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap justify-between gap-[var(--lb-space-2)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                <span>{entry.label}</span>
                                                <span>{entry.amount}</span>
                                            </span>
                                            <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {entry.date}
                                            </span>
                                            {entry.description && (
                                                <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                    {entry.description}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {plan.gmv_percentage > 0 && (
                                <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                    <div className="mb-[var(--lb-space-2)] flex items-center gap-[var(--lb-space-2)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                        <Tag className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        Included benefits
                                    </div>
                                    <ul className="m-0 grid list-none gap-[var(--lb-space-2)] p-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                        <li>Transaction fee: {plan.gmv_percentage}% of GMV</li>
                                        <li>7-day free trial included</li>
                                    </ul>
                                </div>
                            )}

                            {error && (
                                <Banner variant="critical" title="Subscription checkout needs attention">
                                    {error}
                                </Banner>
                            )}

                            <Button type="button" onClick={handleSubscribe} loading={isProcessing} fullWidth>
                                {isFreePlan ? (
                                    <>
                                        <CheckCircle2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        Activate Free plan
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        Subscribe - {formatRupees(currentPrice)}
                                    </>
                                )}
                            </Button>

                            <p className="m-0 flex items-center gap-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                {isFreePlan ? <IndianRupee className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" /> : <Lock className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                {isFreePlan ? 'LetBuyy billing' : 'Secured by Razorpay'}
                            </p>
                        </Section>
                    </Card>
                </aside>
            </div>
        </SettingsPane>
    )
}
