'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

/* ——————————————————————————————————————
   Settings > Plan Page
   Shows current plan, subscription status, 
   and CTA to upgrade/change plan.
   —————————————————————————————————————— */

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
    features: Array<{ label: string; icon: string }>
}

export default function PlanSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [trialData, setTrialData] = useState({
        trial_status: '',
        trial_ends_at: '',
    })
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
    const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)
    const [cancelling, setCancelling] = useState(false)
    const [confirmCancel, setConfirmCancel] = useState(false)
    const [storeId, setStoreId] = useState('')
    const supabase = createClient()

    useEffect(() => {
        async function load() {
            // Get store data
            const { data: storeData } = await supabase
                .from('stores')
                .select('id, trial_status, trial_ends_at, site_type')
                .or(`store_name.eq.${store},subdomain.eq.${store}`)
                .single()

            if (storeData) {
                setStoreId(storeData.id)
                setTrialData({
                    trial_status: storeData.trial_status || 'active',
                    trial_ends_at: storeData.trial_ends_at || '',
                })

                // Get active subscription
                const { data: sub } = await supabase
                    .from('subscriptions')
                    .select('plan, status, billing_period, current_period_end, promo_ends_at, amount_paid')
                    .eq('store_id', storeData.id)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (sub) {
                    // Fetch plan details
                    const res = await fetch(`/api/plans?site_type=${storeData.site_type || 'store'}&slug=${sub.plan}`)
                    const { plans } = await res.json()
                    if (plans?.[0]) {
                        setPlanInfo(plans[0])
                        setSubscription({
                            ...sub,
                            plan_name: plans[0].name,
                        })
                    }
                }
            }
            setLoading(false)
        }
        load()
    }, [store, supabase])

    const trialEnds = trialData.trial_ends_at ? new Date(trialData.trial_ends_at) : null
    const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0
    const isTrialExpired = trialData.trial_status === 'expired' || (trialEnds && trialEnds < new Date())
    const hasSubscription = !!subscription

    if (loading) {
        return (
            <div className="settings-page">
                <div className="settings-page-header"><div className="settings-skeleton" style={{ width: 80, height: 28 }} /></div>
                <div className="settings-card"><div className="settings-skeleton" style={{ width: '100%', height: 120 }} /></div>
            </div>
        )
    }

    return (
        <div className="settings-page">
            <div className="settings-page-header">
                <h1>Plan</h1>
            </div>

            {/* Current plan card */}
            <div className="settings-card">
                <h2>Current plan</h2>
                <div className="plan-settings-current">
                    <div className="plan-settings-current-info">
                        <div className="plan-settings-plan-name">
                            {hasSubscription ? subscription.plan_name : 'Free Trial'}
                        </div>
                        <div className="plan-settings-plan-desc">
                            {hasSubscription ? (
                                <>
                                    {subscription.billing_period === 'yearly' ? 'Annual' : 'Monthly'} billing
                                    {planInfo && ` · ₹${(subscription.billing_period === 'yearly'
                                        ? planInfo.price_yearly_inr / 100
                                        : planInfo.price_monthly_inr / 100
                                    ).toLocaleString('en-IN')}/mo`}
                                </>
                            ) : (
                                <>
                                    {!isTrialExpired && trialEnds
                                        ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining in your trial`
                                        : isTrialExpired
                                            ? 'Your trial has expired'
                                            : 'Trial period'}
                                </>
                            )}
                        </div>
                    </div>
                    <span className={`settings-badge ${hasSubscription ? 'connected' : isTrialExpired ? 'pending' : 'connected'}`}>
                        {hasSubscription ? 'Active' : isTrialExpired ? 'Expired' : 'Trial'}
                    </span>
                </div>

                {/* Trial ends info */}
                {!hasSubscription && trialEnds && (
                    <div className="plan-settings-info-box">
                        <span className="material-symbols-outlined">{isTrialExpired ? 'warning' : 'schedule'}</span>
                        <span>
                            Trial {isTrialExpired ? 'ended' : 'ends'} on{' '}
                            <strong>{trialEnds.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                        </span>
                    </div>
                )}

                {/* Subscription renewal info */}
                {hasSubscription && subscription.current_period_end && (
                    <div className="plan-settings-info-box">
                        <span className="material-symbols-outlined">autorenew</span>
                        <span>
                            Renews on{' '}
                            <strong>
                                {new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </strong>
                        </span>
                    </div>
                )}

                {/* Promo period info */}
                {subscription?.promo_ends_at && (
                    <div className="plan-settings-info-box plan-settings-info-box--promo">
                        <span className="material-symbols-outlined">local_offer</span>
                        <span>
                            Promotional pricing active until{' '}
                            <strong>
                                {new Date(subscription.promo_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </strong>
                        </span>
                    </div>
                )}
            </div>

            {/* Plan features (if subscribed) */}
            {hasSubscription && planInfo && (
                <div className="settings-card">
                    <h2>Plan features</h2>
                    <ul className="plan-settings-features">
                        {planInfo.features.map((feature, i) => (
                            <li key={i} className="plan-settings-feature">
                                <span className="material-symbols-outlined">{feature.icon}</span>
                                <span>{feature.label}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Upgrade / Change plan */}
            <div className="settings-card">
                <h2>{hasSubscription ? 'Change your plan' : 'Upgrade your plan'}</h2>
                <p className="plan-settings-upgrade-desc">
                    {hasSubscription
                        ? 'Upgrade to unlock more features, or downgrade anytime.'
                        : 'Get access to advanced features, remove branding, and unlock premium support.'
                    }
                </p>
                <button
                    className="settings-btn-primary"
                    onClick={() => router.push(`/${store}/access_account/checkout/select-plan`)}
                >
                    {hasSubscription ? 'Change plan' : 'Compare plans'}
                </button>
            </div>

            {/* Cancel plan (if subscribed) */}
            {hasSubscription && (
                <div className="settings-card">
                    <h2>Cancel subscription</h2>
                    <p className="plan-settings-cancel-desc">
                        You can cancel your subscription anytime. Your current features will remain active until the end of the billing period.
                    </p>
                    {!confirmCancel ? (
                        <button className="settings-btn-danger" onClick={() => setConfirmCancel(true)}>Cancel plan</button>
                    ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                            <button
                                className="settings-btn-danger"
                                disabled={cancelling}
                                onClick={async () => {
                                    setCancelling(true)
                                    await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('store_id', storeId).eq('status', 'active')
                                    setSubscription(null)
                                    setCancelling(false)
                                    setConfirmCancel(false)
                                }}
                            >
                                {cancelling ? 'Cancelling...' : 'Yes, cancel my plan'}
                            </button>
                            <button className="settings-btn-secondary" onClick={() => setConfirmCancel(false)}>Never mind</button>
                        </div>
                    )}
                </div>
            )}

            {/* Quick link to billing */}
            <div className="plan-settings-links">
                <Link href={`/${store}/settings/billing`} className="plan-settings-link">
                    <span className="material-symbols-outlined">receipt_long</span>
                    View billing history
                    <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
            </div>
        </div>
    )
}
