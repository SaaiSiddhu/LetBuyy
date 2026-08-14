'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    ChevronRight,
    ConfirmDialog,
    Skeleton,
    useToast,
} from '@letbuyy/ui'
import { formatIndiaDate } from '@letbuyy/ui/formatting'
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
}

type PlanPayload = {
    data?: unknown
    error?: string | { message?: string }
}

type PlansPayload = {
    plans?: unknown
    error?: string | { message?: string }
}

function getPayloadError(payload: { error?: string | { message?: string } } | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readString(value: unknown, fallback = '') {
    return typeof value === 'string' ? value : fallback
}

function coerceCents(value: unknown) {
    const amount = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
    return Number.isFinite(amount) ? amount : 0
}

function normalizeStoreData(value: unknown) {
    if (!isRecord(value)) {
        return { trial_status: 'active', trial_ends_at: '', site_type: 'store' }
    }
    return {
        trial_status: readString(value.trial_status, 'active'),
        trial_ends_at: readString(value.trial_ends_at),
        site_type: readString(value.site_type, 'store'),
    }
}

function normalizeSubscription(value: unknown): SubscriptionData | null {
    if (!isRecord(value)) return null
    const plan = readString(value.plan, 'current')
    const planName = readString(value.plan_name, plan)
    const promoEndsAt = readString(value.promo_ends_at)
    return {
        plan,
        plan_name: planName,
        status: readString(value.status, 'active'),
        billing_period: readString(value.billing_period, 'monthly'),
        current_period_end: readString(value.current_period_end),
        promo_ends_at: promoEndsAt || null,
        amount_paid: coerceCents(value.amount_paid),
    }
}

function normalizePlanInfo(value: unknown): PlanInfo | null {
    if (!isRecord(value)) return null
    const slug = readString(value.slug)
    const name = readString(value.name, slug || 'Plan')
    return {
        name,
        slug,
        price_monthly_inr: coerceCents(value.price_monthly_inr),
        price_yearly_inr: coerceCents(value.price_yearly_inr),
    }
}

function formatMoney(amount: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount / 100)
}

function parseDate(value: string) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

function formatStatus(status: string) {
    return status.split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || 'Active'
}

function statusVariant(status: string): 'success' | 'critical' | 'warning' {
    if (status === 'active' || status === 'trialing') return 'success'
    if (status === 'expired' || status === 'canceled') return 'critical'
    return 'warning'
}

export default function PlanSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [trialData, setTrialData] = useState({ trial_status: '', trial_ends_at: '' })
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
    const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)
    const [cancelling, setCancelling] = useState(false)
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
    const [renderTime] = useState(() => Date.now())
    const [renderDate] = useState(() => new Date())

    const loadData = useCallback(async () => {
        setLoading(true)
        setLoadError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/plan`, { cache: 'no-store' })
            const payload = (await response.json().catch(() => null)) as PlanPayload | null
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to load plan settings'))

            const data = isRecord(payload?.data) ? payload.data : null
            const storeData = normalizeStoreData(data?.store)
            const sub = normalizeSubscription(data?.subscription)

            setTrialData({ trial_status: storeData.trial_status, trial_ends_at: storeData.trial_ends_at })

            if (!sub) {
                setSubscription(null)
                setPlanInfo(null)
                return
            }

            let nextPlanInfo: PlanInfo | null = null
            try {
                const planResponse = await fetch(`/api/plans?site_type=${encodeURIComponent(storeData.site_type)}&slug=${encodeURIComponent(sub.plan)}`)
                const plansPayload = (await planResponse.json().catch(() => null)) as PlansPayload | null
                const planData = Array.isArray(plansPayload?.plans) ? plansPayload.plans[0] : null
                if (planResponse.ok) nextPlanInfo = normalizePlanInfo(planData)
            } catch {
                nextPlanInfo = null
            }

            setPlanInfo(nextPlanInfo)
            setSubscription({ ...sub, plan_name: nextPlanInfo?.name || sub.plan_name })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load plan settings'
            setLoadError(message)
            notify({ title: 'Plan settings could not load', description: message, variant: 'critical' })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => { void loadData() }, [loadData])

    const trialEnds = parseDate(trialData.trial_ends_at)
    const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - renderTime) / (1000 * 60 * 60 * 24))) : 0
    const isTrialExpired = trialData.trial_status === 'expired' || Boolean(trialEnds && trialEnds < renderDate)
    const hasSubscription = Boolean(subscription)

    const currentPrice = useMemo(() => {
        if (!subscription) return 'Free trial'
        if (planInfo) {
            const price = subscription.billing_period === 'yearly' ? planInfo.price_yearly_inr : planInfo.price_monthly_inr
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
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to cancel plan'))
            setSubscription(null)
            setPlanInfo(null)
            setCancelDialogOpen(false)
            notify({ title: 'Plan cancelled', description: 'Your subscription remains available until the current billing period ends.', variant: 'success' })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to cancel plan'
            notify({ title: 'Could not cancel plan', description: message, variant: 'critical' })
        } finally {
            setCancelling(false)
        }
    }, [cancelling, notify, store])

    const trialDesc = !isTrialExpired && trialEnds
        ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining in your trial`
        : isTrialExpired
            ? 'Your trial has expired'
            : 'Trial period'

    if (loading) {
        return (
            <SettingsPane title="Plan" description="Your subscription and billing cycle." store={store}>
                <div className="settings-home-card">
                    <div className="settings-home-section-label">Plan details</div>
                    <div className="settings-plan-row">
                        <Skeleton variant="text" lines={1} />
                    </div>
                </div>
                <div className="settings-home-card">
                    <div className="settings-home-section-label">Subscriptions</div>
                    <div className="settings-plan-subs-desc">
                        <Skeleton variant="text" lines={1} />
                    </div>
                </div>
            </SettingsPane>
        )
    }

    const planLabel = hasSubscription ? subscription!.plan_name : 'Free Trial'
    const planBadgeVariant = hasSubscription ? statusVariant(subscription!.status) : isTrialExpired ? 'critical' : 'success'
    const planBadgeLabel = hasSubscription ? formatStatus(subscription!.status) : isTrialExpired ? 'Expired' : 'Trial'
    const planDesc = hasSubscription ? currentPrice : trialDesc

    return (
        <>
            <SettingsPane title="Plan" description="Your subscription and billing cycle." store={store}>
                {loadError && (
                    <Banner
                        variant="critical"
                        title="Plan settings could not load"
                        action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                    >
                        {loadError}
                    </Banner>
                )}

                <div className="settings-home-card">
                    <div className="settings-home-section-label">Plan details</div>
                    <div className="settings-plan-row">
                        <div className="settings-plan-info">
                            <div className="settings-plan-headline">
                                <span className="settings-plan-name">{planLabel}</span>
                                <Badge label={planBadgeLabel} variant={planBadgeVariant} />
                            </div>
                            <span className="settings-plan-price">{planDesc}</span>
                        </div>
                        <div className="settings-plan-actions">
                            {hasSubscription && (
                                <Button variant="ghost" loading={cancelling} onClick={() => setCancelDialogOpen(true)}>
                                    Cancel plan
                                </Button>
                            )}
                            <Button onClick={() => router.push(`/${store}/access_account/checkout/select-plan`)}>
                                {hasSubscription ? 'Change plan' : 'Choose plan'}
                            </Button>
                        </div>
                    </div>
                    <div className="settings-plan-tos">
                        View the{' '}
                        <a href="https://letbuyy.com/legal/terms" className="settings-plan-tos-link" target="_blank" rel="noopener noreferrer">
                            terms of service
                        </a>
                        {' '}and{' '}
                        <a href="https://letbuyy.com/legal/privacy" className="settings-plan-tos-link" target="_blank" rel="noopener noreferrer">
                            privacy policy
                        </a>
                    </div>
                </div>

                <div className="settings-home-card">
                    <div className="settings-home-section-label">Subscriptions</div>
                    <div className="settings-plan-subs-desc">
                        Additional items you&apos;re billed for on a recurring basis.
                    </div>
                    <Button
                        unstyled
                        type="button"
                        className="settings-home-row"
                        onClick={() => router.push(`/${store}/settings/billing`)}
                    >
                        <span>View billing history</span>
                        <ChevronRight className="settings-plan-subs-chevron" aria-hidden="true" />
                    </Button>
                </div>
            </SettingsPane>

            <ConfirmDialog
                open={cancelDialogOpen}
                title="Cancel subscription?"
                description="Your current plan features remain active until the end of the billing period, then the store will fall back to trial or inactive access."
                confirmLabel={cancelling ? 'Cancelling...' : 'Cancel plan'}
                cancelLabel="Keep plan"
                destructive
                onConfirm={() => void handleCancelPlan()}
                onClose={() => { if (!cancelling) setCancelDialogOpen(false) }}
            />
        </>
    )
}
