'use client'

import { useCopy } from '@/components/i18n/useCopy'

import Copy from '@/components/i18n/Copy'

interface TrustPill {
    label: string
}

const TRUST_PILLS: TrustPill[] = [
    { label: '0% Commission Forever' },
    { label: 'Provider payments' },
    { label: 'Tax configuration' },
    { label: 'AI Powered' },
    { label: 'Built for Bharat' },
]

const COMMERCE_METRICS = [
    { value: '0%',       label: 'Commission Forever' },
    { value: '14-Day',   label: 'Free Trial' },
    { value: 'UPI+COD',  label: 'Requires setup' },
    { value: 'Commerce', label: 'OS Platform' },
]

export function TrustPills() {
    const { t } = useCopy()
    return (
        <div className="hero-trust-strip" role="list" aria-label={t("Platform overview")}>
            {TRUST_PILLS.map(p => (
                <div key={p.label} className="hero-trust-pill" role="listitem">
                    <span className="hero-trust-pill-dot" aria-hidden="true" />
                    <Copy text={p.label} />
                </div>
            ))}
        </div>
    )
}

export function CommerceMetrics() {
    const { t } = useCopy()
    return (
        <div className="hero-commerce-metrics" aria-label={t("Platform at a glance")}>
            {COMMERCE_METRICS.map(m => (
                <div key={m.label} className="hero-commerce-metric">
                    <strong><Copy text={m.value} /></strong>
                    <span><Copy text={m.label} /></span>
                </div>
            ))}
        </div>
    )
}
