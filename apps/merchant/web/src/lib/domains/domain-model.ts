// Domain Center — single source of truth for domain normalization + health.
// The UI MUST consume these helpers and never re-derive status/score independently.
// Every value maps to real gateway data (DoH DNS + Vercel TLS); nothing is invented.

import type {
    CustomDomainHealth,
    SiteDomainRecord,
    SiteDomainRole,
    SiteDomainStatus,
} from '@letbuyy/api-client'

export type DomainStatus = SiteDomainStatus
export type DomainRole = SiteDomainRole
export type SslState = 'active' | 'pending' | 'error' | 'unavailable' | 'unknown'

// ── Status ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<DomainStatus, string> = {
    none: 'Not connected',
    pending: 'Needs DNS setup',
    review: 'Under review',
    verifying: 'Verifying',
    active: 'Connected',
    error: 'Action required',
}

export function normalizeStatus(value: unknown): DomainStatus {
    return value === 'pending' || value === 'review' || value === 'verifying' || value === 'active' || value === 'error'
        ? value
        : 'none'
}

export function statusLabel(status: DomainStatus): string {
    return STATUS_LABEL[status] ?? 'Not connected'
}

export function statusVariant(status: DomainStatus): 'success' | 'warning' | 'critical' | 'info' {
    if (status === 'active') return 'success'
    if (status === 'error') return 'critical'
    if (status === 'pending' || status === 'verifying' || status === 'review') return 'warning'
    return 'info'
}

// ── SSL ──────────────────────────────────────────────────────────────────────

export function normalizeSsl(value: unknown): SslState {
    return value === 'active' || value === 'pending' || value === 'error' || value === 'unavailable'
        ? value
        : 'unknown'
}

export function sslLabel(ssl: SslState): string {
    switch (ssl) {
        case 'active': return 'SSL active'
        case 'pending': return 'SSL provisioning'
        case 'error': return 'SSL failed'
        case 'unavailable': return 'SSL not connected'
        default: return 'SSL unknown'
    }
}

export function sslVariant(ssl: SslState): 'success' | 'warning' | 'critical' | 'info' {
    if (ssl === 'active') return 'success'
    if (ssl === 'error') return 'critical'
    if (ssl === 'pending') return 'warning'
    return 'info'
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function normalizeProvider(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : 'Unknown provider'
}

// ── Health score (THE single calculator) ─────────────────────────────────────

export interface DomainHealthScoreInput {
    /** TXT ownership challenge passed. */
    verificationState: 'verified' | 'pending' | 'failed'
    /** CNAME points at the LetBuyy target. */
    dnsVerified: boolean
    /** Vercel has attached the host (configured_by present, not misconfigured). */
    hostAttached: boolean
    /** TLS certificate state. */
    sslStatus: SslState
    /** DNS visibility across resolvers. */
    propagationState: 'propagated' | 'pending' | 'unknown'
}

/**
 * 0–100 confidence that the storefront will serve on this domain over HTTPS.
 * Weighting: ownership 25 · DNS 25 · host attach 20 · SSL 25 · propagation 5.
 */
export function calculateDomainHealthScore(input: DomainHealthScoreInput): number {
    let score = 0
    if (input.verificationState === 'verified') score += 25
    else if (input.verificationState === 'pending') score += 8

    if (input.dnsVerified) score += 25

    if (input.hostAttached) score += 20

    if (input.sslStatus === 'active') score += 25
    else if (input.sslStatus === 'pending') score += 10

    if (input.propagationState === 'propagated') score += 5
    else if (input.propagationState === 'pending') score += 2

    return Math.max(0, Math.min(100, Math.round(score)))
}

export function healthScoreBand(score: number): { label: string; variant: 'success' | 'warning' | 'critical' } {
    if (score >= 90) return { label: 'Healthy', variant: 'success' }
    if (score >= 50) return { label: 'Needs attention', variant: 'warning' }
    return { label: 'Not working yet', variant: 'critical' }
}

// ── Derivations from real backend payloads ───────────────────────────────────

function propagationFromHealth(health: CustomDomainHealth): 'propagated' | 'pending' | 'unknown' {
    const cname = health.records.find((r) => r.type === 'CNAME')
    if (!cname) return 'unknown'
    if (cname.status === 'verified') return 'propagated'
    if (cname.status === 'mismatch') return 'pending'
    return 'unknown'
}

/** Health score from a live CustomDomainHealth payload (Domain Detail). */
export function scoreFromHealth(health: CustomDomainHealth): number {
    return calculateDomainHealthScore({
        verificationState: health.txt_verified ? 'verified' : 'pending',
        dnsVerified: health.cname_verified,
        hostAttached: Boolean(health.configured_by) && !health.misconfigured,
        sslStatus: health.ssl_active
            ? 'active'
            : health.provider_status === 'unavailable'
                ? 'unavailable'
                : health.misconfigured
                    ? 'error'
                    : 'pending',
        propagationState: propagationFromHealth(health),
    })
}

/** Approximate health score from a list record (Overview) — coarser, no live DoH detail. */
export function scoreFromRecord(record: SiteDomainRecord): number {
    const ssl = normalizeSsl(record.ssl_status)
    return calculateDomainHealthScore({
        verificationState: record.status === 'active' || record.status === 'verifying' ? 'verified' : 'pending',
        dnsVerified: record.status === 'active' || record.status === 'verifying',
        hostAttached: record.status === 'active',
        sslStatus: ssl,
        propagationState: record.status === 'active' ? 'propagated' : 'pending',
    })
}

// ── Connect-wizard step model ────────────────────────────────────────────────

export type WizardStep = 'enter' | 'instructions' | 'verify' | 'activate'

export const WIZARD_STEPS: ReadonlyArray<{ key: WizardStep; label: string }> = [
    { key: 'enter', label: 'Add domain' },
    { key: 'instructions', label: 'DNS records' },
    { key: 'verify', label: 'DNS & HTTPS' },
    { key: 'activate', label: 'Ready' },
]

/** Lifecycle step a connected domain has reached (for the detail checklist). */
export function lifecycleSteps(health: CustomDomainHealth): Array<{ label: string; done: boolean; active: boolean }> {
    const ownership = health.txt_verified
    const dns = health.cname_verified
    const ssl = health.ssl_active
    const verification = health.customer_verification?.status
    const live = health.status === 'active' && (!verification || verification === 'ready')
    return [
        { label: 'Ownership verified', done: ownership, active: !ownership },
        { label: 'DNS routed', done: dns, active: ownership && !dns },
        { label: 'SSL issued', done: ssl, active: dns && !ssl },
        ...(verification ? [{ label: 'Customer verification', done: verification === 'ready', active: ssl && verification !== 'ready' }] : []),
        { label: 'Live & secure', done: live, active: ssl && !live },
    ]
}

export function customerVerificationSummary(status: NonNullable<CustomDomainHealth['customer_verification']>['status']) {
    if (status === 'ready') return { tone: 'success' as const, title: 'Customer verification ready', description: 'Protected customer forms are ready on this domain and its secure checkout address.' }
    if (status === 'capacity_reached') return { tone: 'warning' as const, title: 'Customer verification needs attention', description: 'Your domain is secure, but verification capacity is full. Contact LetBuyy support to finish protected customer forms. No DNS changes are needed.' }
    if (status === 'configuration_required') return { tone: 'warning' as const, title: 'Customer verification setup required', description: 'LetBuyy needs to finish its verification configuration. Contact support; do not change your domain records.' }
    if (status === 'unavailable') return { tone: 'warning' as const, title: 'Customer verification could not be confirmed', description: 'Your saved domain settings are preserved. Check setup again; contact LetBuyy support if this continues.' }
    return { tone: 'info' as const, title: 'Preparing customer verification', description: 'After ownership, routing and HTTPS are verified, LetBuyy prepares protected customer forms automatically.' }
}
