'use client'

import { useCopy } from '@/components/i18n/useCopy'

import Link from '@/components/i18n/LocaleLink'
import { useEffect, useState } from 'react'
import type { FoundingPlanPricing } from '@letbuyy/api-client'
import type { PublicPricingData } from '@/lib/pricing'
import { AlertCircle, Button, Check, ChevronUp, Input } from '@letbuyy/ui'
import MarketingIllustration from './MarketingIllustration'
import { getAccountsUrl } from '@/lib/public-urls'

// Plans are sourced from the DB via the API gateway (GET /pricing).
// Marketing site NEVER owns plan data — it is a presentation layer only.

interface CompareItem {
    label: string
    description?: string
    [slug: string]: string | boolean | undefined
}

interface CompareGroup {
    category: string
    items: CompareItem[]
}

type FoundingPlanView = FoundingPlanPricing & { compare_features?: CompareGroup[] }
type PricingData = PublicPricingData

function PlanCardSkeleton() {
    return (
        <div className="pricing-plan-card pricing-skel-card" aria-hidden="true">
            <div className="pricing-skel-line pricing-skel-name" />
            <div className="pricing-skel-line pricing-skel-audience" />
            <div className="pricing-skel-line pricing-skel-price" />
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="pricing-skel-line pricing-skel-feat" />
            ))}
            <div className="pricing-skel-line pricing-skel-cta" />
        </div>
    )
}

function CompareSection({ plans }: { plans: FoundingPlanView[] }) {
    const { t } = useCopy()
    const [showAll, setShowAll] = useState(false)
    const [onlyDiff, setOnlyDiff] = useState(false)

    const compareFeatures: CompareGroup[] =
        plans.find(p => Array.isArray(p.compare_features) && p.compare_features.length > 0)?.compare_features ?? []

    if (compareFeatures.length === 0) return null

    const planSlugs = plans.map(p => p.slug)
    const colCount = Math.min(Math.max(plans.length, 1), 6)
    const rowCls = `select-plan-compare-row select-plan-compare-row--${colCount}`

    return (
        <section className="select-plan-compare-section">
            <h2 className="select-plan-compare-title">{t("Compare all plans")}</h2>

            <div className={`select-plan-compare-shell ${showAll ? 'is-expanded' : 'is-collapsed'}`}>
                <div className="select-plan-compare-clip">
                    <div className="select-plan-compare" role="table" aria-label={t("Plan feature comparison")}>

                        {/* Sticky header row */}
                        <div className={`${rowCls} select-plan-compare-main-header`} role="row">
                            <div className="select-plan-compare-feature-head" role="columnheader">
                                <label className="select-plan-switch-label">
                                    <Input
                                        unstyled
                                        type="checkbox"
                                        className="select-plan-switch-input"
                                        checked={onlyDiff}
                                        onChange={e => setOnlyDiff(e.target.checked)}
                                    />
                                    <span className="select-plan-switch" aria-hidden="true">
                                        <span className="select-plan-switch-thumb" />
                                    </span>
                                    <span className="select-plan-switch-text">{t("Only differences")}</span>
                                </label>
                            </div>
                            {plans.map(plan => (
                                <div
                                    key={plan.slug}
                                    className={`select-plan-compare-plan-head${plan.is_popular ? ' is-popular' : ''}`}
                                    role="columnheader"
                                >
                                    <span className="select-plan-compare-plan-name">{t((plan.name) ?? '')}</span>
                                    {plan.is_popular && (
                                        <span className="select-plan-compare-plan-badge">{t("Most popular")}</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Feature categories + rows */}
                        {compareFeatures.map((group, gi) => {
                            const items = group.items.filter(item => {
                                if (!onlyDiff) return true
                                const vals = planSlugs.map(slug => JSON.stringify(item[slug] ?? false))
                                return new Set(vals).size > 1
                            })
                            if (items.length === 0) return null
                            return (
                                <div key={gi} role="rowgroup">
                                    <div className="select-plan-compare-category">{t((group.category) ?? '')}</div>
                                    {items.map((item, ii) => (
                                        <div key={ii} className={rowCls} role="row">
                                            <div className="select-plan-compare-feature" role="cell">
                                                <span
                                                    className="select-plan-compare-feature-label"
                                                    title={item.description ? t(item.description) : undefined}
                                                >
                                                    {t((item.label) ?? '')}
                                                </span>
                                            </div>
                                            {planSlugs.map(slug => {
                                                const val = item[slug] ?? false
                                                return (
                                                    <div
                                                        key={slug}
                                                        className={`select-plan-compare-value${val === false || val === '—' ? ' is-muted' : ''}`}
                                                        role="cell"
                                                    >
                                                        {val === true ? (
                                                            <Check size={16} className="select-plan-compare-check select-plan-success-icon" />
                                                        ) : val === false ? (
                                                            <span className="select-plan-compare-dash">—</span>
                                                        ) : (
                                                            <span>{t((String(val)) ?? '')}</span>
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

                {!showAll && <div className="select-plan-compare-fade" aria-hidden="true" />}

                <div className="select-plan-compare-reveal">
                    <Button
                        unstyled
                        type="button"
                        onClick={() => setShowAll(v => !v)}
                        className="select-plan-secondary-button"
                        aria-expanded={showAll}
                    >
                        {showAll
                            ? <><ChevronUp size={16} /> {t("See fewer features")}</>
                            : <>{t("+ See all features")}</>
                        }
                    </Button>
                </div>
            </div>
        </section>
    )
}

export default function Pricing({ initialData = null, headingLevel = 2 }: { initialData?: PublicPricingData | null; headingLevel?: 1 | 2 }) {
    const { t } = useCopy()
    const [state, setState] = useState<'loading' | 'ready' | 'error'>(initialData ? 'ready' : 'error')
    const [data, setData] = useState<PricingData | null>(initialData)

    const [retry, setRetry] = useState(0)
    useEffect(() => {
        if (retry === 0) return
        const controller = new AbortController()
        fetch('/api/founding-pricing', { cache: 'no-store', signal: controller.signal })
            .then(r => r.ok ? r.json() : Promise.reject(new Error('failed')))
            .then((j: { data: PricingData }) => {
                if (!controller.signal.aborted) { setData(j.data); setState('ready') }
            })
            .catch(() => { if (!controller.signal.aborted) setState('error') })
        return () => controller.abort()
    }, [retry])
    const Heading = headingLevel === 1 ? 'h1' : 'h2'
    const PlanHeading = headingLevel === 1 ? 'h2' : 'h3'

    const plans = (data?.pricing?.plans ?? []).slice().sort((a, b) => a.display_order - b.display_order)
    const program = data?.remaining ?? data?.pricing.founding_program
    const remaining = program?.remaining_slots ?? 0
    const total = program?.total_slots ?? 0
    const programActive = Boolean(program?.active) && !program?.paused && remaining > 0 && total >= remaining

    return (
        <section id="pricing" className="pricing pricing-comparison">
            <div className="container">
                <div className="pricing-header">
                    <p className="section-label">{t("Pricing")}</p>
                    <Heading className="section-title">{t("Simple, transparent pricing")}</Heading>
                    <p className="section-subtitle">
                        {t("Compare available plans below. Subscription and provider charges may apply. LetBuyy charges 0% commission on your sales.")}</p>
                    <MarketingIllustration artwork="essentials" className="marketing-illustration--pricing" priority={headingLevel === 1} />
                </div>

                {state === 'error' ? (
                    <div className="pricing-unavailable">
                        <AlertCircle size={32} className="pricing-unavailable-icon" aria-hidden="true" />
                        <p className="pricing-unavailable-msg" role="status">{t("Pricing is temporarily unavailable.")}</p>
                        <Button unstyled type="button" className="btn btn-outline" onClick={() => { setState('loading'); setRetry(value => value + 1) }}>{t("Try again")}</Button>
                        <Link href={getAccountsUrl('/signup')} className="btn btn-primary">
                            {t("Review signup terms")}</Link>
                    </div>
                ) : state === 'loading' ? (
                    <div className="pricing-plan-grid" aria-busy="true" aria-label={t("Loading plans")}>
                        {[1, 2, 3, 4].map(i => <PlanCardSkeleton key={i} />)}
                    </div>
                ) : (
                    <>
                        {programActive && (
                            <div className="pricing-approval">
                                <AlertCircle className="pricing-approval-icon" aria-hidden="true" />
                                <div>
                                    <p className="pricing-approval-title">
                                        {t("🏆 Founding Merchant Program —")}{' '}{remaining} / {total} {t("slots remaining")}</p>
                                    <p className="pricing-approval-copy">
                                        {t("Lock the founding price for life. Lifetime price lock, founding badge, priority access, and early features.")}</p>
                                </div>
                            </div>
                        )}

                        {plans.length === 0 ? (
                            <div className="pricing-unavailable">
                                <p className="pricing-unavailable-msg">{t("Plans are being finalized. Sign up to get early access.")}</p>
                                <Link href={getAccountsUrl('/signup')} className="btn btn-primary">
                                    {t("Review signup terms")}</Link>
                            </div>
                        ) : (
                            <>
                                <div className="pricing-plan-grid">
                                    {plans.map((plan) => {
                                        const comingSoon = plan.status === 'coming_soon' || !plan.purchasable
                                        const showFounding = programActive && plan.has_founding && !comingSoon
                                        const price = showFounding ? plan.founding_inr : plan.regular_inr

                                        return (
                                            <article
                                                key={plan.slug}
                                                className={`pricing-plan-card${
                                                    comingSoon
                                                        ? ' pricing-plan-card--coming-soon'
                                                        : plan.is_popular
                                                            ? ' pricing-plan-card-featured'
                                                            : ''
                                                }`}
                                            >
                                                {/* Section 1 — header strip (always rendered for subgrid row alignment) */}
                                                <div className={`pricing-plan-card-header${
                                                    comingSoon ? ' pricing-plan-card-header--soon'
                                                    : plan.is_popular ? ' pricing-plan-card-header--popular'
                                                    : ' pricing-plan-card-header--empty'
                                                }`}>
                                                    {t((comingSoon ? "Coming soon" : plan.is_popular ? "Most popular" : null) ?? '')}
                                                </div>

                                                {/* Section 2 — plan name + tagline */}
                                                <div className="pricing-plan-name-section">
                                                    <PlanHeading className="pricing-plan-name">{t((plan.name) ?? '')}</PlanHeading>
                                                    {plan.tagline && (
                                                        <p className="pricing-plan-audience">{t((plan.tagline) ?? '')}</p>
                                                    )}
                                                </div>

                                                {/* Section 3 — price */}
                                                <div className="pricing-plan-price-section">
                                                    {comingSoon ? (
                                                        <p className="pricing-plan-price pricing-plan-price--soon">{t("Coming soon")}</p>
                                                    ) : (
                                                        <>
                                                            <p className="pricing-plan-price">
                                                                ₹{price.toLocaleString('en-IN')}
                                                                <span className="pricing-plan-price-period">{t("/month")}</span>
                                                            </p>
                                                            {showFounding && (
                                                                <p className="pricing-plan-note">
                                                                    {t("Regular ₹")}{plan.regular_inr.toLocaleString('en-IN')} {t("· Save ₹")}{plan.savings_inr.toLocaleString('en-IN')}{t("/mo for life")}</p>
                                                            )}
                                                        </>
                                                    )}
                                                </div>

                                                {/* Section 4 — CTA */}
                                                <div className="pricing-plan-cta-section">
                                                    {comingSoon ? (
                                                        <span
                                                            className="btn pricing-plan-cta btn-outline pricing-plan-cta--soon"
                                                            aria-disabled="true"
                                                        >
                                                            {t("Coming soon")}</span>
                                                    ) : (
                                                        <Link
                                                            href={getAccountsUrl('/signup')}
                                                            className={`btn pricing-plan-cta ${plan.is_popular ? 'btn-primary' : 'btn-outline'}`}
                                                        >
                                                            {t("Review signup terms")}</Link>
                                                    )}
                                                </div>

                                                {/* Section 5 — features */}
                                                <ul className="pricing-plan-highlights">
                                                    {plan.features.slice(0, 6).map((feature, idx) => (
                                                        <li key={idx} className="pricing-plan-highlight">
                                                            <Check className="pricing-plan-check" aria-hidden="true" />
                                                            {t((typeof feature === "string" ? feature : String(feature)) ?? '')}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </article>
                                        )
                                    })}
                                </div>

                                <CompareSection plans={plans} />
                            </>
                        )}
                    </>
                )}
            </div>
        </section>
    )
}
