'use client'

interface TrustPill {
    label: string
    color: string
}

const TRUST_PILLS: TrustPill[] = [
    { label: '0% Commission Forever', color: 'rgb(20 184 166)' },
    { label: 'UPI Native',            color: 'rgb(59 130 246)' },
    { label: 'GST Ready',             color: 'rgb(16 185 129)' },
    { label: 'AI Powered',            color: 'rgb(167 139 250)' },
    { label: 'Built for Bharat',      color: 'rgb(245 158 11)' },
]

const COMMERCE_METRICS = [
    { value: '0%',       label: 'Commission Forever' },
    { value: '14-Day',   label: 'Free Trial' },
    { value: 'UPI+COD',  label: 'Payment Ready' },
    { value: 'Commerce', label: 'OS Platform' },
]

export function TrustPills() {
    return (
        <div className="hero-trust-strip" role="list" aria-label="Platform guarantees">
            {TRUST_PILLS.map(p => (
                <div key={p.label} className="hero-trust-pill" role="listitem">
                    <span className="hero-trust-pill-dot" style={{ background: p.color }} aria-hidden="true" />
                    {p.label}
                </div>
            ))}
        </div>
    )
}

export function CommerceMetrics() {
    return (
        <div className="hero-commerce-metrics" aria-label="Platform at a glance">
            {COMMERCE_METRICS.map(m => (
                <div key={m.label} className="hero-commerce-metric">
                    <strong>{m.value}</strong>
                    <span>{m.label}</span>
                </div>
            ))}
        </div>
    )
}
