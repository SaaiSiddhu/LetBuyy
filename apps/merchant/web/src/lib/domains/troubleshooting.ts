// Domain Center — troubleshooting engine.
// Translates real backend health (DoH DNS + Vercel TLS) into plain merchant language.
// Commerce-first: every issue answers "will my store work?" before "which record is wrong?".
// No fabricated diagnostics — each issue is gated on a real signal in CustomDomainHealth.

import type { CustomDomainHealth } from '@letbuyy/api-client'

export type IssueSeverity = 'critical' | 'warning' | 'info'

export interface DomainIssue {
    id: string
    title: string
    description: string
    recommendedAction: string
    estimatedResolutionTime: string
    severity: IssueSeverity
}

export interface DomainConfidence {
    headline: string
    tone: 'success' | 'warning' | 'critical'
}

/** The single "will my store work?" answer, shown before any DNS detail. */
export function domainConfidence(health: CustomDomainHealth): DomainConfidence {
    if (health.status === 'active' && health.ssl_active) {
        if (health.customer_verification && health.customer_verification.status !== 'ready') {
            return { headline: 'Your store is reachable. Customer verification needs attention.', tone: 'warning' }
        }
        return { headline: 'Your store is live and secure on this domain.', tone: 'success' }
    }
    if (health.status === 'error' || health.misconfigured) {
        return { headline: "Your store can't be reached on this domain yet.", tone: 'critical' }
    }
    if (health.provider_status === 'unavailable') {
        return { headline: 'Domain saved — secure setup will finish once it can run.', tone: 'warning' }
    }
    return { headline: "Almost there — your domain is still being set up.", tone: 'warning' }
}

export function diagnoseDomain(health: CustomDomainHealth): DomainIssue[] {
    const issues: DomainIssue[] = []
    const cname = health.records.find((record) => record.type === 'CNAME')

    if (!health.txt_verified) {
        issues.push({
            id: 'ownership-pending',
            severity: health.status === 'error' ? 'critical' : 'warning',
            title: "We can't confirm you own this domain yet",
            description: "Until your ownership record is visible to us, your domain can't be connected to your store.",
            recommendedAction: 'Add the TXT verification record from the DNS records section at your domain provider, then run Verify. Already added it? DNS changes can take a little time to appear.',
            estimatedResolutionTime: '5–30 minutes',
        })
    }

    if (cname && cname.status !== 'verified') {
        const mismatch = cname.status === 'mismatch'
        issues.push({
            id: 'dns-routing',
            severity: 'critical',
            title: mismatch ? 'Your domain is pointing somewhere else' : "Your domain isn't pointing to your store yet",
            description: "Shoppers can't reach your store because your domain's address record doesn't send traffic to LetBuyy.",
            recommendedAction: mismatch
                ? `Update your domain's record so it points to ${cname.value} (remove the old value first).`
                : `Add the record from DNS records so your domain points to ${cname.value}.`,
            estimatedResolutionTime: '5 minutes to a few hours',
        })
    }

    if (health.misconfigured) {
        issues.push({
            id: 'misconfigured',
            severity: 'critical',
            title: 'Your domain setup needs a small correction',
            description: "We reached your domain but couldn't fully validate its configuration, so it can't go live securely.",
            recommendedAction: 'Make sure the records in DNS records match exactly and remove any conflicting A/AAAA/CNAME records for the same host, then Refresh.',
            estimatedResolutionTime: '5–30 minutes',
        })
    }

    if (health.txt_verified && health.cname_verified && !health.ssl_active && !health.misconfigured && health.provider_status !== 'unavailable') {
        issues.push({
            id: 'ssl-pending',
            severity: 'info',
            title: 'Your secure (HTTPS) certificate is being issued',
            description: 'Your DNS looks correct. We are automatically issuing the HTTPS certificate so your store loads securely.',
            recommendedAction: 'No action needed — this finishes automatically. Refresh in a few minutes to see it go active.',
            estimatedResolutionTime: 'A few minutes to an hour',
        })
    }

    if (health.provider_status === 'unavailable') {
        issues.push({
            id: 'tls-automation-unavailable',
            severity: 'warning',
            title: 'Secure-certificate automation is not connected',
            description: 'Your domain and DNS are saved, but the certificate service is not configured in this environment yet, so HTTPS can’t finish automatically.',
            recommendedAction: 'No merchant action — your store team needs to connect the certificate provider. Your DNS records are still correct and saved.',
            estimatedResolutionTime: 'Pending platform setup',
        })
    }

    if (health.apex_mx_warning) {
        issues.push({
            id: 'apex-mx',
            severity: 'info',
            title: 'Keep your email working on this domain',
            description: 'This domain receives email (it has MX records). Pointing the bare root domain with a plain CNAME can stop email from arriving.',
            recommendedAction: 'Use "www" as your primary domain, or an ALIAS / CNAME-flattening record at the root, so email keeps working.',
            estimatedResolutionTime: '5 minutes',
        })
    }

    return issues
}
