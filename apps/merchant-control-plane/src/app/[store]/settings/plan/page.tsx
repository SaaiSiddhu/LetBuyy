'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Calendar,
    Card,
    CheckCircle2,
    Clock,
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
import { SettingsPane } from '@/components/settings/SettingsPane'

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
    name: string
    slug: string
    price_monthly_inr: number
    price_yearly_inr: number
    features: Array<{ label: string; icon?: string }>
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

function coerceCents(value: unknown) {
    const amount = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
    return Number.isFinite(amount) ? amount : 0
}

function formatMoney(amount: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
    }).format(amount / 100)
}

function formatDate(value: string) {
    const date = parseDate(value)
    if (!date) return 'Not scheduled'

    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    })
}

function parseDate(value: string) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
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

            if (!sub) {
                setSubscription(null)
                setPlanInfo(null)
                return
            }

            let nextPlanInfo: PlanInfo | null = null

            try {
                const planResponse = await fetch(`/api/plans?site_type=${storeData?.site_type || 'store'}&slug=${sub.plan}`)
                const plansPayload = (await planResponse.json().catch(() => null)) as PlansPayload | null

                if (planResponse.ok && plansPayload?.plans?.[0]) {
                    const plan = plansPayload.plans[0]
                    nextPlanInfo = {
                        ...plan,
                        price_monthly_inr: coerceCents(plan.price_monthly_inr),
                        price_yearly_inr: coerceCents(plan.price_yearly_inr),
                        features: Array.isArray(plan.features) ? plan.features : [],
                    }
                }
            } catch {
                nextPlanInfo = null
            }

            setPlanInfo(nextPlanInfo)
            setSubscription({
                ...sub,
                amount_paid: coerceCents(sub.amount_paid),
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

    const trialEnds = parseDate(trialData.trial_ends_at)
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
                title="Plan"
                description="Review subscription status, trial timing, and plan features."
                store={store}
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
        <>
            <SettingsPane
                title="Plan"
                description="Review subscription status, trial timing, and plan features."
                store={store}
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
                guidance={{
                    title: 'Subscription control',
                    body: 'Use this pane to understand active entitlements, trial timing, and plan changes before reviewing invoices in Billing.',
                }}
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
                                    {planInfo?.features.map((feature) => (
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
                    title={hasSubscription ? 'Change your plan' : 'Upgrade your plan'}
                    description={hasSubscription
                        ? 'Move to a plan that matches your current catalog, order volume, and support needs.'
                        : 'Choose a paid plan to unlock advanced features, remove branding, and keep the store live after trial.'}
                    action={(
                        <Button onClick={() => router.push(`/${store}/access_account/checkout/select-plan`)}>
                            <Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            {hasSubscription ? 'Change plan' : 'Compare plans'}
                        </Button>
                    )}
                >
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                        <PlanMetric
                            icon={<Rocket className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Next action"
                            value={hasSubscription ? 'Review alternatives' : 'Pick a plan'}
                        />
                        <PlanMetric
                            icon={<Calendar className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Billing cadence"
                            value={hasSubscription ? formatStatus(subscription?.billing_period || 'monthly') : 'Select at checkout'}
                        />
                        <PlanMetric
                            icon={<Clock className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            label="Trial timing"
                            value={trialEnds ? formatDate(trialData.trial_ends_at) : 'Not scheduled'}
                        />
                    </div>
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
            </SettingsPane>

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
        </>
    )
}
