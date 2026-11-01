'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    planAnnualSavingMinor,
    type SubscriptionPlanView,
} from '@/lib/billing/plan-ui'
import { Button, Input, MaterialIcon } from '@letbuyy/ui'
import { MerchantEmptyArtwork } from '@/components/empty-states/MerchantEmptyState'

interface SelectPlanClientProps {
    plans: SubscriptionPlanView[]
    currentPlan: string | null
    storeName: string
    storeSlug: string
    storeId: string
    siteType: string
    trialStatus: string | null
    trialEndsAt: string | null
    foundingAvailable?: boolean
    foundingRemaining?: number | null
}

function cx(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ')
}

function formatINR(paise: number): string {
    const rupees = paise / 100
    if (rupees >= 1000) {
        return `₹${(rupees / 1000).toFixed(rupees % 1000 === 0 ? 0 : 1)}k`
    }
    return `₹${rupees.toLocaleString('en-IN')}`
}

function formatINRFull(paise: number): string {
    return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`
}

export default function SelectPlanClient({
    plans,
    currentPlan,
    storeName,
    storeSlug,
    siteType,
    trialStatus,
    trialEndsAt,
    foundingAvailable = false,
    foundingRemaining = null,
}: SelectPlanClientProps) {
    const router = useRouter()
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
    const [showCompare, setShowCompare] = useState(false)
    const [onlyDiff, setOnlyDiff] = useState(false)
    const [renderTime] = useState(() => Date.now())
    const [renderDate] = useState(() => new Date())

    const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null
    const trialDateKnown = Boolean(trialEnd && Number.isFinite(trialEnd.getTime()))
    const trialDaysLeft = !currentPlan && trialStatus === 'active' && trialDateKnown
        ? Math.max(0, Math.ceil((trialEnd!.getTime() - renderTime) / (1000 * 60 * 60 * 24)))
        : 0
    const isTrialExpired = !currentPlan && (trialStatus === 'expired' || (trialStatus === 'active' && trialDateKnown && trialEnd! < renderDate))

    const handleSelectPlan = (planSlug: string) => {
        const plan = plans.find(p => p.slug === planSlug)
        if (!plan || plan.status === 'coming_soon' || plan.purchasable === false) {
            return
        }
        if (plan.requires_contact) {
            window.open('mailto:sales@letbuyy.com?subject=Enterprise Plan Inquiry', '_blank')
            return
        }
        router.push(`/${storeSlug}/access_account/checkout/checkout?plan=${planSlug}&bp=${billingPeriod.toUpperCase()}&site_type=${siteType}`)
    }

    const compareFeatures = plans.find(p => p.compare_features?.length > 0)?.compare_features || []
    const planSlugs = plans.map(p => p.slug)
    const compareColumnCount = Math.min(Math.max(plans.length, 1), 6)
    const compareRowClassName = `select-plan-compare-row select-plan-compare-row--${compareColumnCount}`

    return (
        <div className="select-plan-page">
            <section className="select-plan-hero">
                <div className="select-plan-breadcrumb" aria-label="Plan selection context">
                    <MaterialIcon name="storefront" size={16} />
                    <span>{storeName}</span>
                    <MaterialIcon name="chevron_right" size={14} className="select-plan-muted-icon" />
                    <span>Select a plan</span>
                </div>

                <h1 className="select-plan-title">
                    {currentPlan
                        ? 'Manage your plan'
                        : isTrialExpired
                        ? 'Your trial has ended - pick a plan to continue'
                        : trialDaysLeft > 0
                            ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in your trial - choose a plan`
                            : 'Everything you need to run your business'}
                </h1>

                <div className="select-plan-toggle" role="group" aria-label="Billing period">
                    {(['monthly', 'yearly'] as const).map(period => (
                        <Button unstyled
                            key={period}
                            type="button"
                            className={cx('select-plan-toggle-button', billingPeriod === period && 'is-active')}
                            onClick={() => setBillingPeriod(period)}
                            aria-pressed={billingPeriod === period}
                        >
                            {period === 'monthly' ? 'Monthly' : 'Annual'}
                        </Button>
                    ))}
                </div>
            </section>

            {plans.length > 0 ? (
                <section className={cx('select-plan-grid', plans.length <= 2 && 'select-plan-grid--compact')} aria-label="Available plans">
                    {plans.map(plan => {
                        const price = billingPeriod === 'monthly' ? plan.price_monthly_inr : plan.price_yearly_inr
                        const hasPromo = billingPeriod === 'monthly' && plan.promo_price_inr > 0 && plan.promo_months > 0
                        const isCurrent = currentPlan === plan.slug
                        const isPopular = plan.is_popular
                        const isFree = plan.price_monthly_inr === 0 && plan.price_yearly_inr === 0 && !plan.requires_contact
                        const isComingSoon = plan.status === 'coming_soon' || plan.purchasable === false
                        const showFounding = foundingAvailable
                            && billingPeriod === 'monthly'
                            && plan.founding_price_inr > 0
                            && plan.founding_price_inr < plan.price_monthly_inr
                            && !isComingSoon
                            && !plan.requires_contact

                        return (
                            <article
                                key={plan.id}
                                className={cx('select-plan-card', isPopular && 'select-plan-card--popular')}
                            >
                                {isPopular && <div className="select-plan-popular-badge">Most Popular</div>}

                                <div className="select-plan-card-heading">
                                    <h2>{plan.name}</h2>
                                    <p>{plan.tagline}</p>
                                </div>

                                <div className="select-plan-price-block">
                                    {showFounding ? (
                                        <span className="select-plan-promo-badge">
                                            🏆 Founding price{typeof foundingRemaining === 'number' ? ` · ${foundingRemaining} left` : ''}
                                        </span>
                                    ) : hasPromo ? (
                                        <span className="select-plan-promo-badge">
                                            First {plan.promo_months} months
                                        </span>
                                    ) : null}

                                    <div className="select-plan-price-row">
                                        {isComingSoon ? (
                                            <span className="select-plan-price select-plan-price--custom">Coming soon</span>
                                        ) : showFounding ? (
                                            <>
                                                <span className="select-plan-price">{formatINR(plan.founding_price_inr)}</span>
                                                <span className="select-plan-price-strike">{formatINR(price)}</span>
                                            </>
                                        ) : hasPromo ? (
                                            <>
                                                <span className="select-plan-price">{formatINR(plan.promo_price_inr)}</span>
                                                <span className="select-plan-price-strike">{formatINR(price)}</span>
                                            </>
                                        ) : plan.requires_contact ? (
                                            <span className="select-plan-price select-plan-price--custom">Custom</span>
                                        ) : (
                                            <span className="select-plan-price">{formatINR(price)}</span>
                                        )}
                                        {!plan.requires_contact && !isFree && !isComingSoon && (
                                            <span className="select-plan-price-period">/month</span>
                                        )}
                                    </div>
                                    {billingPeriod === 'yearly' && !isComingSoon && !plan.requires_contact
                                        && planAnnualSavingMinor(plan.price_monthly_inr, plan.price_yearly_inr) > 0 && (
                                        <span className="select-plan-saving">
                                            <MaterialIcon name="local_offer" size={14} />
                                            Save {formatINRFull(planAnnualSavingMinor(plan.price_monthly_inr, plan.price_yearly_inr))}/year
                                        </span>
                                    )}
                                </div>

                                <Button unstyled
                                    type="button"
                                    onClick={() => handleSelectPlan(plan.slug)}
                                    disabled={isCurrent || isComingSoon}
                                    className={cx(
                                        'select-plan-cta',
                                        isPopular && !isComingSoon && 'select-plan-cta--primary',
                                        plan.requires_contact && 'select-plan-cta--outline',
                                        (isCurrent || isComingSoon) && 'select-plan-cta--disabled',
                                    )}
                                >
                                    {isComingSoon ? 'Coming soon' : isCurrent ? 'Current plan' : plan.requires_contact ? 'Contact sales' : isFree ? 'Start free' : 'Choose plan'}
                                </Button>

                                <div className="select-plan-feature-list">
                                    <p className="select-plan-feature-eyebrow">What&apos;s included</p>
                                    <ul>
                                        {(plan.features || []).map((feature, index) => (
                                            <li key={index}>
                                                <MaterialIcon name={feature.icon} size={16} className="select-plan-feature-icon" />
                                                <span>{feature.label}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </article>
                        )
                    })}
                </section>
            ) : (
                <section className="select-plan-empty" aria-live="polite">
                    <div className="flex justify-center"><MerchantEmptyArtwork scene="plans" /></div>
                    <h2>No plans available</h2>
                    <p>Plan options are temporarily unavailable. Please try again later or contact support.</p>
                </section>
            )}

            {compareFeatures.length > 0 && (
                <section className="select-plan-compare-section">
                    <h2 className="select-plan-compare-title">Compare plans</h2>

                    <div className={cx('select-plan-compare-shell', showCompare ? 'is-expanded' : 'is-collapsed')}>
                        <div className="select-plan-compare-clip">
                            <div className="select-plan-compare" role="table" aria-label="Plan feature comparison">
                                <div className={cx(compareRowClassName, 'select-plan-compare-main-header')} role="row">
                                    <div className="select-plan-compare-feature-head" role="columnheader">
                                        <label className="select-plan-switch-label">
                                            <Input
                                                unstyled
                                                type="checkbox"
                                                className="select-plan-switch-input"
                                                checked={onlyDiff}
                                                onChange={(e) => setOnlyDiff(e.target.checked)}
                                            />
                                            <span className="select-plan-switch" aria-hidden="true">
                                                <span className="select-plan-switch-thumb" />
                                            </span>
                                            <span className="select-plan-switch-text">Only show differences</span>
                                        </label>
                                    </div>
                                    {plans.map(plan => (
                                        <div
                                            key={plan.slug}
                                            className={cx('select-plan-compare-plan-head', plan.is_popular && 'is-popular')}
                                            role="columnheader"
                                        >
                                            <span className="select-plan-compare-plan-name">{plan.name}</span>
                                            {plan.is_popular && (
                                                <span className="select-plan-compare-plan-badge">Most popular</span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {compareFeatures.map((category, categoryIndex) => {
                                    const items = category.items.filter((item) => {
                                        if (!onlyDiff) return true
                                        const values = planSlugs.map((slug) => JSON.stringify((item as unknown as Record<string, unknown>)[slug] ?? false))
                                        return new Set(values).size > 1
                                    })
                                    if (items.length === 0) return null
                                    return (
                                    <div key={categoryIndex} role="rowgroup">
                                        <div className="select-plan-compare-category">
                                            {category.category}
                                        </div>

                                        {items.map((item, itemIndex) => (
                                            <div key={itemIndex} className={compareRowClassName} role="row">
                                                <div className="select-plan-compare-feature" role="cell">
                                                    {item.description ? (
                                                        <details className="select-plan-compare-disclosure">
                                                            <summary className="select-plan-compare-summary">
                                                                <MaterialIcon name="expand_more" size={16} className="select-plan-compare-chevron" />
                                                                <span>{item.label}</span>
                                                            </summary>
                                                            <p className="select-plan-compare-description">{item.description}</p>
                                                        </details>
                                                    ) : (
                                                        <span className="select-plan-compare-feature-label">{item.label}</span>
                                                    )}
                                                </div>
                                                {planSlugs.map(slug => {
                                                    const value = (item as unknown as Record<string, unknown>)[slug] ?? false
                                                    return (
                                                        <div
                                                            key={slug}
                                                            className={cx('select-plan-compare-value', (value === false || value === '—') && 'is-muted')}
                                                            role="cell"
                                                        >
                                                            {value === true ? (
                                                                <MaterialIcon name="check" size={18} className="select-plan-compare-check" />
                                                            ) : value === false ? (
                                                                <span className="select-plan-compare-dash">—</span>
                                                            ) : (
                                                                <span>{String(value)}</span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                    )
                                })}
                            </div>
                        </div>

                        {!showCompare && <div className="select-plan-compare-fade" aria-hidden="true" />}

                        <div className="select-plan-compare-reveal">
                            <Button unstyled
                                type="button"
                                onClick={() => setShowCompare(!showCompare)}
                                className="select-plan-secondary-button"
                                aria-expanded={showCompare}
                            >
                                <MaterialIcon name={showCompare ? 'expand_less' : 'add'} size={18} />
                                {showCompare ? 'See fewer features' : 'See all features'}
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            <footer className="select-plan-footer">
                <p>
                    Need help choosing?{' '}
                    <a href="mailto:support@letbuyy.com">
                        Contact our team
                    </a>
                </p>
                <p>Review the amount due at checkout before subscribing. Choosing a plan does not restart your saved trial dates.</p>
            </footer>
        </div>
    )
}
