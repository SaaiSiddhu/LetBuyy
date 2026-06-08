'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SubscriptionPlanView } from '@/lib/billing/plan-ui'
import { Button, MaterialIcon } from '@letbuyy/ui'

interface SelectPlanClientProps {
    plans: SubscriptionPlanView[]
    currentPlan: string | null
    storeName: string
    storeSlug: string
    storeId: string
    siteType: string
    trialStatus: string | null
    trialEndsAt: string | null
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

export default function SelectPlanClient({
    plans,
    currentPlan,
    storeName,
    storeSlug,
    siteType,
    trialStatus,
    trialEndsAt,
}: SelectPlanClientProps) {
    const router = useRouter()
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
    const [showCompare, setShowCompare] = useState(false)
    const [renderTime] = useState(() => Date.now())
    const [renderDate] = useState(() => new Date())

    const trialDaysLeft = trialEndsAt
        ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - renderTime) / (1000 * 60 * 60 * 24)))
        : 0
    const isTrialExpired = trialStatus === 'expired' || (trialEndsAt && new Date(trialEndsAt) < renderDate)

    const handleSelectPlan = (planSlug: string) => {
        const plan = plans.find(p => p.slug === planSlug)
        if (plan?.requires_contact) {
            window.open('mailto:sales@letbuyy.store?subject=Enterprise Plan Inquiry', '_blank')
            return
        }
        router.push(`/${storeSlug}/settings/subscribe/checkout?plan=${planSlug}&bp=${billingPeriod.toUpperCase()}&site_type=${siteType}`)
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
                    {isTrialExpired
                        ? 'Your trial has ended - pick a plan to continue'
                        : trialDaysLeft > 0
                            ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in your trial - choose a plan`
                            : 'Everything you need to run your business'}
                </h1>

                <div className="select-plan-highlights" aria-label="Plan highlights">
                    {[
                        { icon: 'language', text: 'Custom domain' },
                        { icon: 'auto_awesome', text: 'AI built-in' },
                        { icon: 'monitoring', text: '24/7 monitoring' },
                        { icon: 'currency_rupee', text: 'Indian INR pricing' },
                    ].map((highlight, index) => (
                        <div key={index} className="select-plan-highlight">
                            <MaterialIcon name={highlight.icon} size={16} className="select-plan-primary-icon" />
                            <span>{highlight.text}</span>
                        </div>
                    ))}
                </div>

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
                            {period === 'yearly' && <span className="select-plan-save-badge">Save 20%</span>}
                        </Button>
                    ))}
                </div>
            </section>

            {plans.length > 0 ? (
                <section className={cx('select-plan-grid', plans.length <= 2 && 'select-plan-grid--compact')} aria-label="Available plans">
                    {plans.map(plan => {
                        const price = billingPeriod === 'monthly' ? plan.price_monthly_inr : plan.price_yearly_inr
                        const hasPromo = plan.promo_price_inr > 0 && plan.promo_months > 0
                        const isCurrent = currentPlan === plan.slug
                        const isPopular = plan.is_popular
                        const isFree = plan.price_monthly_inr === 0 && plan.price_yearly_inr === 0 && !plan.requires_contact

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
                                    {hasPromo && (
                                        <span className="select-plan-promo-badge">
                                            First {plan.promo_months} months
                                        </span>
                                    )}

                                    <div className="select-plan-price-row">
                                        {hasPromo ? (
                                            <>
                                                <span className="select-plan-price">{formatINR(plan.promo_price_inr)}</span>
                                                <span className="select-plan-price-strike">{formatINR(price)}</span>
                                            </>
                                        ) : plan.requires_contact ? (
                                            <span className="select-plan-price select-plan-price--custom">Custom</span>
                                        ) : (
                                            <span className="select-plan-price">{formatINR(price)}</span>
                                        )}
                                        {!plan.requires_contact && !isFree && (
                                            <span className="select-plan-price-period">/month</span>
                                        )}
                                    </div>
                                </div>

                                <Button unstyled
                                    type="button"
                                    onClick={() => handleSelectPlan(plan.slug)}
                                    disabled={isCurrent}
                                    className={cx(
                                        'select-plan-cta',
                                        isPopular && 'select-plan-cta--primary',
                                        plan.requires_contact && 'select-plan-cta--outline',
                                        isCurrent && 'select-plan-cta--disabled',
                                    )}
                                >
                                    {isCurrent ? 'Current plan' : plan.requires_contact ? 'Contact sales' : isFree ? 'Start free' : 'Start free trial'}
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
                    <MaterialIcon name="credit_card" size={48} className="select-plan-empty-icon" />
                    <h2>Plans are loading...</h2>
                    <p>The plans database has not been set up yet. Contact support if this persists.</p>
                </section>
            )}

            {compareFeatures.length > 0 && (
                <section className="select-plan-compare-section">
                    <div className="select-plan-compare-toggle">
                        <Button unstyled
                            type="button"
                            onClick={() => setShowCompare(!showCompare)}
                            className="select-plan-secondary-button"
                            aria-expanded={showCompare}
                        >
                            <MaterialIcon name={showCompare ? 'expand_less' : 'compare'} size={18} />
                            {showCompare ? 'Hide comparison' : 'Compare all features'}
                        </Button>
                    </div>

                    {showCompare && (
                        <div className="select-plan-compare" role="table" aria-label="Plan feature comparison">
                            <div className={cx(compareRowClassName, 'select-plan-compare-main-header')} role="row">
                                <div className="select-plan-compare-feature-head" role="columnheader">Feature</div>
                                {plans.map(plan => (
                                    <div
                                        key={plan.slug}
                                        className={cx('select-plan-compare-plan-head', plan.is_popular && 'is-popular')}
                                        role="columnheader"
                                    >
                                        {plan.name}
                                    </div>
                                ))}
                            </div>

                            {compareFeatures.map((category, categoryIndex) => (
                                <div key={categoryIndex} role="rowgroup">
                                    <div className="select-plan-compare-category">
                                        {category.category}
                                    </div>

                                    {category.items.map((item, itemIndex) => (
                                        <div key={itemIndex} className={compareRowClassName} role="row">
                                            <div className="select-plan-compare-feature" role="cell">
                                                {item.label}
                                                {item.description && (
                                                    <div className="select-plan-compare-description">
                                                        {item.description}
                                                    </div>
                                                )}
                                            </div>
                                            {planSlugs.map(slug => {
                                                const value = (item as unknown as Record<string, unknown>)[slug] ?? false
                                                return (
                                                    <div
                                                        key={slug}
                                                        className={cx('select-plan-compare-value', value === false && 'is-muted')}
                                                        role="cell"
                                                    >
                                                        {value === true ? (
                                                            <MaterialIcon name="check_circle" size={18} className="select-plan-success-icon" />
                                                        ) : value === false ? (
                                                            <MaterialIcon name="remove" size={18} className="select-plan-muted-icon" />
                                                        ) : (
                                                            <span>{String(value)}</span>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            <footer className="select-plan-footer">
                <p>
                    Need help choosing?{' '}
                    <a href="mailto:support@letbuyy.store">
                        Contact our team
                    </a>
                </p>
                <p>All plans include a 7-day free trial. Cancel anytime.</p>
            </footer>
        </div>
    )
}
