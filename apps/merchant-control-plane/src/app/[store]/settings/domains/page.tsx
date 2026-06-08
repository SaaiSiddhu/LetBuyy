'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Badge,
    Banner,
    Button,
    Card,
    Globe,
    Input,
    Section,
    Skeleton,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'

type AccessMode = 'public' | 'password' | 'preview_only' | 'offline'
type CustomDomainStatus = 'none' | 'pending' | 'review' | 'verifying' | 'active' | 'error'

interface DomainStoreData {
    id: string
    subdomain: string
    custom_domain: string
    custom_domain_status: CustomDomainStatus
    access_mode: AccessMode
    access_message: string
    published: boolean
}

interface VerificationRecords {
    txt?: { name: string; value: string }
    cname?: { name: string; value: string }
    apex_alias?: { name: string; value: string }
}

interface DomainQuote {
    domain: string
    available: boolean
    currency: string
    amountMinor: number
    provider: string
    premium: boolean
}

type SettingsPayload = {
    data?: unknown
    error?: string | { message?: string }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getPayloadError(payload: SettingsPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

function readString(record: Record<string, unknown>, key: string, fallback = '') {
    const value = record[key]
    return typeof value === 'string' ? value : fallback
}

function readAccessMode(value: unknown): AccessMode {
    return value === 'password' || value === 'preview_only' || value === 'offline' ? value : 'public'
}

function readDomainStatus(value: unknown): CustomDomainStatus {
    return value === 'pending' || value === 'review' || value === 'verifying' || value === 'active' || value === 'error' ? value : 'none'
}

function statusVariant(status: CustomDomainStatus) {
    if (status === 'active') return 'success' as const
    if (status === 'error') return 'critical' as const
    if (status === 'pending' || status === 'review' || status === 'verifying') return 'warning' as const
    return 'default' as const
}

function gatewayUrl(path: string) {
    const base = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL
    if (!base) throw new Error('NEXT_PUBLIC_API_URL is required for domain settings')
    return `${base.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1${path}`
}

export default function DomainSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [savingDomain, setSavingDomain] = useState(false)
    const [savingAccess, setSavingAccess] = useState(false)
    const [creatingPreview, setCreatingPreview] = useState(false)
    const [storeData, setStoreData] = useState<DomainStoreData>({
        id: '',
        subdomain: '',
        custom_domain: '',
        custom_domain_status: 'none',
        access_mode: 'public',
        access_message: '',
        published: false,
    })
    const [customDomain, setCustomDomain] = useState('')
    const [records, setRecords] = useState<VerificationRecords>({})
    const [accessMode, setAccessMode] = useState<AccessMode>('public')
    const [password, setPassword] = useState('')
    const [accessMessage, setAccessMessage] = useState('')
    const [previewToken, setPreviewToken] = useState('')
    const [apexMxWarning, setApexMxWarning] = useState(false)
    const [domainSearch, setDomainSearch] = useState('')
    const [domainOwnerName, setDomainOwnerName] = useState('')
    const [domainOwnerEmail, setDomainOwnerEmail] = useState('')
    const [domainQuote, setDomainQuote] = useState<DomainQuote | null>(null)
    const [searchingDomain, setSearchingDomain] = useState(false)
    const [buyingDomain, setBuyingDomain] = useState(false)

    const primaryDomain = `${storeData.subdomain}.letbuyy.store`
    const previewHost = useMemo(() => customDomain.trim() || primaryDomain, [customDomain, primaryDomain])
    const cnameTarget = records.cname?.value || process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET || 'Generated after Connect'

    const loadData = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                cache: 'no-store',
                signal,
            })
            const payload = (await response.json().catch(() => null)) as SettingsPayload | null
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to load domain settings'))

            const data = isRecord(payload?.data) ? payload.data : null
            if (!data) throw new Error('Domain settings were not returned for this store')

            const next: DomainStoreData = {
                id: readString(data, 'id'),
                subdomain: readString(data, 'subdomain', readString(data, 'store_name')),
                custom_domain: readString(data, 'custom_domain'),
                custom_domain_status: readDomainStatus(data.custom_domain_status),
                access_mode: readAccessMode(data.access_mode),
                access_message: readString(data, 'access_message'),
                published: data.published === true || data.status === 'published',
            }

            setStoreData(next)
            setCustomDomain(next.custom_domain)
            setAccessMode(next.access_mode)
            setAccessMessage(next.access_message)
        } catch (error) {
            if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) return
            const message = error instanceof Error ? error.message : 'Unable to load domain settings'
            setLoadError(message)
            notify({ title: 'Domain settings could not load', description: message, variant: 'critical' })
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        const controller = new AbortController()
        void loadData(controller.signal)
        return () => controller.abort()
    }, [loadData])

    const copy = useCallback(async (value: string) => {
        await navigator.clipboard.writeText(value)
        notify({ title: 'Copied', description: value, variant: 'success' })
    }, [notify])

    const connectDomain = useCallback(async () => {
        const domain = customDomain.trim()
        if (!domain) return
        setSavingDomain(true)
        try {
            const response = await fetch(gatewayUrl('/custom/domains'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site_id: storeData.id, domain }),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to connect custom domain'))
            const data = isRecord(payload?.data) ? payload.data : {}
            setRecords(isRecord(data.records) ? data.records as VerificationRecords : {})
            setApexMxWarning(data.apex_mx_warning === true)
            setStoreData((current) => ({ ...current, custom_domain: domain, custom_domain_status: 'pending' }))
            notify({ title: 'Domain challenge created', description: 'Add the TXT and CNAME records, then verify.', variant: 'success' })
        } catch (error) {
            notify({ title: 'Could not connect domain', description: error instanceof Error ? error.message : 'Unable to connect custom domain', variant: 'critical' })
        } finally {
            setSavingDomain(false)
        }
    }, [customDomain, notify, storeData.id])

    const verifyDomain = useCallback(async () => {
        const domain = customDomain.trim()
        if (!domain) return
        setSavingDomain(true)
        try {
            const response = await fetch(gatewayUrl('/custom/domains/verify'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site_id: storeData.id, domain }),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok && response.status !== 202) throw new Error(getPayloadError(payload, 'Unable to verify custom domain'))
            const data = isRecord(payload?.data) ? payload.data : {}
            const status = readDomainStatus(data.status || (isRecord(payload) ? payload.status : undefined))
            setStoreData((current) => ({ ...current, custom_domain_status: status }))
            notify({ title: 'Domain verification checked', description: `Current status: ${status}`, variant: status === 'active' ? 'success' : 'info' })
        } catch (error) {
            notify({ title: 'Could not verify domain', description: error instanceof Error ? error.message : 'Unable to verify custom domain', variant: 'critical' })
        } finally {
            setSavingDomain(false)
        }
    }, [customDomain, notify, storeData.id])

    const saveAccess = useCallback(async () => {
        setSavingAccess(true)
        try {
            const response = await fetch(gatewayUrl('/store-access'), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site_id: storeData.id, access_mode: accessMode, password: password || undefined, access_message: accessMessage || null }),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to update store access'))
            setPassword('')
            setStoreData((current) => ({ ...current, access_mode: accessMode, access_message: accessMessage }))
            notify({ title: 'Store access updated', description: `Access mode is ${accessMode}.`, variant: 'success' })
        } catch (error) {
            notify({ title: 'Could not update store access', description: error instanceof Error ? error.message : 'Unable to update store access', variant: 'critical' })
        } finally {
            setSavingAccess(false)
        }
    }, [accessMessage, accessMode, notify, password, storeData.id])

    const createPreviewLink = useCallback(async () => {
        setCreatingPreview(true)
        try {
            const response = await fetch(gatewayUrl('/store-access/preview-links'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site_id: storeData.id, scope: 'share-link', host: previewHost }),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to create preview link'))
            setPreviewToken(readString(isRecord(payload?.data) ? payload.data : {}, 'token'))
            notify({ title: 'Preview link created', description: 'The token is ready to append as lb_preview.', variant: 'success' })
        } catch (error) {
            notify({ title: 'Could not create preview link', description: error instanceof Error ? error.message : 'Unable to create preview link', variant: 'critical' })
        } finally {
            setCreatingPreview(false)
        }
    }, [notify, previewHost, storeData.id])

    const searchDomainToBuy = useCallback(async () => {
        const query = domainSearch.trim()
        if (!query) return
        setSearchingDomain(true)
        try {
            const response = await fetch(gatewayUrl(`/domains/search?query=${encodeURIComponent(query)}`), {
                credentials: 'include',
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to search domain'))
            const data = isRecord(payload?.data) ? payload.data : {}
            setDomainQuote({
                domain: readString(data, 'domain', query),
                available: data.available === true,
                currency: readString(data, 'currency', 'INR'),
                amountMinor: typeof data.amountMinor === 'number' ? data.amountMinor : Number(data.amount_minor || 0),
                provider: readString(data, 'provider'),
                premium: data.premium === true,
            })
        } catch (error) {
            notify({ title: 'Could not search domain', description: error instanceof Error ? error.message : 'Unable to search domain', variant: 'critical' })
        } finally {
            setSearchingDomain(false)
        }
    }, [domainSearch, notify])

    const purchaseDomain = useCallback(async () => {
        if (!domainQuote?.available) return
        setBuyingDomain(true)
        try {
            const response = await fetch(gatewayUrl('/domains/purchase'), {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': `domain-purchase:${storeData.id}:${domainQuote.domain}`,
                },
                body: JSON.stringify({
                    site_id: storeData.id,
                    domain: domainQuote.domain,
                    years: 1,
                    payment_reference: `razorpay:${storeData.id}:${domainQuote.domain}`,
                    owner: {
                        name: domainOwnerName,
                        email: domainOwnerEmail,
                    },
                }),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to purchase domain'))
            const data = isRecord(payload?.data) ? payload.data : {}
            setCustomDomain(readString(data, 'domain', domainQuote.domain))
            setStoreData((current) => ({
                ...current,
                custom_domain: readString(data, 'domain', domainQuote.domain),
                custom_domain_status: readDomainStatus(data.status),
            }))
            notify({ title: 'Domain purchase started', description: 'LetBuyy is registering and auto-connecting the domain.', variant: 'success' })
        } catch (error) {
            notify({ title: 'Could not purchase domain', description: error instanceof Error ? error.message : 'Unable to purchase domain', variant: 'critical' })
        } finally {
            setBuyingDomain(false)
        }
    }, [domainOwnerEmail, domainOwnerName, domainQuote, notify, storeData.id])

    if (loading) {
        return (
            <SettingsPane title="Domains" description="Manage storefront domains and access gates." store={store}>
                <Card><Section title="Domains"><Skeleton variant="text" lines={4} /></Section></Card>
                <Card><Section title="Store access"><Skeleton variant="text" lines={4} /></Section></Card>
            </SettingsPane>
        )
    }

    return (
        <SettingsPane
            title="Domains"
            description="Manage storefront domains and access gates."
            store={store}
            guidance={{
                title: 'Custom domains use CNAME verification',
                body: 'Ownership TXT must pass before a custom domain can become active. Vercel issues TLS after the host is attached.',
            }}
        >
            {loadError && (
                <Banner variant="critical" title="Domain settings could not load" action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}>
                    {loadError}
                </Banner>
            )}

            <Card>
                <Section title="Primary domain" description="This LetBuyy-hosted storefront domain stays available.">
                    <div className="flex flex-col gap-[var(--lb-space-4)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-[var(--lb-space-3)]">
                            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                <Globe className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            </span>
                            <span className="truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                {primaryDomain}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                            <Badge label={storeData.published ? 'Published' : 'Unpublished'} variant={storeData.published ? 'success' : 'warning'} />
                            <Button variant="secondary" onClick={() => void copy(primaryDomain)}>Copy</Button>
                        </div>
                    </div>
                </Section>
            </Card>

            <Card>
                <Section title="Custom domain" description="Add DNS records, then verify ownership and CNAME routing.">
                    {apexMxWarning && (
                        <Banner variant="warning" title="Apex domain email warning">
                            Your domain has email (MX) records. Keep `www` canonical and use an ALIAS or CNAME-flattening provider at the apex, or email may stop working.
                        </Banner>
                    )}
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-[1fr_auto] md:items-end">
                        <Input
                            label="Domain"
                            value={customDomain}
                            onChange={(event) => setCustomDomain(event.target.value)}
                            placeholder="shop.example.in"
                            autoComplete="url"
                        />
                        <div className="flex gap-[var(--lb-space-2)]">
                            <Button loading={savingDomain} onClick={() => void connectDomain()}>Connect</Button>
                            <Button variant="secondary" loading={savingDomain} onClick={() => void verifyDomain()}>Verify</Button>
                        </div>
                    </div>
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-4">
                        {['Ownership', 'DNS', 'SSL', 'Live'].map((step, index) => (
                            <div key={step} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)]">
                                <p className="text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{step}</p>
                                <Badge
                                    label={index === 0 && storeData.custom_domain_status !== 'none' ? 'Started' : storeData.custom_domain_status}
                                    variant={index === 3 ? statusVariant(storeData.custom_domain_status) : storeData.custom_domain_status === 'active' ? 'success' : 'warning'}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="space-y-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                        <RecordRow label="TXT name" value={records.txt?.name || `_letbuyy-challenge.${customDomain || 'your-domain'}`} onCopy={copy} />
                        <RecordRow label="TXT value" value={records.txt?.value || 'Generated after Connect'} onCopy={copy} />
                        <RecordRow label="CNAME target" value={cnameTarget} onCopy={copy} />
                        <RecordRow label="Apex instruction" value={records.apex_alias?.value || 'Use ALIAS or CNAME flattening at the apex; keep www canonical.'} onCopy={copy} />
                    </div>
                </Section>
            </Card>

            <Card>
                <Section title="Buy a domain" description="Search, pay through Razorpay, and let LetBuyy register and auto-connect DNS.">
                    <div className="grid gap-[var(--lb-space-3)] md:grid-cols-[1fr_auto] md:items-end">
                        <Input label="Domain search" value={domainSearch} onChange={(event) => setDomainSearch(event.target.value)} placeholder="yourbrand.in" />
                        <Button variant="secondary" loading={searchingDomain} onClick={() => void searchDomainToBuy()}>Search</Button>
                    </div>
                    {domainQuote && (
                        <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
                            <div className="flex flex-wrap items-center justify-between gap-[var(--lb-space-3)]">
                                <div>
                                    <p className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{domainQuote.domain}</p>
                                    <p className="text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">
                                        {domainQuote.available ? `${domainQuote.currency} ${(domainQuote.amountMinor / 100).toFixed(2)} / year` : 'Unavailable'}
                                    </p>
                                </div>
                                <Badge label={domainQuote.available ? 'Available' : 'Unavailable'} variant={domainQuote.available ? 'success' : 'critical'} />
                            </div>
                            {domainQuote.available && (
                                <div className="mt-[var(--lb-space-3)] grid gap-[var(--lb-space-3)] md:grid-cols-[1fr_1fr_auto] md:items-end">
                                    <Input label="Registrant name" value={domainOwnerName} onChange={(event) => setDomainOwnerName(event.target.value)} />
                                    <Input label="Registrant email" value={domainOwnerEmail} onChange={(event) => setDomainOwnerEmail(event.target.value)} />
                                    <Button loading={buyingDomain} onClick={() => void purchaseDomain()}>Buy and connect</Button>
                                </div>
                            )}
                        </div>
                    )}
                </Section>
            </Card>

            <Card>
                <Section title="Store access" description="Choose how shoppers can reach this storefront before and after publish.">
                    <div className="grid gap-[var(--lb-space-2)] md:grid-cols-4">
                        {(['public', 'password', 'preview_only', 'offline'] as const).map((mode) => (
                            <Button key={mode} variant={accessMode === mode ? 'primary' : 'secondary'} onClick={() => setAccessMode(mode)}>
                                {mode.replace('_', ' ')}
                            </Button>
                        ))}
                    </div>
                    {accessMode === 'password' && (
                        <Input
                            label="Store password"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Set or replace the shared password"
                        />
                    )}
                    <Input
                        label="Access message"
                        value={accessMessage}
                        onChange={(event) => setAccessMessage(event.target.value)}
                        placeholder="Optional message for gated storefront visitors"
                    />
                    <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                        <Button loading={savingAccess} onClick={() => void saveAccess()}>Save access</Button>
                        <Button variant="secondary" loading={creatingPreview} onClick={() => void createPreviewLink()}>Create preview link</Button>
                    </div>
                    {previewToken && (
                        <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
                            <RecordRow label="Preview URL" value={`https://${previewHost}/?lb_preview=${previewToken}`} onCopy={copy} />
                        </div>
                    )}
                </Section>
            </Card>
        </SettingsPane>
    )
}

function RecordRow({ label, value, onCopy }: { label: string; value: string; onCopy: (value: string) => Promise<void> }) {
    return (
        <div className="flex flex-col gap-[var(--lb-space-2)] md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
                <p className="text-[var(--lb-font-size-caption)] text-[var(--lb-color-text-subdued)]">{label}</p>
                <code className="block truncate rounded-[var(--lb-radius-sm)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-text)]">
                    {value}
                </code>
            </div>
            <Button variant="secondary" onClick={() => void onCopy(value)}>Copy</Button>
        </div>
    )
}
