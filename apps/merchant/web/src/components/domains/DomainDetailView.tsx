'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useState } from 'react'
import {
    AlertTriangle,
    ArrowLeft,
    Badge,
    Banner,
    Button,
    Check,
    Clock,
    ConfirmDialog,
    Crown,
    Disclosure,
    ExternalLink,
    Globe,
    Info,
    Lock,
    Page,
    PageHeader,
    RefreshCw,
    ShieldAlert,
    Skeleton,
    Star,
    Trash2,
    type PageHeaderAction,
    useToast,
} from '@letbuyy/ui'
import { formatIndiaDate, formatIndiaDateTime } from '@letbuyy/ui/formatting'
import type { CustomDomainHealth, DomainVerificationEvent } from '@letbuyy/api-client'
import { domainsClient } from '@/lib/domains/client'
import {
    lifecycleSteps,
    normalizeSsl,
    sslLabel,
} from '@/lib/domains/domain-model'
import { diagnoseDomain, domainConfidence, type IssueSeverity } from '@/lib/domains/troubleshooting'
import { providerDnsUrl } from '@/lib/domains/providers'
import { DnsRecordRow, SslBadge, DomainStatusBadge, type RecordState } from './parts'

interface DomainDetailViewProps {
    store: string
    domain: string
    role: 'primary' | 'redirect'
    redirectTo: string | null
    /** DNS provider detected at list time; re-confirmed live from the health probe below. */
    provider: string | null
    onBack: () => void
    onChanged: () => void
}

const SEVERITY_META: Record<IssueSeverity, { variant: 'critical' | 'warning' | 'info'; label: string }> = {
    critical: { variant: 'critical', label: 'Action required' },
    warning: { variant: 'warning', label: 'Attention' },
    info: { variant: 'info', label: 'Heads up' },
}

function recordState(status: string): RecordState {
    return status === 'verified' || status === 'pending' || status === 'mismatch' ? status : 'unknown'
}

export function DomainDetailView({ store, domain, role, redirectTo, provider, onBack, onChanged }: DomainDetailViewProps) {
    const { notify } = useToast()
    const [health, setHealth] = useState<CustomDomainHealth | null>(null)
    const [events, setEvents] = useState<DomainVerificationEvent[]>([])
    const [historyConnected, setHistoryConnected] = useState(false)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [working, setWorking] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const beginRead = useReadRequest(JSON.stringify([store, domain]))
    const load = useCallback(async (opts?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!opts?.quiet) setLoading(true)
        try {
            const [h, hist] = await Promise.all([
                domainsClient.health(store, domain, request.signal),
                domainsClient.history(store, domain, request.signal).catch(() => ({ domain, connected: false, events: [] })),
            ])
            if (!request.isCurrent()) return
            setHealth(h)
            setEvents(hist.events || [])
            setHistoryConnected(hist.connected)
        } catch (error) {
            if (!request.isCurrent()) return
            notify({ title: 'Could not load domain', description: error instanceof Error ? error.message : 'Unable to load domain health', variant: 'critical' })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, domain, notify, store])

    useEffect(() => { void load() }, [load])

    const refresh = useCallback(async () => {
        setRefreshing(true)
        await load({ quiet: true })
        setRefreshing(false)
        notify({ title: 'Re-checked', description: 'DNS and SSL status refreshed.', variant: 'info' })
    }, [load, notify])

    const makePrimary = useCallback(async () => {
        if (working) return
        setWorking(true)
        try {
            const result = await domainsClient.setPrimary(store, domain)
            if (!result.ok) throw new Error(result.message || 'Could not set primary')
            notify({ title: 'Primary domain updated', description: `${domain} is now your primary domain.`, variant: 'success' })
            onChanged()
            await load({ quiet: true })
        } catch (error) {
            notify({ title: 'Could not set primary', description: error instanceof Error ? error.message : 'Unable to set primary', variant: 'critical' })
        } finally {
            setWorking(false)
        }
    }, [domain, load, notify, onChanged, store, working])

    const remove = useCallback(async () => {
        setWorking(true)
        try {
            await domainsClient.remove(store, domain)
            notify({ title: 'Domain removed', description: `${domain} is no longer connected.`, variant: 'success' })
            onChanged()
            onBack()
        } catch (error) {
            notify({ title: 'Could not remove domain', description: error instanceof Error ? error.message : 'Unable to remove domain', variant: 'critical' })
            setWorking(false)
            setConfirmDelete(false)
        }
    }, [domain, notify, onBack, onChanged, store])

    if (loading) {
        return (
            <Page>
                <Button unstyled type="button" className="domains-back" onClick={onBack}><ArrowLeft className="letbuyy-icon" aria-hidden="true" /> Domains</Button>
                <div className="settings-general-stack">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="settings-home-card">
                            <div className="settings-home-section-label"><Skeleton variant="text" lines={1} /></div>
                            <div className="settings-form-body"><Skeleton variant="text" lines={3} /></div>
                        </div>
                    ))}
                </div>
            </Page>
        )
    }

    if (!health) {
        return (
            <Page>
                <Button unstyled type="button" className="domains-back" onClick={onBack}><ArrowLeft className="letbuyy-icon" aria-hidden="true" /> Domains</Button>
                <div className="settings-home-card"><div className="settings-form-body">
                    <div className="domains-note domains-note--warn"><AlertTriangle className="letbuyy-icon" aria-hidden="true" /><span>Could not load this domain. <Button unstyled type="button" className="settings-business-link" onClick={() => void load()}>Retry</Button>.</span></div>
                </div></div>
            </Page>
        )
    }

    const ssl = normalizeSsl(health.ssl_active ? 'active' : health.provider_status === 'unavailable' ? 'unavailable' : health.misconfigured ? 'error' : 'pending')
    const confidence = domainConfidence(health)
    const issues = diagnoseDomain(health)
    const steps = lifecycleSteps(health)
    const isPrimary = role === 'primary'
    // Prefer the provider from the latest health check (re-detected live from the
    // apex nameservers) over the value captured when the list loaded — so a
    // registrar/NS change (e.g. GoDaddy → Cloudflare) updates on Refresh.
    const livingProvider = (health.provider ?? provider) || null
    const providerLink = providerDnsUrl(livingProvider, domain)

    // The header's action row, in the canonical PageHeader shape. `Refresh` and
    // `Remove domain` are always offered; `Make primary` only applies to a
    // non-primary domain that's actually live. renderHeaderAction below gives
    // each its real Button variant (secondary / ghost-icon / primary) and
    // wires up loading state — PageHeader's own default action renderer has
    // no notion of a loading spinner, only disabled.
    const headerActions: PageHeaderAction[] = [
        { label: 'Refresh', onClick: () => void refresh(), icon: <RefreshCw className="letbuyy-icon" aria-hidden="true" /> },
        { label: 'Remove domain', onClick: () => setConfirmDelete(true), icon: <Trash2 className="letbuyy-icon" aria-hidden="true" />, disabled: working },
    ]
    const primaryHeaderAction: PageHeaderAction | undefined = (!isPrimary && health.status === 'active')
        ? { label: 'Make primary', onClick: () => void makePrimary(), icon: <Star className="letbuyy-icon" aria-hidden="true" /> }
        : undefined
    const renderHeaderAction = (action: PageHeaderAction, variant: 'primary' | 'secondary') => {
        if (action.label === 'Remove domain') {
            return (
                <Button key={action.label} variant="ghost" onClick={action.onClick} disabled={action.disabled} aria-label={action.label}>
                    {action.icon}
                </Button>
            )
        }
        if (action.label === 'Refresh') {
            return (
                <Button key={action.label} variant="secondary" onClick={action.onClick} loading={refreshing}>
                    {action.icon}{action.label}
                </Button>
            )
        }
        return (
            <Button key={action.label} variant={variant} onClick={action.onClick} loading={working}>
                {action.icon}{action.label}
            </Button>
        )
    }

    return (
        <Page>
            <Button unstyled type="button" className="domains-back" onClick={onBack}><ArrowLeft className="letbuyy-icon" aria-hidden="true" /> Domains</Button>

            <PageHeader
                title={domain}
                icon={isPrimary ? <Crown className="letbuyy-icon" aria-hidden="true" /> : <Globe className="letbuyy-icon" aria-hidden="true" />}
                titleAdornment={
                    <>
                        {isPrimary && <Badge label="Primary" variant="success" />}
                        <DomainStatusBadge status={health.status} />
                    </>
                }
                primaryAction={primaryHeaderAction}
                secondaryActions={headerActions}
                renderAction={renderHeaderAction}
            />

            <div className="settings-general-stack">
            {/* Confidence-first: will my store work? The canonical solid Banner —
                this used to be a hand-rolled soft-tint card with its own CSS
                (not the shared Banner component) with a health score bar
                crammed into the same row as the text, which is exactly what
                broke on narrower widths. The score is dropped here, not lost:
                the Setup checklist right below already states the same
                thing as four explicit, more legible steps. */}
            <Banner variant={confidence.tone} title={confidence.headline}>
                {health.checked_at ? `Last checked ${formatIndiaDateTime(health.checked_at)} IST` : 'Last checked just now'}
            </Banner>

            {/* Setup checklist */}
            <div className="settings-home-card">
                <div className="settings-home-section-label">Setup</div>
                <div className="settings-form-body">
                    <ol className="domains-checklist">
                        {steps.map((s) => (
                            <li key={s.label} className={`domains-checklist-item domains-checklist-item--${s.done ? 'done' : s.active ? 'active' : 'todo'}`}>
                                <span className="domains-checklist-dot">{s.done ? <Check className="letbuyy-icon" aria-hidden="true" /> : null}</span>
                                <span>{s.label}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>

            {/* Troubleshooting — shown before raw DNS when there are issues */}
            {issues.length > 0 && (
                <div className="settings-home-card">
                    <div className="settings-home-section-label">What to fix</div>
                    <div className="settings-form-body">
                        {issues.map((issue) => (
                            <div key={issue.id} className={`domains-issue domains-issue--${issue.severity}`}>
                                <div className="domains-issue-head">
                                    <span className="domains-issue-title">{issue.title}</span>
                                    <Badge label={SEVERITY_META[issue.severity].label} variant={SEVERITY_META[issue.severity].variant} />
                                </div>
                                <p className="domains-issue-desc">{issue.description}</p>
                                <p className="domains-issue-fix"><strong>Fix:</strong> {issue.recommendedAction}</p>
                                <p className="domains-issue-eta"><Clock className="letbuyy-icon" aria-hidden="true" /> Typically {issue.estimatedResolutionTime}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* DNS health */}
            <div className="settings-home-card">
                <div className="settings-home-section-label">DNS records</div>
                <div className="settings-form-body">
                    <div className="settings-general-hint">These are the records at your DNS provider and whether they&apos;re visible to us right now.</div>
                    {livingProvider && (
                        <div className="domains-provider-banner">
                            <span className="domains-provider-icon"><Globe className="letbuyy-icon" aria-hidden="true" /></span>
                            <div className="domains-provider-copy">
                                <span className="domains-provider-title">Managed by {livingProvider}</span>
                                <span className="domains-provider-sub">Detected live from your nameservers. Add or edit records at your DNS provider.</span>
                            </div>
                            {providerLink && (
                                <a className="domains-provider-cta" href={providerLink} target="_blank" rel="noopener noreferrer">
                                    Open {livingProvider} DNS
                                    <ExternalLink className="letbuyy-icon" aria-hidden="true" />
                                </a>
                            )}
                        </div>
                    )}
                    {health.records.map((record) => (
                        <DnsRecordRow
                            key={`${record.type}-${record.host}`}
                            type={record.type}
                            host={record.host}
                            value={record.value}
                            state={recordState(record.status)}
                            message={record.message}
                        />
                    ))}
                </div>
            </div>

            {/* SSL health */}
            <div className="settings-home-card">
                <div className="settings-home-section-label">Security (SSL / HTTPS)</div>
                <div className="settings-form-body">
                    <div className="domains-ssl-row">
                        <span className="domains-ssl-icon">{health.ssl_active ? <Lock className="letbuyy-icon" aria-hidden="true" /> : <ShieldAlert className="letbuyy-icon" aria-hidden="true" />}</span>
                        <div className="domains-ssl-meta">
                            <span className="domains-ssl-title">{sslLabel(ssl)}</span>
                            <span className="domains-ssl-sub">
                                {health.ssl_active
                                    ? `HTTPS is on. ${health.renewal_status === 'managed' ? 'Certificate auto-renews.' : ''}`
                                    : health.provider_status === 'unavailable'
                                        ? 'Certificate automation is not connected in this environment.'
                                        : 'The HTTPS certificate is issued automatically once DNS is correct.'}
                            </span>
                        </div>
                        <SslBadge ssl={ssl} />
                    </div>
                    {health.renewal_date && (
                        <div className="domains-note"><Info className="letbuyy-icon" aria-hidden="true" /><span>Certificate renewal: {formatIndiaDate(health.renewal_date, { emptyValue: 'Managed automatically' })}.</span></div>
                    )}
                </div>
            </div>

            {/* Traffic / redirect behavior */}
            <div className="settings-home-card">
                <div className="settings-home-section-label">Traffic</div>
                <div className="settings-form-body">
                    {isPrimary ? (
                        <div className="domains-note"><Crown className="letbuyy-icon" aria-hidden="true" /><span>This is your <strong>primary</strong> domain — shoppers see this address and other connected domains redirect here.</span></div>
                    ) : (
                        <div className="domains-note"><Globe className="letbuyy-icon" aria-hidden="true" /><span>This is a <strong>redirect</strong> domain. Visitors are 301-redirected to {redirectTo ? <strong>{redirectTo}</strong> : 'your primary domain'}. Use <em>Make primary</em> to serve the store here instead.</span></div>
                    )}
                </div>
            </div>

            {/* Activity timeline — collapsed by default. A live domain accrues one
                "Health checked" entry per probe, which reads as noise sitting
                open on every page load; a single Disclosure keeps it one click
                away instead of always taking vertical space. */}
            <Disclosure title="Activity" defaultOpen={events.length > 0 && events.length <= 3}>
                {!historyConnected ? (
                    <div className="domains-note"><Info className="letbuyy-icon" aria-hidden="true" /><span>Verification history will appear here once the domains upgrade is live (NOT CONNECTED yet).</span></div>
                ) : events.length === 0 ? (
                    <div className="settings-general-hint">No activity recorded yet.</div>
                ) : (
                    <ol className="domains-timeline">
                        {events.map((event) => (
                            <li key={event.id} className="domains-timeline-item">
                                <span className={`domains-timeline-dot domains-timeline-dot--${event.status === 'active' ? 'ok' : event.status === 'error' ? 'bad' : 'pending'}`} aria-hidden="true" />
                                <div className="domains-timeline-body">
                                    <span className="domains-timeline-title">{timelineLabel(event)}</span>
                                    <span className="domains-timeline-time">
                                        {event.created_at ? `${formatIndiaDateTime(event.created_at)} IST` : ''}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </Disclosure>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                title="Remove this domain?"
                description={`Disconnect ${domain} from this store. Shoppers using it will no longer reach your storefront. You can reconnect it later.`}
                confirmLabel={working ? 'Removing…' : 'Remove domain'}
                cancelLabel="Keep domain"
                destructive
                onConfirm={() => void remove()}
                onClose={() => { if (!working) setConfirmDelete(false) }}
            />
        </Page>
    )
}

function timelineLabel(event: DomainVerificationEvent): string {
    const verb: Record<string, string> = {
        connect: 'Domain added',
        verify: event.status === 'active' ? 'Verified & connected' : 'Verification checked',
        health: 'Health checked',
        set_primary: 'Set as primary',
        set_redirect: 'Set as redirect',
        delete: 'Removed',
    }
    return verb[event.check_type] || `${event.check_type} · ${event.status}`
}
