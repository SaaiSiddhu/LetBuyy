'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    CheckCircle2,
    ConfirmDialog,
    CreditCard,
    EmptyState,
    IndianRupee,
    ListChecks,
    Rocket,
    Section,
    Skeleton,
    Tag,
    Trash2,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings'

interface SubscriptionData {
    plan: string
    plan_name: string
    status: string
    billing_period: string
    current_period_end: string
    promo_ends_at: string | null
    amount_paid: number
}

interface PlanInfo {
    id?: string
    name: string
    slug: string
    tagline?: string
    is_popular?: boolean
    price_monthly_inr: number
    price_yearly_inr: number
    gmv_percentage?: number
    promo_price_inr?: number
    promo_months?: number
    requires_contact?: boolean
    features?: Array<{ label: string; icon?: string }>
}

type PlanPayload = {
    data?: {
        store?: {
            trial_status?: string
            trial_ends_at?: string
            site_type?: string
        }
        subscription?: Omit<SubscriptionData, 'plan_name'> & { plan_name?: string }
    }
    error?: string | { message?: string }
}

type PlansPayload = {
    plans?: PlanInfo[]
    error?: string | { message?: string }
}

function getPayloadError(payload: { error?: string | { message?: string } } | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

function formatMoney(amount: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
    }).format(amount / 100)
}

function formatDate(value: string) {
    if (!value) return 'Not scheduled'
    return new Date(value).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    })
}

function formatStatus(status: string) {
    return status
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') || 'Active'
}

function statusVariant(status: string) {
    if (status === 'active' || status === 'trialing') return 'success'
    if (status === 'expired' || status === 'canceled') return 'critical'
    return 'warning'
}

interface PlanMetricProps {
    icon: ReactNode
    label: string
    value: string
}

function PlanMetric({ icon, label, value }: PlanMetricProps) {
    return (
        <div className="flex min-w-0 items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                {icon}
            </span>
            <span className="min-w-0 space-y-[var(--lb-space-1)]">
                <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {label}
                </span>
                <span className="block truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                    {value}
                </span>
            </span>
        </div>
    )
}

function formatPlanCatalogPrice(plan: PlanInfo, period: 'monthly' | 'yearly') {
    if (plan.requires_contact) return 'Custom'

    const amount = period === 'yearly' ? plan.price_yearly_inr : plan.price_monthly_inr
    if (amount <= 0) return 'Free'

    return formatMoney(amount)
}

interface PlanComparisonCardProps {
    plan: PlanInfo
    isCurrent: boolean
    onSelect: (plan: PlanInfo) => void
}

function PlanComparisonCard({ plan, isCurrent, onSelect }: PlanComparisonCardProps) {
    const featurePreview = (plan.features || []).slice(0, 4)
    const hasPromo = (plan.promo_price_inr || 0) > 0 && (plan.promo_months || 0) > 0

    return (
        <article
            className={[
                'flex h-full min-w-0 flex-col gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border p-[var(--lb-space-4)]',
                isCurrent
                    ? 'border-[var(--lb-color-primary)] bg-[var(--lb-color-primary-soft)]'
                    : 'border-[var(--lb-color-border)] bg-[var(--lb-color-surface)]',
            ].join(' ')}
            aria-current={isCurrent ? 'true' : undefined}
        >
            <div className="flex min-w-0 items-start justify-between gap-[var(--lb-space-3)]">
                <div className="min-w-0 space-y-[var(--lb-space-1)]">
                    <h3 className="m-0 truncate text-[var(--lb-font-size-section-title)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-section-title)] text-[var(--lb-color-text)]">
                        {plan.name}
                    </h3>
                    {plan.tagline && (
                        <p className="m-0 text-[var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[var(--lb-color-text-subdued)]">
                            {plan.tagline}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-[var(--lb-space-1)]">
                    {isCurrent && <Badge label="Current" variant="success" />}
                    {!isCurrent && plan.is_popular && <Badge label="Popular" variant="info" />}
                </div>
            </div>

            <div className="grid gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)]">
                <div className="flex items-baseline justify-between gap-[var(--lb-space-2)]">
                    <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] uppercase leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Monthly
                    </span>
                    <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                        {hasPromo ? formatMoney(plan.promo_price_inr || 0) : formatPlanCatalogPrice(plan, 'monthly')}
                    </span>
                </div>
                <div className="flex items-baseline justify-between gap-[var(--lb-space-2)]">
                    <span className="text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] uppercase leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        Annual
                    </span>
                    <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                        {formatPlanCatalogPrice(plan, 'yearly')}
                    </span>
                </div>
                {hasPromo && (
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-success)]">
                        Promo pricing for first {plan.promo_months} month{plan.promo_months === 1 ? '' : 's'}.
                    </p>
                )}
                {(plan.gmv_percentage || 0) > 0 && (
                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                        + {plan.gmv_percentage}% transaction fee.
                    </p>
                )}
            </div>

            <ul className="m-0 flex flex-1 list-none flex-col gap-[var(--lb-space-2)] p-0">
                {featurePreview.length > 0 ? featurePreview.map((feature) => (
                    <li key={feature.label} className="flex items-start gap-[var(--lb-space-2)] text-[var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[var(--lb-color-text)]">
                        <CheckCircle2 className="mt-[2px] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-success)]" aria-hidden="true" />
                        <span>{feature.label}</span>
                    </li>
                )) : (
                    <li className="text-[var(--lb-font-size-secondary)] leading-[var(--lb-line-height-secondary)] text-[var(--lb-color-text-subdued)]">
                        Feature list unavailable.
                    </li>
                )}
            </ul>

            <Button
                variant={isCurrent ? 'secondary' : 'primary'}
                disabled={isCurrent}
                onClick={() => onSelect(plan)}
            >
                <Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                {isCurrent ? 'Current plan' : plan.requires_contact ? 'Contact sales' : 'Choose plan'}
            </Button>
        </article>
    )
}

export default function PlanSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [trialData, setTrialData] = useState({
        trial_status: '',
        trial_ends_at: '',
    })
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
    const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)
    const [availablePlans, setAvailablePlans] = useState<PlanInfo[]>([])
    const [cancelling, setCancelling] = useState(false)
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
    const [renderTime] = useState(() => Date.now())
    const [renderDate] = useState(() => new Date())

    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/plan`, {
                cache: 'no-store',
            })
            const payload = (await response.json().catch(() => null)) as PlanPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to load plan settings'))
            }

            const storeData = payload?.data?.store
            const sub = payload?.data?.subscription

            setTrialData({
                trial_status: storeData?.trial_status || 'active',
                trial_ends_at: storeData?.trial_ends_at || '',
            })

            let nextAvailablePlans: PlanInfo[] = []
            let nextPlanInfo: PlanInfo | null = null

            try {
                const planResponse = await fetch(`/api/plans?site_type=${storeData?.site_type || 'store'}`)
                const plansPayload = (await planResponse.json().catch(() => null)) as PlansPayload | null

                if (planResponse.ok && Array.isArray(plansPayload?.plans)) {
                    nextAvailablePlans = plansPayload.plans
                    nextPlanInfo = sub ? nextAvailablePlans.find((plan) => plan.slug === sub.plan) || null : null
                }
            } catch {
                nextAvailablePlans = []
                nextPlanInfo = null
            }

            setAvailablePlans(nextAvailablePlans)
            setPlanInfo(nextPlanInfo)

            if (!sub) {
                setSubscription(null)
                return
            }

            setSubscription({
                ...sub,
                plan_name: nextPlanInfo?.name || sub.plan_name || sub.plan,
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load plan settings'
            setLoadError(message)
            notify({
                title: 'Plan settings could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadData()
    }, [loadData])

    const trialEnds = trialData.trial_ends_at ? new Date(trialData.trial_ends_at) : null
    const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - renderTime) / (1000 * 60 * 60 * 24))) : 0
    const isTrialExpired = trialData.trial_status === 'expired' || Boolean(trialEnds && trialEnds < renderDate)
    const hasSubscription = Boolean(subscription)
    const featureCount = planInfo?.features?.length || 0

    const currentPrice = useMemo(() => {
        if (!subscription) return 'Free trial'
        if (planInfo) {
            const price = subscription.billing_period === 'yearly'
                ? planInfo.price_yearly_inr
                : planInfo.price_monthly_inr
            return `${formatMoney(price)} ${subscription.billing_period === 'yearly' ? 'annually' : 'monthly'}`
        }

        return subscription.amount_paid > 0 ? `${formatMoney(subscription.amount_paid)} paid` : 'Configured plan'
    }, [planInfo, subscription])

    const handleSelectPlan = useCallback((plan: PlanInfo) => {
        if (plan.requires_contact) {
            window.open('mailto:sales@letbuyy.com?subject=Enterprise Plan Inquiry', '_blank', 'noopener,noreferrer')
            return
        }

        router.push(`/${store}/access_account/checkout/select-plan`)
    }, [router, store])

    const handleCancelPlan = useCallback(async () => {
        if (cancelling) return
        setCancelling(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/plan/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: 'merchant_requested' }),
            })
            const payload = (await response.json().catch(() => null)) as PlanPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to cancel plan'))
            }

            setSubscription(null)
            setPlanInfo(null)
            setCancelDialogOpen(false)
            notify({
                title: 'Plan cancelled',
                description: 'Your subscription remains available until the current billing period ends.',
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to cancel plan'
            notify({
                title: 'Could not cancel plan',
                description: message,
                variant: 'critical',
            })
        } finally {
            setCancelling(false)
        }
    }, [cancelling, notify, store])

    if (loading) {
        return (
            <SettingsPane
                store={store}
                title="Plan"
                description="Review subscription status, trial timing, and plan features."
            >
                <Card>
                    <Section title="Current plan">
                        <Skeleton variant="card" />
                    </Section>
                </Card>
                <Card>
                    <Section title="Plan features">
                        <Skeleton lines={5} />
                    </Section>
                </Card>
            </SettingsPane>
        )
    }

    return (
        <SettingsPane
            store={store}
            title="Plan"
            description="Review subscription status, trial timing, and plan features."
            primaryAction={{
                label: hasSubscription ? 'Change plan' : 'Compare plans',
                onClick: () => router.push(`/${store}/access_account/checkout/select-plan`),
                icon: <Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
            }}
            secondaryActions={[{
                label: 'Billing history',
                onClick: () => router.push(`/${store}/settings/billing`),
                icon: <CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
            }]}
        >
            {loadError && (
                <Banner
                    variant="critical"
                    title="Plan settings could not load"
                    action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Current plan"
                    description={hasSubscription
                        ? 'Your plan controls billing cadence and active merchant features.'
                        : 'Your trial keeps the store open while you choose the right paid plan.'}
                >
                    <div className="flex flex-col gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 space-y-[var(--lb-space-2)]">
                            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                    {hasSubscription ? subscription?.plan_name : 'Free Trial'}
                                </h3>
                                <Badge
                                    label={hasSubscription
                                        ? formatStatus(subscription?.status || 'active')
                                        : isTrialExpired ? 'Expired' : 'Trial'}
                                    variant={hasSubscription
                                        ? statusVariant(subscription?.status || 'active')
                                        : isTrialExpired ? 'critical' : 'success'}
                                />
                            </div>
                            <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                {hasSubscription
                                    ? currentPrice
                                    : !isTrialExpired && trialEnds
                                        ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining in your trial`
                                        : isTrialExpired
                                            ? 'Your trial has expired'
                                            : 'Trial period'}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Button variant="secondary" onClick={() => router.push(`/${store}/settings/billing`)}>
                                <CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Billing
                            </Button>
                            <Button onClick={() => router.push(`/${store}/access_account/checkout/select-plan`)}>
                                <Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                {hasSubscription ? 'Change plan' : 'Compare plans'}
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                        <PlanMetric
                            icon={<Tag className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Plan"
                            value={hasSubscription ? subscription?.plan_name || 'Active plan' : 'Free trial'}
                        />
                        <PlanMetric
                            icon={<IndianRupee className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Price"
                            value={currentPrice}
                        />
                        <PlanMetric
                            icon={<ListChecks className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Included features"
                            value={hasSubscription ? `${featureCount} feature${featureCount === 1 ? '' : 's'}` : 'Trial access'}
                        />
                    </div>

                    {!hasSubscription && trialEnds && (
                        <Banner
                            variant={isTrialExpired ? 'critical' : 'info'}
                            title={isTrialExpired ? 'Trial ended' : 'Trial active'}
                        >
                            Trial {isTrialExpired ? 'ended' : 'ends'} on <strong>{formatDate(trialData.trial_ends_at)}</strong>.
                        </Banner>
                    )}

                    {hasSubscription && subscription?.current_period_end && (
                        <Banner variant="info" title="Renewal schedule">
                            Your plan renews on <strong>{formatDate(subscription.current_period_end)}</strong>.
                        </Banner>
                    )}

                    {subscription?.promo_ends_at && (
                        <Banner variant="success" title="Promotional pricing active">
                            Promotional pricing remains active until <strong>{formatDate(subscription.promo_ends_at)}</strong>.
                        </Banner>
                    )}
                </Section>
            </Card>

            {hasSubscription && (
                <Card>
                    <Section
                        title="Plan features"
                        description="Use this as a quick checklist of the capabilities included in the active plan."
                    >
                        {featureCount > 0 ? (
                            <ul className="m-0 grid list-none gap-[var(--lb-space-3)] p-0 md:grid-cols-2">
                                {planInfo?.features?.map((feature) => (
                                    <li
                                        key={feature.label}
                                        className="flex items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]"
                                    >
                                        <CheckCircle2 className="mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] shrink-0 text-[var(--lb-color-success)]" aria-hidden="true" />
                                        <span className="text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                            {feature.label}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState
                                icon={<ListChecks className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                title="Plan features are not available"
                                body="The active subscription is loaded, but the plan catalog did not return a feature list."
                                primaryAction={<Button onClick={() => router.push(`/${store}/access_account/checkout/select-plan`)}>Compare plans</Button>}
                            />
                        )}
                    </Section>
                </Card>
            )}

            <Card>
                <Section
                    title="Compare plans"
                    description="Review available plans and switch when your catalog, order volume, or support needs change."
                    action={(
                        <Button onClick={() => router.push(`/${store}/access_account/checkout/select-plan`)}>
                            <Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Open plan selector
                        </Button>
                    )}
                >
                    {availablePlans.length > 0 ? (
                        <div className="grid gap-[var(--lb-space-4)] lg:grid-cols-3">
                            {availablePlans.map((plan) => (
                                <PlanComparisonCard
                                    key={plan.id || plan.slug}
                                    plan={plan}
                                    isCurrent={Boolean(subscription?.plan && subscription.plan === plan.slug)}
                                    onSelect={handleSelectPlan}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={<Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="Plan catalog is not available"
                            body="Current subscription data loaded, but the plan catalog did not return comparison details."
                            primaryAction={<Button onClick={() => router.push(`/${store}/access_account/checkout/select-plan`)}>Open plan selector</Button>}
                        />
                    )}
                </Section>
            </Card>

            {hasSubscription && (
                <Card>
                    <Section
                        title="Cancel subscription"
                        description="Cancellation keeps current features active until the billing period ends."
                        action={(
                            <Button
                                variant="destructive"
                                loading={cancelling}
                                onClick={() => setCancelDialogOpen(true)}
                            >
                                <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Cancel plan
                            </Button>
                        )}
                    >
                        <Banner variant="warning" title="Cancellation affects store access">
                            Review billing history and export anything you need before cancelling. You can choose another plan at any time.
                        </Banner>
                    </Section>
                </Card>
            )}

            {!hasSubscription && (
                <Card>
                    <Section title="Billing history" description="Invoices and payment methods live under Billing once a plan is active.">
                        <EmptyState
                            icon={<CreditCard className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No paid billing history yet"
                            body="Plan charges and invoices will appear after you subscribe."
                            primaryAction={<Button onClick={() => router.push(`/${store}/settings/billing`)}>Open billing</Button>}
                            secondaryAction={<Button variant="secondary" onClick={() => router.push(`/${store}/access_account/checkout/select-plan`)}>Compare plans</Button>}
                        />
                    </Section>
                </Card>
            )}

            <ConfirmDialog
                open={cancelDialogOpen}
                title="Cancel subscription?"
                description="Your current plan features remain active until the end of the billing period, then the store will fall back to trial or inactive access."
                confirmLabel={cancelling ? 'Cancelling...' : 'Cancel plan'}
                cancelLabel="Keep plan"
                destructive
                onConfirm={() => void handleCancelPlan()}
                onClose={() => {
                    if (!cancelling) setCancelDialogOpen(false)
                }}
            />
        </SettingsPane>
    )
}
