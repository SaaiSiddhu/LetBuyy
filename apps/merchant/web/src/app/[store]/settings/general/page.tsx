'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { getAccountsUrl, getStorefrontRootDomain } from '@/lib/public-urls'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { DEFAULT_ADMIN_LOCALE, SUPPORTED_ADMIN_LOCALES, getAdminLocaleOptions, normalizeAdminLocale } from '@/lib/i18n/admin-locales'
import {
    Section,
    Card,
    Banner,
    Button,
    CheckCircle2,
    ConfirmDialog,
    Eye,
    EyeOff,
    Globe,
    Input,
    Plus,
    Select,
    Skeleton,
    Switch,
    Textarea,
    Trash2,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'
import { gstStateCodeFromName } from '@/lib/india/gst-states'
import { businessProfileForStorePatch } from '@/lib/store-profile-business'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeneralData {
    id: string
    store_name: string
    site_type: string
    subdomain: string
    // Editable store-level
    name: string
    tagline: string
    description: string
    currency: string
    locale: string
    timezone: string
    seo_title: string
    seo_description: string
    // Contact (from business_profile)
    contact_email: string
    contact_phone: string
    contact_website: string
    public_contact_enabled: boolean
    // Address (from invoice_address)
    address_line1: string
    address_line2: string
    address_city: string
    address_state: string
    address_zip: string
    address_country: string
}

type SaveState = 'saved' | 'unsaved' | 'saving'

type ApiPayload = { data?: unknown; error?: string | { message?: string } }

interface StorefrontLocaleItem {
    id: string
    locale: string
    name: string
    status: 'draft' | 'published' | 'archived'
    is_default: boolean
}

interface LocalizationSummary {
    default_locale: string
    currency: string
    timezone: string
    locales: StorefrontLocaleItem[]
    schema_ready: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EDITABLE_KEYS: ReadonlyArray<keyof GeneralData> = [
    'name', 'tagline', 'description', 'currency', 'locale', 'timezone',
    'seo_title', 'seo_description',
    'contact_email', 'contact_phone', 'contact_website', 'public_contact_enabled',
    'address_line1', 'address_line2', 'address_city', 'address_state', 'address_zip', 'address_country',
]

const EMPTY: GeneralData = {
    id: '', store_name: '', site_type: 'store', subdomain: '',
    name: '', tagline: '', description: '',
    currency: 'INR', locale: DEFAULT_ADMIN_LOCALE, timezone: 'Asia/Kolkata',
    seo_title: '', seo_description: '',
    contact_email: '', contact_phone: '', contact_website: '',
    public_contact_enabled: false,
    address_line1: '', address_line2: '', address_city: '', address_state: '', address_zip: '', address_country: 'IN',
}

const CURRENCY_OPTIONS = [
    { value: 'INR', label: 'Indian Rupee (INR ₹)' },
]

const TIMEZONE_OPTIONS = [
    { value: 'Asia/Kolkata', label: '(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi' },
]

const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

const COUNTRY_OPTIONS = [
    { value: 'IN', label: 'India' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function rs(record: Record<string, unknown>, key: string, fallback = '') {
    const v = record[key]
    return typeof v === 'string' ? v : fallback
}

function getPayloadError(payload: ApiPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

function formatSiteType(value: string) {
    return value.split(/[-_]/).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join(' ') || 'Store'
}

function localeDisplayName(code: string): string {
    const meta = SUPPORTED_ADMIN_LOCALES.find((l) => l.code === code)
    return meta ? meta.language : code
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GeneralSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()

    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [initialData, setInitialData] = useState<GeneralData | null>(null)
    const [data, setData] = useState<GeneralData>(EMPTY)
    const [version, setVersion] = useState<number | null>(null)
    // Raw nested objects preserved for safe merge on PATCH
    const [rawBP, setRawBP] = useState<Record<string, unknown>>({})
    const [rawAddr, setRawAddr] = useState<Record<string, unknown>>({})

    // Languages & localization (live, store-scoped via /localization endpoints)
    const [localization, setLocalization] = useState<LocalizationSummary | null>(null)
    const [localeBusy, setLocaleBusy] = useState<Record<string, boolean>>({})
    const [addLocaleCode, setAddLocaleCode] = useState('')
    const [addingLocale, setAddingLocale] = useState(false)

    const localeOptions = useMemo(() => getAdminLocaleOptions(), [])
    const stateOptions = useMemo(() => [
        { value: '', label: 'Select state…' },
        ...INDIAN_STATES.map(s => ({ value: s, label: s })),
    ], [])

    const hasUnsavedChanges = useMemo(() => {
        if (!initialData) return false
        return EDITABLE_KEYS.some(k => data[k] !== initialData[k])
    }, [data, initialData])

    const activeSaveState: SaveState = saveState === 'saving' ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

    // ── Load ──────────────────────────────────────────────────────────────────

    const beginLocalization = useReadRequest(store)
    const reloadLocalization = useCallback(async (signal?: AbortSignal) => {
        const request = beginLocalization()
        const readSignal = signal ? AbortSignal.any([signal, request.signal]) : request.signal
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/localization`, { cache: 'no-store', signal: readSignal })
            const payload = await res.json().catch(() => null) as ApiPayload | null
            if (signal?.aborted || !request.isCurrent()) return
            if (res.ok && isRecord(payload?.data)) setLocalization(payload.data as unknown as LocalizationSummary)
        } catch {
            /* localization is best-effort and must never block the page */
        }
    }, [beginLocalization, store])

    const beginLoad = useReadRequest(store)
    const loadData = useCallback(async (signal?: AbortSignal) => {
        const request = beginLoad()
        const readSignal = signal ? AbortSignal.any([signal, request.signal]) : request.signal
        setLoading(true)
        setLoadError(null)
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, { cache: 'no-store', signal: readSignal })
            const payload = await res.json().catch(() => null) as ApiPayload | null
            if (signal?.aborted || !request.isCurrent()) return
            if (!res.ok) throw new Error(getPayloadError(payload, 'Unable to load store details'))

            const d = isRecord(payload?.data) ? payload.data : null
            if (!d) throw new Error('Store details were not returned')
            if (typeof d.version !== 'number') throw new Error('Store revision was not returned')
            setVersion(d.version)

            const bp = isRecord(d.business_profile) ? d.business_profile : {}
            const addr = isRecord(d.invoice_address) ? d.invoice_address : {}
            setRawBP(bp)
            setRawAddr(addr)

            const next: GeneralData = {
                id: rs(d, 'id'),
                store_name: rs(d, 'store_name'),
                site_type: rs(d, 'site_type', 'store'),
                subdomain: rs(d, 'subdomain', rs(d, 'store_name')),
                name: rs(d, 'name', rs(d, 'store_name')),
                tagline: rs(d, 'tagline'),
                description: rs(d, 'description'),
                currency: rs(d, 'currency', 'INR'),
                locale: normalizeAdminLocale(rs(d, 'locale', DEFAULT_ADMIN_LOCALE)),
                timezone: rs(d, 'timezone', 'Asia/Kolkata'),
                seo_title: rs(d, 'meta_title', rs(d, 'seo_title')),
                seo_description: rs(d, 'meta_description', rs(d, 'seo_description')),
                contact_email: rs(bp, 'email'),
                contact_phone: rs(bp, 'phone'),
                contact_website: rs(bp, 'website'),
                public_contact_enabled: bp.public_contact_enabled === true,
                address_line1: rs(addr, 'line1'),
                address_line2: rs(addr, 'line2'),
                address_city: rs(addr, 'city'),
                address_state: rs(addr, 'state'),
                address_zip: rs(addr, 'zip'),
                address_country: rs(addr, 'country', 'IN'),
            }
            setData(next)
            setInitialData(next)
            setSaveState('saved')
            void reloadLocalization(signal)
        } catch (err) {
            if (signal?.aborted || !request.isCurrent()) return
            const msg = err instanceof Error ? err.message : 'Unable to load store details'
            setLoadError(msg)
            notify({ title: 'Could not load store settings', description: msg, variant: 'critical' })
        } finally {
            if (!signal?.aborted && request.isCurrent()) setLoading(false)
        }
    }, [beginLoad, notify, store, reloadLocalization])

    useEffect(() => {
        const ctrl = new AbortController()
        void loadData(ctrl.signal)
        return () => ctrl.abort()
    }, [loadData])

    // ── Field update ──────────────────────────────────────────────────────────

    const set = useCallback(<K extends keyof GeneralData>(key: K, value: GeneralData[K]) => {
        setData(cur => ({ ...cur, [key]: value }))
    }, [])

    // ── Save ──────────────────────────────────────────────────────────────────

    const handleSave = useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault()
        if (!hasUnsavedChanges || saveState === 'saving') return
        if (version === null) {
            notify({ title: 'Reload required', description: 'Store revision is unavailable. Reload before saving.', variant: 'warning' })
            return
        }
        setSaveState('saving')
        try {
            const businessProfile = businessProfileForStorePatch(rawBP)
            for (const [key, value] of [
                ['email', data.contact_email], ['phone', data.contact_phone], ['website', data.contact_website],
            ] as const) {
                if (value.trim()) businessProfile[key] = value.trim()
                else delete businessProfile[key]
            }
            businessProfile.public_contact_enabled = data.public_contact_enabled
            const invoiceAddress: Record<string, unknown> = { ...rawAddr }
            for (const [key, value] of [
                ['line1', data.address_line1], ['line2', data.address_line2],
                ['city', data.address_city], ['state', data.address_state], ['zip', data.address_zip],
            ] as const) {
                if (value.trim()) invoiceAddress[key] = value.trim()
                else delete invoiceAddress[key]
            }
            const stateCode = data.address_country === 'IN' ? gstStateCodeFromName(data.address_state) : ''
            if (stateCode) invoiceAddress.state_code = stateCode
            else delete invoiceAddress.state_code
            invoiceAddress.country = data.address_country || 'IN'
            const body = {
                version,
                name: data.name,
                tagline: data.tagline,
                description: data.description,
                currency: data.currency,
                locale: data.locale,
                timezone: data.timezone,
                seo_title: data.seo_title,
                seo_description: data.seo_description,
                business_profile: businessProfile,
                invoice_address: invoiceAddress,
            }

            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const payload = await res.json().catch(() => null) as ApiPayload | null
            if (!res.ok) throw new Error(getPayloadError(payload, 'Unable to save store settings'))
            const saved = isRecord(payload?.data) ? payload.data : null
            if (typeof saved?.version !== 'number') throw new Error('Save completed but revision readback is unavailable. Reload to confirm current settings.')

            setVersion(saved.version)
            setRawBP(businessProfile)
            setRawAddr(invoiceAddress)
            setInitialData(data)
            setSaveState('saved')
            notify({ title: 'Settings saved', description: 'Store details updated successfully.', variant: 'success' })
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unable to save settings'
            setSaveState('unsaved')
            notify({ title: 'Could not save settings', description: msg, variant: 'critical' })
        }
    }, [data, hasUnsavedChanges, notify, rawAddr, rawBP, saveState, store, version])

    // ── Discard ───────────────────────────────────────────────────────────────

    const handleDiscard = useCallback(() => {
        if (!initialData) return
        setData(initialData)
        setSaveState('saved')
        notify({ title: 'Changes discarded', description: 'Settings reset to the last saved version.', variant: 'info' })
    }, [initialData, notify])

    // ── Delete ────────────────────────────────────────────────────────────────

    const handleDelete = useCallback(async () => {
        if (deleting) return
        setDeleting(true)
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, { method: 'DELETE' })
            const payload = await res.json().catch(() => null) as ApiPayload | null
            if (!res.ok) throw new Error(getPayloadError(payload, 'Unable to delete store'))
            notify({ title: 'Store deletion started', description: 'Redirecting to your workspace…', variant: 'success' })
            window.location.href = getAccountsUrl()
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unable to delete store'
            setDeleting(false)
            setDeleteDialogOpen(false)
            notify({ title: 'Could not delete store', description: msg, variant: 'critical' })
        }
    }, [deleting, notify, store])

    // ── Languages & localization actions (live) ────────────────────────────────

    const addStorefrontLocale = useCallback(async () => {
        if (!addLocaleCode || addingLocale) return
        setAddingLocale(true)
        try {
            const meta = SUPPORTED_ADMIN_LOCALES.find((l) => l.code === addLocaleCode)
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/localization/locales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale: addLocaleCode, name: meta?.language || addLocaleCode, status: 'published' }),
            })
            const payload = await res.json().catch(() => null) as ApiPayload | null
            if (!res.ok) throw new Error(getPayloadError(payload, 'Unable to add language'))
            setAddLocaleCode('')
            await reloadLocalization()
            notify({ title: 'Language added', description: `${meta?.language || addLocaleCode} is now available on your storefront.`, variant: 'success' })
        } catch (err) {
            notify({ title: 'Could not add language', description: err instanceof Error ? err.message : 'Unable to add language', variant: 'critical' })
        } finally {
            setAddingLocale(false)
        }
    }, [addLocaleCode, addingLocale, notify, reloadLocalization, store])

    const toggleLocaleStatus = useCallback(async (item: StorefrontLocaleItem) => {
        setLocaleBusy((c) => ({ ...c, [item.id]: true }))
        try {
            const status = item.status === 'published' ? 'draft' : 'published'
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/localization/locales/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })
            const payload = await res.json().catch(() => null) as ApiPayload | null
            if (!res.ok) throw new Error(getPayloadError(payload, 'Unable to update language'))
            await reloadLocalization()
            notify({ title: status === 'published' ? 'Language published' : 'Language hidden', description: `${item.name} is now ${status === 'published' ? 'visible to customers' : 'hidden from the storefront'}.`, variant: 'info' })
        } catch (err) {
            notify({ title: 'Could not update language', description: err instanceof Error ? err.message : 'Unable to update language', variant: 'critical' })
        } finally {
            setLocaleBusy((c) => ({ ...c, [item.id]: false }))
        }
    }, [notify, reloadLocalization, store])

    const removeLocale = useCallback(async (item: StorefrontLocaleItem) => {
        setLocaleBusy((c) => ({ ...c, [item.id]: true }))
        try {
            const res = await fetch(`/api/stores/${encodeURIComponent(store)}/localization/locales/${item.id}`, { method: 'DELETE' })
            const payload = await res.json().catch(() => null) as ApiPayload | null
            if (!res.ok) throw new Error(getPayloadError(payload, 'Unable to remove language'))
            await reloadLocalization()
            notify({ title: 'Language removed', description: `${item.name} is no longer offered on your storefront.`, variant: 'info' })
        } catch (err) {
            notify({ title: 'Could not remove language', description: err instanceof Error ? err.message : 'Unable to remove language', variant: 'critical' })
        } finally {
            setLocaleBusy((c) => ({ ...c, [item.id]: false }))
        }
    }, [notify, reloadLocalization, store])

    // ── Skeleton ──────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <SettingsPane navigationKey="general" title="General" description="Store identity, contact details, address, defaults, and SEO." store={store}>
                <div className="settings-general-stack">
                    {[1, 2, 3, 4].map(i => (
                        <Card key={i}>
                            <Section><Skeleton variant="text" lines={1} /></Section>
                            <div className="settings-form-body"><Skeleton variant="text" lines={3} /></div>
                        </Card>
                    ))}
                </div>
            </SettingsPane>
        )
    }

    // ── Render ────────────────────────────────────────────────────────────────

    // Storefront language list: real locale rows, plus a synthetic default row
    // when the store's default locale has no explicit row yet.
    const defaultLocaleCode = localization?.default_locale || data.locale
    const localeRows = localization?.locales || []
    const hasDefaultRow = localeRows.some((l) => l.locale === defaultLocaleCode)
    const displayLocales: StorefrontLocaleItem[] = hasDefaultRow
        ? localeRows
        : [
            { id: '', locale: defaultLocaleCode, name: localeDisplayName(defaultLocaleCode), status: 'published', is_default: true },
            ...localeRows,
        ]
    const usedLocaleCodes = new Set(displayLocales.map((l) => l.locale))
    const addableLocales = SUPPORTED_ADMIN_LOCALES.filter((l) => !usedLocaleCodes.has(l.code))
    const localizationUnavailable = localization !== null && localization.schema_ready === false

    return (
        <>
            <SettingsPane
                navigationKey="general"
                title="General"
                description="Store identity, contact details, address, defaults, and SEO."
                store={store}
                saveBar={{
                    state: activeSaveState,
                    onSave: () => void handleSave(),
                    onDiscard: handleDiscard,
                    saveLabel: 'Save',
                }}
            >
                {loadError && (
                    <Banner
                        variant="critical"
                        title="Settings could not load"
                        action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                    >
                        {loadError}
                    </Banner>
                )}

                <form className="settings-general-stack" onSubmit={handleSave}>

                    {/* ── Store details ────────────────────────────────────── */}
                    <Section variant="grouped" title="Store details" >

                            <div className="settings-form-grid">
                                <Input
                                    label="Store name"
                                    value={data.name}
                                    onChange={e => set('name', e.target.value)}
                                    autoComplete="organization"
                                    placeholder="My Awesome Store"
                                />
                                <Input
                                    label="Store handle"
                                    value={data.store_name}
                                    helperText="This unique identifier cannot be changed."
                                    disabled
                                />
                            </div>
                            <Input
                                label="Tagline"
                                value={data.tagline}
                                onChange={e => set('tagline', e.target.value)}
                                placeholder="A short, catchy description of your store"
                                helperText="Shown on social previews and storefront hero."
                            />
                            <Textarea
                                label="Store description"
                                value={data.description}
                                onChange={e => set('description', e.target.value)}
                                rows={3}
                                placeholder="Tell customers about your business, what you sell, and your story…"
                                helperText="Used for internal reference and some app integrations."
                            />

                    </Section>

                    {/* ── Store contact ─────────────────────────────────────── */}
                    <Section variant="grouped" title="Store contact details" >

                            <div className="settings-general-hint">
                                Contact information used for customer communications, apps, and financial products.
                            </div>
                            <div className="settings-form-grid">
                                <Input
                                    label="Contact email"
                                    type="email"
                                    value={data.contact_email}
                                    onChange={e => set('contact_email', e.target.value)}
                                    placeholder="hello@yourstore.com"
                                    autoComplete="email"
                                />
                                <Input
                                    label="Phone number"
                                    type="tel"
                                    value={data.contact_phone}
                                    onChange={e => set('contact_phone', e.target.value)}
                                    placeholder="+91 98765 43210"
                                    autoComplete="tel"
                                />
                            </div>
                            <Input
                                label="Website"
                                type="url"
                                value={data.contact_website}
                                onChange={e => set('contact_website', e.target.value)}
                                placeholder="https://yourstore.com"
                                helperText="Your primary domain or marketing site (not your LetBuyy storefront)."
                            />
                            <Switch
                                label="Show these contact details on my storefront"
                                description="Off by default. Turning this on publishes only the email, phone, and website above. Legal, tax, and verification details stay private."
                                checked={data.public_contact_enabled}
                                onCheckedChange={value => set('public_contact_enabled', value)}
                            />

                    </Section>

                    {/* ── Store address ─────────────────────────────────────── */}
                    <Section variant="grouped" title="Store address" >

                            <div className="settings-general-hint">
                                Used on invoices, tax documents, and GST filings. Must match your registered business address.
                            </div>
                            <Input
                                label="Address line 1"
                                value={data.address_line1}
                                onChange={e => set('address_line1', e.target.value)}
                                placeholder="Building, street, locality"
                                autoComplete="address-line1"
                            />
                            <Input
                                label="Address line 2"
                                value={data.address_line2}
                                onChange={e => set('address_line2', e.target.value)}
                                placeholder="Apartment, suite, floor (optional)"
                                autoComplete="address-line2"
                            />
                            <div className="settings-form-grid settings-form-grid--3">
                                <Input
                                    label="City"
                                    value={data.address_city}
                                    onChange={e => set('address_city', e.target.value)}
                                    placeholder="Mumbai"
                                    autoComplete="address-level2"
                                />
                                <Select
                                    label="State"
                                    value={data.address_state}
                                    options={stateOptions}
                                    onChange={e => set('address_state', e.target.value)}
                                />
                                <Input
                                    label="PIN code"
                                    value={data.address_zip}
                                    onChange={e => set('address_zip', e.target.value)}
                                    placeholder="400001"
                                    autoComplete="postal-code"
                                    maxLength={10}
                                />
                            </div>
                            <Select
                                label="Country"
                                value={data.address_country}
                                options={COUNTRY_OPTIONS}
                                onChange={e => set('address_country', e.target.value)}
                            />

                    </Section>

                    {/* ── Store defaults ────────────────────────────────────── */}
                    <Section variant="grouped" title="Store defaults" >

                            <div className="settings-form-grid">
                                <Select
                                    label="Currency"
                                    value={data.currency}
                                    options={CURRENCY_OPTIONS}
                                    onChange={e => set('currency', e.target.value)}
                                />
                                <Select
                                    label="Storefront language"
                                    value={data.locale}
                                    options={localeOptions}
                                    onChange={e => set('locale', normalizeAdminLocale(e.target.value))}
                                />
                            </div>
                            <Select
                                label="Time zone"
                                value={data.timezone}
                                options={TIMEZONE_OPTIONS}
                                onChange={e => set('timezone', e.target.value)}
                                helperText="Sets the time for when orders and analytics are recorded."
                            />

                    </Section>

                    {/* ── SEO ──────────────────────────────────────────────── */}
                    <Section variant="grouped" title="Search engine optimization (SEO)" >

                            <div className="settings-general-hint">
                                These defaults appear in search results. Individual pages and products can override them.
                            </div>
                            <Input
                                label="SEO title"
                                value={data.seo_title}
                                onChange={e => set('seo_title', e.target.value)}
                                placeholder="Your Store — Best Products Online"
                                helperText="Recommended: 50–70 characters."
                                maxLength={70}
                            />
                            <Textarea
                                label="SEO description"
                                value={data.seo_description}
                                onChange={e => set('seo_description', e.target.value)}
                                rows={3}
                                placeholder="Discover curated products at your store. Free shipping across India. Shop now."
                                helperText={`Recommended: 120–160 characters. Currently: ${data.seo_description.length} characters.`}
                                maxLength={160}
                            />
                            {data.seo_title || data.seo_description ? (
                                <div className="settings-general-seo-preview" aria-label="Search result preview">
                                    <div className="settings-general-seo-preview-label">Search preview</div>
                                    <div className="settings-general-seo-preview-url">
                                        {data.subdomain}.{getStorefrontRootDomain()}
                                    </div>
                                    <div className="settings-general-seo-preview-title">
                                        {data.seo_title || data.name || data.store_name}
                                    </div>
                                    <div className="settings-general-seo-preview-desc">
                                        {data.seo_description || data.description || 'No description set.'}
                                    </div>
                                </div>
                            ) : null}

                    </Section>

                    {/* Order references are allocated by the database trigger. Invoice prefixes
                        are a separate tax setting on Business details. */}
                    <Section variant="grouped" title="Order reference" >
                        <div className="settings-general-hint">
                            Order references are assigned when an order is placed and appear on orders, customer pages, and notifications.
                        </div>
                        <div className="settings-general-order-example">
                            <span className="settings-general-order-example-label">Format</span>
                            <span className="settings-general-order-example-value">ORD-YYYYMMDD-sequence</span>
                        </div>
                    </Section>

                    {/* ── Site type ─────────────────────────────────────────── */}
                    <Section variant="grouped" title="Site type" >

                            <Input
                                label="Type"
                                value={formatSiteType(data.site_type)}
                                helperText="Changing site type requires a governed migration and is not available from settings."
                                disabled
                            />

                    </Section>
                </form>

                {/* ── Languages & localization ──────────────────────────────── */}
                <Section variant="grouped" title="Languages &amp; localization" >

                        <div className="settings-general-hint">
                            Add the languages your storefront supports. Customers can switch between published
                            languages; the default (set by <strong>Storefront language</strong> above) is shown to
                            new visitors first.
                        </div>

                        {localizationUnavailable ? (
                            <div className="settings-general-hint">
                                Language management is initialising for this store. Save your store defaults once to enable it.
                            </div>
                        ) : (
                            <>
                                <div className="settings-locale-list">
                                    {displayLocales.map((loc) => {
                                        const busy = !!localeBusy[loc.id]
                                        const isPublished = loc.status === 'published'
                                        const synthetic = loc.id === ''
                                        return (
                                            <div key={loc.locale} className="settings-locale-item">
                                                <span className="settings-locale-icon">
                                                    <Globe className="letbuyy-icon" aria-hidden="true" />
                                                </span>
                                                <div className="settings-locale-meta">
                                                    <div className="settings-locale-name-row">
                                                        <span className="settings-locale-name">{loc.name}</span>
                                                        {loc.is_default && (
                                                            <span className="settings-business-tag settings-business-tag--required">Default</span>
                                                        )}
                                                    </div>
                                                    <span className="settings-locale-code">{loc.locale}</span>
                                                </div>
                                                <span className={`settings-business-status settings-business-status--${isPublished ? 'verified' : 'draft'}`}>
                                                    {isPublished
                                                        ? <CheckCircle2 className="letbuyy-icon" aria-hidden="true" />
                                                        : <EyeOff className="letbuyy-icon" aria-hidden="true" />}
                                                    {isPublished ? 'Published' : 'Hidden'}
                                                </span>
                                                {!synthetic && (
                                                    <div className="settings-locale-actions">
                                                        <Button variant="secondary" onClick={() => void toggleLocaleStatus(loc)} loading={busy}>
                                                            {isPublished
                                                                ? <EyeOff className="letbuyy-icon" aria-hidden="true" />
                                                                : <Eye className="letbuyy-icon" aria-hidden="true" />}
                                                            {isPublished ? 'Hide' : 'Publish'}
                                                        </Button>
                                                        {!loc.is_default && (
                                                            <Button variant="ghost" onClick={() => void removeLocale(loc)} loading={busy} aria-label={`Remove ${loc.name}`}>
                                                                <Trash2 className="letbuyy-icon" aria-hidden="true" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {addableLocales.length > 0 && (
                                    <div className="settings-locale-add">
                                        <Select
                                            label="Add a language"
                                            value={addLocaleCode}
                                            options={[
                                                { value: '', label: 'Select a language…' },
                                                ...addableLocales.map((l) => ({ value: l.code, label: `${l.language} (${l.code})` })),
                                            ]}
                                            onChange={(e) => setAddLocaleCode(e.target.value)}
                                        />
                                        <Button variant="primary" onClick={() => void addStorefrontLocale()} loading={addingLocale} disabled={!addLocaleCode}>
                                            <Plus className="letbuyy-icon" aria-hidden="true" />
                                            Add
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}

                </Section>

                {/* ── Danger zone ───────────────────────────────────────────── */}
                <Section variant="grouped" title="Danger zone"  className="settings-home-card--danger">
                    <div className="settings-form-danger-row">
                        <div className="settings-form-danger-copy">
                            <span className="settings-form-danger-title">Delete this store</span>
                            <span className="settings-form-danger-desc">
                                Permanently deletes all products, orders, pages, and settings. This cannot be undone.
                            </span>
                        </div>
                        <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} loading={deleting}>
                            Delete store
                        </Button>
                    </div>
                </Section>
            </SettingsPane>

            <ConfirmDialog
                open={deleteDialogOpen}
                title={`Delete ${data.name || 'this store'}?`}
                description="This permanently deletes the store, products, orders, pages, and settings. This action cannot be undone."
                confirmLabel={deleting ? 'Deleting…' : 'Delete store'}
                destructive
                onClose={() => { if (!deleting) setDeleteDialogOpen(false) }}
                onConfirm={() => void handleDelete()}
            />
        </>
    )
}
