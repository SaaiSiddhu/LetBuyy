'use client'

import Link from 'next/link'
import { AlertCircle, Check, Minus, Table } from '@letbuyy/ui'
import { getAccountsUrl } from '@/lib/public-urls'

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
        priceNote: 'Free-tier limits are being finalized',
        cta: 'Start free',
        href: getAccountsUrl('/signup'),
        highlights: ['Site builder access', 'LetBuyy subdomain', 'Basic launch checklist'],
    },
    {
        key: 'basic',
        name: 'Basic',
        audience: 'Solo merchants preparing a first launch',
        price: 'Pending',
        priceNote: 'Monthly and yearly pricing is being finalized',
        cta: 'Request pricing',
        href: 'mailto:sales@letbuyy.com?subject=LetBuyy%20Basic%20pricing',
        featured: true,
        highlights: ['Custom domain readiness', 'Core commerce tools', 'Email support'],
    },
    {
        key: 'pro',
        name: 'Pro',
        audience: 'Growing stores with repeat operations',
        price: 'Pending',
        priceNote: 'Plan packaging is being finalized',
        cta: 'Request pricing',
        href: 'mailto:sales@letbuyy.com?subject=LetBuyy%20Pro%20pricing',
        highlights: ['Advanced operations', 'Theme and app workflows', 'Priority support'],
    },
    {
        key: 'enterprise',
        name: 'Enterprise',
        audience: 'Teams needing contracts and governance',
        price: 'Custom',
        priceNote: 'Sales-led terms',
        cta: 'Contact sales',
        href: 'mailto:sales@letbuyy.com?subject=LetBuyy%20Enterprise%20pricing',
        highlights: ['Multi-store governance', 'Operational controls', 'SLA and onboarding'],
    },
]

const matrixRows: MatrixRow[] = [
    {
        feature: 'Site builder and themes',
        values: { free: true, basic: true, pro: true, enterprise: true },
    },
    {
        feature: 'Store, blog and landing-page sites',
        values: { free: true, basic: true, pro: true, enterprise: true },
    },
    {
        feature: 'Custom domain readiness',
        values: { free: 'Upgrade', basic: true, pro: true, enterprise: true },
    },
    {
        feature: 'Products and inventory',
        values: { free: 'Starter limits', basic: 'Launch limits', pro: 'Scale limits', enterprise: 'Custom' },
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
        values: { free: 'Community / email', basic: 'Email', pro: 'Priority', enterprise: 'SLA' },
    },
    {
        feature: 'Transaction or platform fees',
        values: { free: '0%', basic: '0%', pro: '0%', enterprise: '0%' },
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
                    <h2 className="section-title">Plan comparison with launch details</h2>
                    <p className="section-subtitle">
                        Free, Basic, Pro and Enterprise packaging is mapped below. Paid pricing, discounts and contract terms are being finalized; transaction and platform fees stay 0%.
                    </p>
                </div>

                <div className="pricing-approval">
                    <AlertCircle className="pricing-approval-icon" aria-hidden="true" />
                    <div>
                        <p className="pricing-approval-title">Paid plans being finalized</p>
                        <p className="pricing-approval-copy">
                            This grid shows the current launch packaging without inventing paid plan amounts or discounts.
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
                        <Table tableClassName="pricing-matrix-table">
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
                        </Table>
                    </div>
                </div>
            </div>
        </section>
    )
}
