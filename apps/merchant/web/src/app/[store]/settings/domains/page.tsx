'use client'

import { useReadRequest } from '@/lib/api/use-read-request'
import { MerchantEmptyArtwork } from '@/components/empty-states/MerchantEmptyState'

import { getStorefrontRootDomain } from '@/lib/public-urls'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Section,
    Card,
    Badge,
    Banner,
    Button,
    ChevronRight,
    Crown,
    Globe,
    Input,
    Plus,
    Search,
    Skeleton,
    Sparkles,
    useToast,
} from '@letbuyy/ui'
import { formatInrCurrency } from '@letbuyy/ui/formatting'
import type { DomainAvailabilityQuote, SiteDomainRecord } from '@letbuyy/api-client'
import { SettingsPane } from '@/components/settings/SettingsPane'
import { domainsClient } from '@/lib/domains/client'
import { normalizeSsl, normalizeStatus, scoreFromRecord, statusLabel } from '@/lib/domains/domain-model'
import { DomainStatusBadge, HealthMeter, SslBadge } from '@/components/domains/parts'
import { ConnectDomainWizard } from '@/components/domains/ConnectDomainWizard'
import { DomainDetailView } from '@/components/domains/DomainDetailView'
import { CheckoutDomainCard } from '@/components/domains/CheckoutDomainCard'

type View = { kind: 'overview' } | { kind: 'connect'; domain?: string } | { kind: 'detail'; domain: string; role: 'primary' | 'redirect'; redirectTo: string | null; provider: string | null }

interface StoreInfo {
    id: string
    subdomain: string
    published: boolean
}

type ApiPayload = { data?: unknown; error?: string | { message?: string } }

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function payloadError(payload: ApiPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

function readString(record: Record<string, unknown>, key: string, fallback = '') {
    const value = record[key]
    return typeof value === 'string' ? value : fallback
}

export default function DomainCenterPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [view, setView] = useState<View>({ kind: 'overview' })
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
    const [domains, setDomains] = useState<SiteDomainRecord[]>([])

    // Buy-domain state
    const [showBuy, setShowBuy] = useState(false)
    const [search, setSearch] = useState('')
    const [searching, setSearching] = useState(false)
    const [quote, setQuote] = useState<DomainAvailabilityQuote | null>(null)

    const beginRead = useReadRequest(store)
    const loadData = useCallback(async (opts?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!opts?.quiet) setLoading(true)
        setLoadError(null)
        try {
            const [settingsRes, list] = await Promise.all([
                fetch(`/api/stores/${encodeURIComponent(store)}/settings`, { cache: 'no-store', signal: request.signal }),
                domainsClient.list(store, request.signal),
            ])
            const settingsPayload = (await settingsRes.json().catch(() => null)) as ApiPayload | null
            if (!request.isCurrent()) return
            if (!settingsRes.ok) throw new Error(payloadError(settingsPayload, 'Unable to load store'))
            const data = isRecord(settingsPayload?.data) ? settingsPayload.data : {}
            const info: StoreInfo = {
                id: readString(data, 'id'),
                subdomain: readString(data, 'subdomain', readString(data, 'store_name')),
                published: data.published === true || data.status === 'published',
            }
            setStoreInfo(info)

            setDomains(list?.domains ?? [])
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load domains'
            setLoadError(message)
            notify({ title: 'Domains could not load', description: message, variant: 'critical' })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => { void loadData() }, [loadData])

    const primaryDomain = useMemo(() => domains.find((d) => d.role === 'primary' && d.status === 'active') || domains.find((d) => d.role === 'primary') || null, [domains])
    const otherDomains = useMemo(() => domains.filter((d) => d !== primaryDomain), [domains, primaryDomain])
    const letbuyyHost = storeInfo ? `${storeInfo.subdomain}.${getStorefrontRootDomain()}` : ''

    const doSearch = useCallback(async () => {
        const query = search.trim()
        if (!query) return
        setSearching(true)
        try {
            setQuote(await domainsClient.search(store, query))
        } catch (error) {
            notify({ title: 'Search failed', description: error instanceof Error ? error.message : 'Unable to search domain', variant: 'critical' })
        } finally {
            setSearching(false)
        }
    }, [notify, search, store])

    // ── Connect view ──
    if (view.kind === 'connect') {
        return (
            <SettingsPane navigationKey="domains" title="Connect a domain" description="Connect your storefront and secure checkout in one setup." store={store}>
                <ConnectDomainWizard
                    store={store}
                    initialDomain={view.domain}
                    onClose={() => { setView({ kind: 'overview' }); void loadData({ quiet: true }) }}
                    onConnected={() => void loadData({ quiet: true })}
                />
            </SettingsPane>
        )
    }

    // ── Detail view ──
    // No outer SettingsPane here on purpose: DomainDetailView renders its own
    // PageHeader with the real domain name, status badges and actions.
    // Wrapping it in SettingsPane's generic title="Domain" header produced two
    // stacked headers on the same page — this is the fix, not an oversight.
    if (view.kind === 'detail') {
        return (
            <DomainDetailView
                store={store}
                domain={view.domain}
                role={view.role}
                redirectTo={view.redirectTo}
                provider={view.provider}
                onBack={() => { setView({ kind: 'overview' }); void loadData({ quiet: true }) }}
                onChanged={() => void loadData({ quiet: true })}
            />
        )
    }

    // ── Overview ──
    if (loading) {
        return (
            <SettingsPane navigationKey="domains" title="Domains" description="Connect and manage the addresses shoppers use to reach your store." store={store}>
                <div className="settings-general-stack">
                    {[1, 2].map((i) => (
                        <Card key={i}>
                            <Section><Skeleton variant="text" lines={1} /></Section>
                            <div className="settings-form-body"><Skeleton variant="text" lines={3} /></div>
                        </Card>
                    ))}
                </div>
            </SettingsPane>
        )
    }

    return (
        <SettingsPane
                navigationKey="domains"
            title="Domains"
            description="Connect and manage the addresses shoppers use to reach your store."
            store={store}
            primaryAction={{
                label: 'Connect existing domain',
                onClick: () => setView({ kind: 'connect' }),
                icon: <Plus className="letbuyy-icon" aria-hidden="true" />,
            }}
        >
            {loadError && (
                <Banner variant="critical" title="Domains could not load" action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}>
                    {loadError}
                </Banner>
            )}

            <Banner variant="info" title="Use your own domain">
                Connect a custom domain to give your store a professional, branded address with automatic HTTPS. Your LetBuyy address remains assigned when you connect a custom domain.
            </Banner>

            <CheckoutDomainCard key={store} store={store} onResume={domain => setView({ kind: 'connect', domain })} />

            {/* Your domains */}
            <Section variant="grouped" title="Your domains" >

                    {/* LetBuyy default address — always live */}
                    <div className="domains-row">
                        <div className="domains-row-top">
                            <span className="domains-row-icon"><Globe className="letbuyy-icon" aria-hidden="true" /></span>
                            <div className="domains-row-meta">
                                <span className="domains-row-domain">{letbuyyHost}</span>
                                <span className="domains-row-sub">{storeInfo?.published ? 'LetBuyy address' : 'LetBuyy address · store not published'}</span>
                            </div>
                            <Badge label={storeInfo?.published ? 'Live' : 'Default'} variant={storeInfo?.published ? 'success' : 'info'} />
                        </div>
                    </div>

                    {/* Primary custom domain */}
                    {primaryDomain && (
                        <DomainRow record={primaryDomain} onManage={(d) => setView({ kind: 'detail', domain: d.domain, role: d.role, redirectTo: d.redirect_to, provider: d.provider })} primary />
                    )}

                    {/* Other connected / redirect / pending domains */}
                    {otherDomains.map((d) => (
                        <DomainRow key={d.domain} record={d} onManage={(rec) => setView({ kind: 'detail', domain: rec.domain, role: rec.role, redirectTo: rec.redirect_to, provider: rec.provider })} />
                    ))}

                    {domains.length === 0 && (
                        <div className="domains-empty">
                            <MerchantEmptyArtwork scene="domains" compact />
                            <div className="domains-empty-copy">
                                <span className="domains-empty-title">No custom domain yet</span>
                                <span className="domains-empty-desc">Connect a domain you own to brand your storefront with automatic HTTPS.</span>
                            </div>
                            <Button onClick={() => setView({ kind: 'connect' })}><Plus className="letbuyy-icon" aria-hidden="true" /> Connect domain</Button>
                        </div>
                    )}

                    <div className="domains-row-add">
                        <Button variant="secondary" onClick={() => setView({ kind: 'connect' })}><Plus className="letbuyy-icon" aria-hidden="true" /> Connect existing domain</Button>
                    </div>

            </Section>

            {/* Buy a domain */}
            <Card >
                <Button unstyled type="button" className="domains-buy-toggle" onClick={() => setShowBuy((v) => !v)} aria-expanded={showBuy}>
                    <span className="domains-buy-label">Buy a new domain</span>
                    <ChevronRight className={`letbuyy-icon domains-buy-chevron${showBuy ? ' is-open' : ''}`} aria-hidden="true" />
                </Button>
                {showBuy && (
                    <div className="settings-form-body">
                        <div className="settings-general-hint">Search for a new domain, pay securely, and LetBuyy registers and auto-connects it.</div>
                        <div className="domains-buy-search">
                            <Input label="Find a domain" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="yourbrand.in" />
                            <Button variant="secondary" onClick={() => void doSearch()} loading={searching}><Search className="letbuyy-icon" aria-hidden="true" /> Search</Button>
                        </div>
                        {quote && (
                            <div className="domains-quote">
                                <div className="domains-quote-meta">
                                    <span className="domains-quote-domain">{quote.domain}</span>
                                    <span className="domains-quote-price">
                                        {quote.available ? `${formatInrCurrency((quote.amountMinor || 0) / 100, { minimumFractionDigits: 0 })} / year` : 'Unavailable'}
                                    </span>
                                </div>
                                <Badge label={quote.available ? 'Available' : 'Taken'} variant={quote.available ? 'success' : 'critical'} />
                            </div>
                        )}
                        <div className="domains-note">
                            <Sparkles className="letbuyy-icon" aria-hidden="true" />
                            <span>Buying registers the domain and connects DNS automatically — no records to copy.</span>
                        </div>
                    </div>
                )}
            </Card>
        </SettingsPane>
    )
}

function DomainRow({ record, onManage, primary = false }: { record: SiteDomainRecord; onManage: (record: SiteDomainRecord) => void; primary?: boolean }) {
    const status = normalizeStatus(record.status)
    const ssl = normalizeSsl(record.ssl_status)
    const score = scoreFromRecord(record)
    return (
        <Button unstyled type="button" className="domains-row domains-row--clickable" onClick={() => onManage(record)}>
            <div className="domains-row-top">
                <span className="domains-row-icon">{primary ? <Crown className="letbuyy-icon" aria-hidden="true" /> : <Globe className="letbuyy-icon" aria-hidden="true" />}</span>
                <div className="domains-row-meta">
                    <div className="domains-row-domain-line">
                        <span className="domains-row-domain">{record.domain}</span>
                        {primary && <Badge label="Primary" variant="success" />}
                        {!primary && record.role === 'redirect' && <Badge label="Redirect" variant="info" />}
                    </div>
                    <span className="domains-row-sub">
                        {record.provider ? `${record.provider} · ` : ''}{statusLabel(status)}
                    </span>
                </div>
                <ChevronRight className="letbuyy-icon domains-row-chevron" aria-hidden="true" />
            </div>
            <div className="domains-row-bottom">
                <div className="domains-row-status">
                    <SslBadge ssl={ssl} />
                    <DomainStatusBadge status={status} />
                </div>
                <div className="domains-row-health"><HealthMeter score={score} /></div>
            </div>
        </Button>
    )
}
