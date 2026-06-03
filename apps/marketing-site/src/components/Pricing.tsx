'use client'

import Link from 'next/link'
import { AlertCircle, Check, Minus } from '@letbuyy/ui'

type PlanKey = 'free' | 'basic' | 'pro' | 'enterprise'

interface PricingPlan {
    key: PlanKey
    name: string
    audience: string
    price: string
    priceNote: string
    cta: string
    href: string
    featured?: boolean
    highlights: string[]
}

interface MatrixRow {
    feature: string
    values: Record<PlanKey, string | boolean>
}

const plans: PricingPlan[] = [
    {
        key: 'free',
        name: 'Free',
        audience: 'Validate a new store or personal site',
        price: '₹0',
        priceNote: 'Final free-tier limits need approval',
        cta: 'Start free',
        href: 'https://accounts.letbuyy.com/signup',
        highlights: ['Site builder access', 'LetBuyy subdomain', 'Basic launch checklist'],
    },
    {
        key: 'basic',
        name: 'Basic',
        audience: 'Solo merchants preparing a first launch',
        price: 'Pending',
        priceNote: 'Requires human-approved monthly and yearly pricing',
        cta: 'Request pricing',
        href: 'mailto:sales@letbuyy.store?subject=LetBuyy%20Basic%20pricing',
        featured: true,
        highlights: ['Custom domain readiness', 'Core commerce tools', 'Email support policy pending'],
    },
    {
        key: 'pro',
        name: 'Pro',
        audience: 'Growing stores with repeat operations',
        price: 'Pending',
        priceNote: 'Requires human-approved plan packaging',
        cta: 'Request pricing',
        href: 'mailto:sales@letbuyy.store?subject=LetBuyy%20Pro%20pricing',
        highlights: ['Advanced operations', 'Theme and app workflows', 'Priority support policy pending'],
    },
    {
        key: 'enterprise',
        name: 'Enterprise',
        audience: 'Teams needing contracts and governance',
        price: 'Custom',
        priceNote: 'Requires sales-approved terms',
        cta: 'Contact sales',
        href: 'mailto:sales@letbuyy.store?subject=LetBuyy%20Enterprise%20pricing',
        highlights: ['Multi-store governance', 'Operational controls', 'SLA and onboarding terms pending'],
    },
]

const matrixRows: MatrixRow[] = [
    {
        feature: 'Site builder and themes',
        values: { free: true, basic: true, pro: true, enterprise: true },
    },
    {
        feature: 'Store, portfolio, resume and blog sites',
        values: { free: true, basic: true, pro: true, enterprise: true },
    },
    {
        feature: 'Custom domain readiness',
        values: { free: 'Upgrade', basic: true, pro: true, enterprise: true },
    },
    {
        feature: 'Products and inventory',
        values: { free: 'Starter limits', basic: 'Approved limit pending', pro: 'Higher limit pending', enterprise: 'Custom' },
    },
    {
        feature: 'COD, GST and payment setup guidance',
        values: { free: true, basic: true, pro: true, enterprise: true },
    },
    {
        feature: 'Analytics and operations dashboards',
        values: { free: 'Basic', basic: 'Standard', pro: 'Advanced', enterprise: 'Custom reports' },
    },
    {
        feature: 'Support',
        values: { free: 'Community / email policy pending', basic: 'Email policy pending', pro: 'Priority policy pending', enterprise: 'SLA pending' },
    },
    {
        feature: 'Transaction or platform fees',
        values: { free: 'Needs approval', basic: 'Needs approval', pro: 'Needs approval', enterprise: 'Contracted' },
    },
]

function MatrixValue({ value }: { value: string | boolean }) {
    if (value === true) {
        return (
            <span className="pricing-matrix-included">
                <Check width={18} height={18} aria-label="Included" />
            </span>
        )
    }

    if (value === false) {
        return (
            <span className="pricing-matrix-empty">
                <Minus width={18} height={18} aria-label="Not included" />
            </span>
        )
    }

    return <span className="pricing-matrix-text">{value}</span>
}

export default function Pricing() {
    return (
        <section id="pricing" className="pricing pricing-comparison bg-[var(--bg-deep)]">
            <div className="container">
                <div className="pricing-header">
                    <p className="section-label">Pricing</p>
                    <h2 className="section-title">Plan comparison without invented prices</h2>
                    <p className="section-subtitle">
                        Free, Basic, Pro and Enterprise packaging is mapped below. Exact paid pricing, discounts, transaction fees and contractual terms stay pending human approval.
                    </p>
                </div>

                <div className="pricing-approval">
                    <AlertCircle className="pricing-approval-icon" aria-hidden="true" />
                    <div>
                        <p className="pricing-approval-title">Pricing approval required</p>
                        <p className="pricing-approval-copy">
                            This grid is ready for the approved commercial numbers. Paid plan amounts and fee policies are intentionally not fabricated.
                        </p>
                    </div>
                </div>

                <div className="pricing-plan-grid">
                    {plans.map((plan) => (
                        <article
                            key={plan.key}
                            className={`pricing-plan-card ${plan.featured ? 'pricing-plan-card-featured' : ''}`}
                        >
                            {plan.featured && (
                                <span className="pricing-plan-badge">
                                    Common starting point
                                </span>
                            )}
                            <h3 className="pricing-plan-name">{plan.name}</h3>
                            <p className="pricing-plan-audience">{plan.audience}</p>
                            <div className="pricing-plan-price-group">
                                <p className="pricing-plan-price">{plan.price}</p>
                                <p className="pricing-plan-note">{plan.priceNote}</p>
                            </div>
                            <ul className="pricing-plan-highlights">
                                {plan.highlights.map((highlight) => (
                                    <li key={highlight} className="pricing-plan-highlight">
                                        <Check className="pricing-plan-check" aria-hidden="true" />
                                        {highlight}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href={plan.href}
                                className={`btn pricing-plan-cta ${plan.featured ? 'btn-primary' : 'btn-outline'}`}
                            >
                                {plan.cta}
                            </Link>
                        </article>
                    ))}
                </div>

                <div className="pricing-matrix-card">
                    <div className="pricing-matrix-header">
                        <h3>Feature matrix</h3>
                        <p>
                            Use this as the approval-ready matrix for the final pricing decision.
                        </p>
                    </div>
                    <div className="pricing-matrix-scroll">
                        <table className="pricing-matrix-table">
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    {plans.map((plan) => (
                                        <th key={plan.key}>
                                            {plan.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {matrixRows.map((row) => (
                                    <tr key={row.feature}>
                                        <th>{row.feature}</th>
                                        {plans.map((plan) => (
                                            <td key={plan.key}>
                                                <MatrixValue value={row.values[plan.key]} />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    )
}
