'use client'

import { MaterialIcon } from '@letbuyy/ui'

/* ——————————————————————————————————————
   Plan Card Component
   Displays a single plan with pricing, 
   features, and CTA button.
   —————————————————————————————————————— */

interface PlanFeature {
    label: string
    icon: string
}

interface Plan {
    id: string
    slug: string
    name: string
    tagline: string
    is_popular: boolean
    price_monthly_inr: number
    price_yearly_inr: number
    gmv_percentage: number
    promo_price_inr: number
    promo_months: number
    promo_label: string | null
    features: PlanFeature[]
    requires_contact: boolean
}

interface PlanCardProps {
    plan: Plan
    billingPeriod: 'monthly' | 'yearly'
    isCurrentPlan?: boolean
    onSelect: (planSlug: string) => void
}

export default function PlanCard({ plan, billingPeriod, isCurrentPlan, onSelect }: PlanCardProps) {
    const monthlyPrice = plan.price_monthly_inr / 100
    const yearlyPrice = plan.price_yearly_inr / 100
    const promoPrice = plan.promo_price_inr / 100
    const hasPromo = plan.promo_price_inr > 0 && plan.promo_months > 0

    const displayPrice = billingPeriod === 'yearly' ? yearlyPrice : monthlyPrice
    const showPromo = hasPromo && billingPeriod === 'monthly'

    // Calculate yearly savings
    const yearlySavings = billingPeriod === 'yearly'
        ? Math.round((monthlyPrice - yearlyPrice) * 12)
        : 0

    return (
        <div className={`plan-card ${plan.is_popular ? 'plan-card--popular' : ''} ${isCurrentPlan ? 'plan-card--current' : ''}`}>
            {/* Popular badge */}
            {plan.is_popular && (
                <div className="plan-card__badge">Most Popular</div>
            )}

            {/* Current plan badge */}
            {isCurrentPlan && (
                <div className="plan-card__badge plan-card__badge--current">Current Plan</div>
            )}

            {/* Header */}
            <div className="plan-card__header">
                <h3 className="plan-card__name">{plan.name}</h3>
                <p className="plan-card__tagline">{plan.tagline}</p>
            </div>

            {/* Pricing */}
            <div className="plan-card__pricing">
                {showPromo ? (
                    <>
                        <div className="plan-card__price-row">
                            <span className="plan-card__price-strike">₹{monthlyPrice.toLocaleString('en-IN')}</span>
                            <span className="plan-card__price">₹{promoPrice.toLocaleString('en-IN')}</span>
                            <span className="plan-card__price-period">/month</span>
                        </div>
                        <p className="plan-card__promo-label">{plan.promo_label}</p>
                    </>
                ) : (
                    <div className="plan-card__price-row">
                        <span className="plan-card__price">₹{displayPrice.toLocaleString('en-IN')}</span>
                        <span className="plan-card__price-period">/month</span>
                    </div>
                )}

                {billingPeriod === 'yearly' && yearlySavings > 0 && (
                    <p className="plan-card__savings">Save ₹{yearlySavings.toLocaleString('en-IN')}/year</p>
                )}

                {plan.gmv_percentage > 0 && (
                    <p className="plan-card__gmv">+ {plan.gmv_percentage}% transaction fee</p>
                )}
            </div>

            {/* CTA */}
            <button
                className={`plan-card__cta ${plan.is_popular ? 'plan-card__cta--primary' : ''}`}
                onClick={() => onSelect(plan.slug)}
                disabled={isCurrentPlan}
            >
                {isCurrentPlan
                    ? 'Current Plan'
                    : plan.requires_contact
                        ? 'Contact Sales'
                        : `Select ${plan.name}`
                }
            </button>

            {/* Features */}
            <ul className="plan-card__features">
                {(plan.features as PlanFeature[]).map((feature, i) => (
                    <li key={i} className="plan-card__feature">
                        <MaterialIcon name={feature.icon} className="plan-card__feature-icon" />
                        <span>{feature.label}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
