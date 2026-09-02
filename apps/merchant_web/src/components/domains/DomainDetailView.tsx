'use client'

import { useCallback, useEffect, useState } from 'react'
import {
    AlertTriangle,
    ArrowLeft,
    Badge,
    Button,
    Check,
    CheckCircle2,
    Clock,
    ConfirmDialog,
    Crown,
    ExternalLink,
    Globe,
    Info,
    Lock,
    RefreshCw,
    ShieldAlert,
    Skeleton,
    Star,
    Trash2,
    useToast,
} from '@letbuyy/ui'
import { formatUsLongDate, formatUsShortDate } from '@letbuyy/ui/formatting'
import type { CustomDomainHealth, DomainVerificationEvent } from '@letbuyy/api-client'
import { domainsClient } from '@/lib/domains/client'
import {
    lifecycleSteps,
    normalizeSsl,
    scoreFromHealth,
    sslLabel,
} from '@/lib/domains/domain-model'
import { diagnoseDomain, domainConfidence, type IssueSeverity } from '@/lib/domains/troubleshooting'
import { providerDnsUrl } from '@/lib/domains/providers'
import { DnsRecordRow, HealthMeter, SslBadge, DomainStatusBadge, type RecordState } from './parts'

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

    const load = useCallback(async (opts?: { quiet?: boolean }) => {
        if (!opts?.quiet) setLoading(true)
        try {
            const [h, hist] = await Promise.all([
                domainsClient.health(store, domain),
                domainsClient.history(store, domain).catch(() => ({ domain, connected: false, events: [] })),
            ])
            setHealth(h)
            setEvents(hist.events || [])
            setHistoryConnected(hist.connected)
        } catch (error) {
            notify({ title: 'Could not load domain', description: error instanceof Error ? error.message : 'Unable to load domain health', variant: 'critical' })
        } finally {
            setLoading(false)
        }
    }, [domain, notify, store])

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
            <div className="settings-general-stack">
                <Button unstyled type="button" className="domains-back" onClick={onBack}><ArrowLeft className="letbuyy-icon" aria-hidden="true" /> Domains</Button>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="settings-home-card">
                        <div className="settings-home-section-label"><Skeleton variant="text" lines={1} /></div>
                        <div className="settings-form-body"><Skeleton variant="text" lines={3} /></div>
                    </div>
                ))}
            </div>
        )
    }

    if (!health) {
        return (
            <div className="settings-general-stack">
                <Button unstyled type="button" className="domains-back" onClick={onBack}><ArrowLeft className="letbuyy-icon" aria-hidden="true" /> Domains</Button>
                <div className="settings-home-card"><div className="settings-form-body">
                    <div className="domains-note domains-note--warn"><AlertTriangle className="letbuyy-icon" aria-hidden="true" /><span>Could not load this domain. <Button unstyled type="button" className="settings-business-link" onClick={() => void load()}>Retry</Button>.</span></div>
                </div></div>
            </div>
        )
    }

    const score = scoreFromHealth(health)
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

    return (
        <div className="settings-general-stack">
            {/* Header */}
            <div className="domains-detail-head">
                <Button unstyled type="button" className="domains-back" onClick={onBack}><ArrowLeft className="letbuyy-icon" aria-hidden="true" /> Domains</Button>
                <div className="domains-detail-title-row">
                    <span className="domains-detail-icon">{isPrimary ? <Crown className="letbuyy-icon" aria-hidden="true" /> : <Globe className="letbuyy-icon" aria-hidden="true" />}</span>
                    <h2 className="domains-detail-title">{domain}</h2>
                    {isPrimary && <Badge label="Primary" variant="success" />}
                    <DomainStatusBadge status={health.status} />
                </div>
                <div className="domains-detail-actions">
                    <Button variant="secondary" onClick={() => void refresh()} loading={refreshing}>
                        <RefreshCw className="letbuyy-icon" aria-hidden="true" /> Refresh
                    </Button>
                    {!isPrimary && health.status === 'active' && (
                        <Button onClick={() => void makePrimary()} loading={working}>
                            <Star className="letbuyy-icon" aria-hidden="true" /> Make primary
                        </Button>
                    )}
                    <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={working} aria-label="Remove domain">
                        <Trash2 className="letbuyy-icon" aria-hidden="true" />
                    </Button>
                </div>
            </div>

            {/* Confidence-first: will my store work? */}
            <div className={`domains-confidence domains-confidence--${confidence.tone}`}>
                <span className="domains-confidence-icon">
                    {confidence.tone === 'success' ? <CheckCircle2 className="letbuyy-icon" aria-hidden="true" /> : confidence.tone === 'critical' ? <ShieldAlert className="letbuyy-icon" aria-hidden="true" /> : <Clock className="letbuyy-icon" aria-hidden="true" />}
                </span>
                <div className="domains-confidence-body">
                    <span className="domains-confidence-headline">{confidence.headline}</span>
                    <span className="domains-confidence-sub">Last checked {formatUsShortDate(health.checked_at, { emptyValue: 'just now' })}</span>
                </div>
                <div className="domains-confidence-health"><HealthMeter score={score} /></div>
            </div>

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
                        <div className="domains-note"><Info className="letbuyy-icon" aria-hidden="true" /><span>Certificate renewal: {formatUsLongDate(health.renewal_date, { emptyValue: 'Managed automatically' })}.</span></div>
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

            {/* Activity timeline */}
            <div className="settings-home-card">
                <div className="settings-home-section-label">Activity</div>
                <div className="settings-form-body">
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
                                        <span className="domains-timeline-time">{formatUsShortDate(event.created_at, { emptyValue: '' })}</span>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
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
        </div>
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
