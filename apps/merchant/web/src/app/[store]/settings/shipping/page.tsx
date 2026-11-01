'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge, Banner, Button, Card, ConfirmDialog,  Globe, Input, Plus, ProviderModeBadge, Section, Skeleton, Truck, useToast } from '@letbuyy/ui'
import type { ShippingZone as CanonicalShippingZone, ShippingRate as CanonicalShippingRate } from '@letbuyy/shared-types'
import { CreateShippingRateSchema, UpdateShippingRateSchema } from '@letbuyy/checkout-core'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'
import { SettingsPane } from '@/components/settings/SettingsPane'
import { ShippingProfiles } from '@/components/settings/ShippingProfiles'
import { ShippingCapabilitiesSchema, ShippingProfileSchema, type ShippingProfile } from '@letbuyy/shared-types'

type ShippingZone = Pick<CanonicalShippingZone, 'id' | 'name' | 'countries' | 'states' | 'zip_codes' | 'cod_enabled' | 'profile_id'>
type ShippingRate = Pick<CanonicalShippingRate, 'id' | 'zone_id' | 'name' | 'price' | 'type' | 'min_order_amount' | 'max_order_amount' | 'min_weight_grams' | 'max_weight_grams' | 'estimated_days_min' | 'estimated_days_max' | 'cod_enabled' | 'is_active'>

interface AddRateFormState {
    zoneId: string
    id?: string
    type: ShippingRate['type']
    min_order_amount: string
    max_order_amount: string
    min_weight_grams: string
    max_weight_grams: string
    estimated_days_min: string
    estimated_days_max: string
    cod_enabled: boolean
    is_active: boolean
    name: string
    price: string
    saving: boolean
    error: string | null
}

type ShippingPayload = {
    data?: unknown
    error?: string | { message?: string }
}


type SaveState = 'saved' | 'unsaved' | 'saving'
type FormMode = 'add' | 'edit' | null

function getPayloadError(payload: ShippingPayload | null, fallback: string) {
    if (!payload?.error) return fallback
    return typeof payload.error === 'string' ? payload.error : payload.error.message || fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function readString(value: unknown, fallback = '') {
    return typeof value === 'string' ? value : fallback
}

function coerceNumber(value: unknown) {
    const amount = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
    return Number.isFinite(amount) ? amount : 0
}

function normalizeCountries(value: unknown) {
    if (Array.isArray(value)) return value.filter((country): country is string => typeof country === 'string' && country.trim().length > 0)
    if (typeof value === 'string') return value.split(',').map((country) => country.trim()).filter(Boolean)
    return []
}

function normalizeZones(value: unknown): ShippingZone[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((zone) => {
        if (!isRecord(zone) || typeof zone.id !== 'string' || !zone.id) return []

        return [{
            id: zone.id,
            name: readString(zone.name, 'Unnamed zone'),
            countries: normalizeCountries(zone.countries),
            states: normalizeCountries(zone.states), zip_codes: normalizeCountries(zone.zip_codes),
            cod_enabled: zone.cod_enabled !== false, profile_id: typeof zone.profile_id === 'string' ? zone.profile_id : null,
        }]
    })
}

function normalizeRates(value: unknown): ShippingRate[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((rate) => {
        if (!isRecord(rate) || typeof rate.id !== 'string' || !rate.id || typeof rate.zone_id !== 'string' || !rate.zone_id) return []

        return [{
            id: rate.id,
            zone_id: rate.zone_id,
            name: readString(rate.name, 'Delivery rate'),
            price: coerceNumber(rate.price),
            min_order_amount: rate.min_order_amount == null ? null : coerceNumber(rate.min_order_amount),
            max_order_amount: rate.max_order_amount == null ? null : coerceNumber(rate.max_order_amount),
            min_weight_grams: rate.min_weight_grams == null ? null : coerceNumber(rate.min_weight_grams),
            max_weight_grams: rate.max_weight_grams == null ? null : coerceNumber(rate.max_weight_grams),
            estimated_days_min: rate.estimated_days_min == null ? null : coerceNumber(rate.estimated_days_min),
            estimated_days_max: rate.estimated_days_max == null ? null : coerceNumber(rate.estimated_days_max),
            type: rate.type === 'weight_based' || rate.type === 'price_based' || rate.type === 'free' ? rate.type : 'flat',
            cod_enabled: rate.cod_enabled !== false, is_active: rate.is_active !== false,
        }]
    })
}

const rangeFields = ['min_order_amount', 'max_order_amount', 'min_weight_grams', 'max_weight_grams', 'estimated_days_min', 'estimated_days_max'] as const
const rangeLabels = ['Minimum order (₹)', 'Maximum order (₹)', 'Minimum weight (g)', 'Maximum weight (g)', 'Earliest delivery (days)', 'Latest delivery (days)']
function rateForm(zoneId: string, rate?: ShippingRate): AddRateFormState {
    return { zoneId, id: rate?.id, name: rate?.name || '', price: String(rate?.price ?? 0), type: rate?.type || 'flat',
        cod_enabled: rate?.cod_enabled ?? true, is_active: rate?.is_active ?? true,
        ...Object.fromEntries(rangeFields.map(field => [field, rate?.[field] == null ? '' : String(rate[field])])) as Record<typeof rangeFields[number], string>,
        saving: false, error: null }
}

interface ZoneMetricProps {
    icon: ReactNode
    label: string
    value: string
}

function ZoneMetric({ icon, label, value }: ZoneMetricProps) {
    return (
        <div className="flex min-w-0 items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
            <span className="flex h-[var(--lb-size-control-md)] w-[var(--lb-size-control-md)] shrink-0 items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                {icon}
            </span>
            <span className="min-w-0 space-y-[var(--lb-space-1)]">
                <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                    {label}
                </span>
                <span className="block truncate text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                    {value}
                </span>
            </span>
        </div>
    )
}

function formatCountries(countries: string[]) {
    return countries.length > 0 ? countries.join(', ') : 'No countries assigned'
}

export default function ShippingSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [zones, setZones] = useState<ShippingZone[]>([])
    const [rates, setRates] = useState<ShippingRate[]>([])
    const [profiles,setProfiles]=useState<ShippingProfile[]>([])
    const [providerMode,setProviderMode]=useState<'unavailable' | null>(null)
    const [formProfile,setFormProfile]=useState('')
    const [formMode, setFormMode] = useState<FormMode>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formName, setFormName] = useState('')
    const [formCountries, setFormCountries] = useState('India')
    const [formStates, setFormStates] = useState('')
    const [formPins, setFormPins] = useState('')
    const [formCod, setFormCod] = useState(true)
    const [formError, setFormError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [zoneToDelete, setZoneToDelete] = useState<ShippingZone | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const activeSaveState: SaveState = saveState === 'saving' ? 'saving' : formMode ? 'unsaved' : 'saved'
    const totalRates = useMemo(() => rates.length, [rates])
    const [addRateForm, setAddRateForm] = useState<AddRateFormState | null>(null)
    const [deletingRateId, setDeletingRateId] = useState<string | null>(null)

    const beginRead = useReadRequest(store)
    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        const request = beginRead()
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/shipping/zones`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = (await response.json().catch(() => null)) as ShippingPayload | null
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to load shipping settings'))
            }

            const data = isRecord(payload?.data) ? payload.data : {}
            setZones(normalizeZones(data.zones))
            setRates(normalizeRates(data.rates))
            const checked=ShippingProfileSchema.array().safeParse(data.profiles)
            if(!checked.success)throw new Error('Shipping profiles could not be verified. Please reload settings.')
            setProfiles(checked.data)
            if (!ShippingCapabilitiesSchema.safeParse(data.capabilities).success) {
                throw new Error('Carrier setup status could not be verified. Please reload settings.')
            }
            if (data.provider_mode !== 'unavailable') throw new Error('Carrier connection status could not be verified. Please reload settings.')
            setProviderMode(data.provider_mode)
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load shipping settings'
            setLoadError(message)
            notify({
                title: 'Shipping settings could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void loadData()
    }, [loadData])

    const resetForm = useCallback(() => {
        setFormMode(null)
        setEditingId(null)
        setFormName('')
        setFormCountries('India')
        setFormStates('')
        setFormPins('')
        setFormCod(true)
        setFormProfile('')
        setFormError(null)
        setSaveState('saved')
    }, [])

    const startAdd = useCallback(() => {
        setFormMode('add')
        setEditingId(null)
        setFormName('')
        setFormCountries('India')
        setFormStates('')
        setFormPins('')
        setFormCod(true)
        setFormProfile('')
        setFormError(null)
        setSaveState('unsaved')
    }, [])

    const startEdit = useCallback((zone: ShippingZone) => {
        setFormMode('edit')
        setEditingId(zone.id)
        setFormName(zone.name)
        setFormCountries((zone.countries || []).join(', '))
        setFormStates((zone.states || []).join(', '))
        setFormPins((zone.zip_codes || []).join(', '))
        setFormCod(zone.cod_enabled)
        setFormProfile(zone.profile_id || '')
        setFormError(null)
        setSaveState('unsaved')
    }, [])

    const handleSaveZone = useCallback(async () => {
        if (!formMode || saveState === 'saving') return

        const name = formName.trim()
        const countries = formCountries.split(',').map((country) => country.trim()).filter(Boolean)

        if (!name) {
            const message = 'Enter a shipping zone name.'
            setFormError(message)
            notify({
                title: 'Shipping zone needs a name',
                description: message,
                variant: 'warning',
            })
            return
        }

        if (formMode === 'edit' && !editingId) {
            const message = 'Select a shipping zone before updating.'
            setFormError(message)
            notify({
                title: 'Shipping zone could not be updated',
                description: message,
                variant: 'critical',
            })
            return
        }

        setSaveState('saving')
        setFormError(null)

        const endpoint = formMode === 'edit'
            ? `/api/stores/${encodeURIComponent(store)}/shipping/zones/${encodeURIComponent(editingId as string)}`
            : `/api/stores/${encodeURIComponent(store)}/shipping/zones`

        try {
            const response = await fetch(endpoint, {
                method: formMode === 'edit' ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, countries, states: formStates.split(',').map(value => value.trim()).filter(Boolean), zip_codes: formPins.split(',').map(value => value.trim()).filter(Boolean), cod_enabled: formCod, profile_id:formProfile || null }),
            })
            const payload = (await response.json().catch(() => null)) as ShippingPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to save shipping zone'))
            }

            const action = formMode === 'edit' ? 'updated' : 'created'
            resetForm()
            await loadData({ quiet: true })
            notify({
                title: `Shipping zone ${action}`,
                description: `${name} is ready for delivery rates and storefront checkout.`,
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save shipping zone'
            setFormError(message)
            setSaveState('unsaved')
            notify({
                title: 'Could not save shipping zone',
                description: message,
                variant: 'critical',
            })
        }
    }, [editingId, formCountries, formStates, formPins, formCod, formProfile, formMode, formName, loadData, notify, resetForm, saveState, store])

    const handleConfirmDelete = useCallback(async () => {
        if (!zoneToDelete || deletingId) return

        setDeletingId(zoneToDelete.id)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/shipping/zones/${encodeURIComponent(zoneToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = (await response.json().catch(() => null)) as ShippingPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to delete shipping zone'))
            }

            setZones((current) => current.filter((zone) => zone.id !== zoneToDelete.id))
            setRates((current) => current.filter((rate) => rate.zone_id !== zoneToDelete.id))
            notify({
                title: 'Shipping zone deleted',
                description: `${zoneToDelete.name} was removed from delivery options.`,
                variant: 'success',
            })
            setZoneToDelete(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete shipping zone'
            notify({
                title: 'Could not delete shipping zone',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeletingId(null)
        }
    }, [deletingId, notify, store, zoneToDelete])

    const handleAddRate = useCallback(async () => {
        if (!addRateForm || addRateForm.saving) return
        const name = addRateForm.name.trim()
        const price = parseFloat(addRateForm.price)

        const bounds = Object.fromEntries(rangeFields.map(field => [field, addRateForm[field] === '' ? (addRateForm.id ? null : undefined) : Number(addRateForm[field])]))
        const command = { name, price: addRateForm.type === 'free' ? 0 : price, type: addRateForm.type,
            cod_enabled: addRateForm.cod_enabled, is_active: addRateForm.is_active, ...bounds }
        const parsed = addRateForm.id ? UpdateShippingRateSchema.safeParse(command) : CreateShippingRateSchema.safeParse({ ...command, zone_id: addRateForm.zoneId })
        if (!parsed.success) {
            setAddRateForm(prev => prev ? { ...prev, error: parsed.error.issues[0]?.message || 'Review the rate settings.' } : null)
            return
        }

        setAddRateForm(prev => prev ? { ...prev, saving: true, error: null } : null)

        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/shipping/rates${addRateForm.id ? `/${encodeURIComponent(addRateForm.id)}` : ''}`,
                {
                    method: addRateForm.id ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsed.data),
                }
            )
            const payload = (await response.json().catch(() => null)) as ShippingPayload | null

            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to add rate'))

            setAddRateForm(null)
            await loadData({ quiet: true })
            notify({ title: addRateForm.id ? 'Shipping rate updated' : 'Shipping rate added', description: `${name} will appear in checkout.`, variant: 'success' })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to add rate'
            setAddRateForm(prev => prev ? { ...prev, saving: false, error: message } : null)
            notify({ title: 'Could not add rate', description: message, variant: 'critical' })
        }
    }, [addRateForm, loadData, notify, store])

    const handleDeleteRate = useCallback(async (rateId: string, rateName: string) => {
        if (deletingRateId) return
        setDeletingRateId(rateId)
        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/shipping/rates/${encodeURIComponent(rateId)}`,
                { method: 'DELETE' }
            )
            const payload = (await response.json().catch(() => null)) as ShippingPayload | null
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to delete rate'))

            setRates(current => current.filter(r => r.id !== rateId))
            notify({ title: 'Shipping rate removed', description: `${rateName} removed from checkout.`, variant: 'success' })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete rate'
            notify({ title: 'Could not remove rate', description: message, variant: 'critical' })
        } finally {
            setDeletingRateId(null)
        }
    }, [deletingRateId, notify, store])

    if (loading) {
        return (
            <SettingsPane
                navigationKey="shipping"
                title="Shipping and delivery"
                description="Define delivery zones and rate coverage for checkout."
                store={store}
            >
                <Card>
                    <Section title="Shipping zones">
                        <Skeleton variant="table" lines={4} />
                    </Section>
                </Card>
            </SettingsPane>
        )
    }

    return (
        <>
            <SettingsPane
                navigationKey="shipping"
                title="Shipping and delivery"
                description="Define delivery zones and rate coverage for checkout."
                store={store}
                guidance={{
                    title: 'Checkout impact',
                    body: 'Shipping zones define regional coverage. Delivery rates attached to each zone are shown during checkout based on the customer delivery address.',
                }}
                primaryAction={{
                    label: 'Add zone',
                    onClick: startAdd,
                    disabled: Boolean(formMode),
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                saveBar={{
                    state: activeSaveState,
                    onSave: () => void handleSaveZone(),
                    onDiscard: resetForm,
                    saveLabel: formMode === 'edit' ? 'Update zone' : 'Add zone',
                }}
            >
                {loadError && (
                    <Banner
                        variant="critical"
                        title="Shipping settings could not load"
                        action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                    >
                        {loadError}
                    </Banner>
                )}

                <ShippingProfiles key={store} store={store} profiles={profiles} onChanged={()=>loadData({quiet:true})}/>
                {formError && (
                    <Banner variant="critical" title="Shipping zone needs attention">
                        {formError}
                    </Banner>
                )}

                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                    <ZoneMetric
                        icon={<Truck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                        label="Shipping zones"
                        value={`${zones.length} configured`}
                    />
                    <ZoneMetric
                        icon={<Globe className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                        label="Countries"
                        value={`${new Set(zones.flatMap(zone => zone.countries.map(country => ['in','india'].includes(country.toLowerCase()) ? 'IN' : country.toUpperCase()))).size} configured`}
                    />
                    <ZoneMetric
                        icon={<Truck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                        label="Delivery rates"
                        value={`${totalRates} rate${totalRates === 1 ? '' : 's'}`}
                    />
                </div>

                <Card><Section title="How you fulfill orders" description="Delivery prices at checkout are separate from courier booking charges and COD remittance.">
                    <div className="mb-[var(--lb-space-3)] flex items-center gap-[var(--lb-space-2)]"><span className="text-sm font-medium">Carrier connection</span><ProviderModeBadge mode={providerMode} /></div>
                    <div className="grid gap-[var(--lb-space-3)] lg:grid-cols-3">
                        {[
                            { name: 'Manual shipping', status: 'Available', description: 'Use your own courier or delivery team. Configure the zones and rates below, then add real tracking details when fulfilling orders.' },
                            { name: 'LetBuyy Shipping', status: 'Integration pending', description: 'Built-in carrier booking through LetBuyy. Carrier agreement, billing terms, pickup access and real shipment verification must be completed before activation.' },
                            { name: 'Your Shiprocket account', status: 'Integration pending', description: 'Connect your own account through the first-party Shiprocket app once available. Your account will own courier charges, pickup locations and carrier remittance.' },
                        ].map(method => <div key={method.name} className="space-y-[var(--lb-space-2)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] p-[var(--lb-space-4)]">
                            <h3 className="font-semibold">{method.name}</h3>
                            <Badge label={method.status} variant={method.status === 'Available' ? 'success' : 'warning'} />
                            <p className="text-sm text-[var(--lb-color-text-subdued)]">{method.description}</p>
                        </div>)}
                    </div>
                </Section></Card>

                {formMode && (
                    <Card>
                        <Section
                            title={formMode === 'edit' ? 'Edit shipping zone' : 'Add shipping zone'}
                            description="Configure Indian delivery coverage. Empty state and PIN lists cover all addresses within India."
                        >
                            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                <label className="space-y-[var(--lb-space-2)]"><span className="block text-sm font-medium">Shipping profile</span><select aria-label="Shipping profile" value={formProfile} onChange={event=>setFormProfile(event.target.value)} className="w-full rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)]"><option value="">Store default / general products</option>{profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
                                <Input
                                    label="Zone name"
                                    value={formName}
                                    onChange={(event) => setFormName(event.target.value)}
                                    placeholder="e.g. South India"
                                    helperText="Use a merchant-friendly name for fulfilment teams."
                                />
                                <Input
                                    label="Countries"
                                    value={formCountries}
                                    onChange={(event) => setFormCountries(event.target.value)}
                                    placeholder="India"
                                    helperText="India is supported. International delivery is unavailable." disabled
                                />
                                <Input label="States" value={formStates} onChange={event => setFormStates(event.target.value)} helperText="Comma-separated state names or numeric GST state codes. Empty covers all states." />
                                <Input label="PIN codes" value={formPins} onChange={event => setFormPins(event.target.value)} helperText="Comma-separated six-digit PINs. Empty covers every PIN in the selected states." />
                                <label><Input unstyled type="checkbox" checked={formCod} onChange={event => setFormCod(event.target.checked)} /> Allow cash on delivery in this zone</label>
                            </div>
                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                <Button type="button" onClick={() => void handleSaveZone()} loading={saveState === 'saving'}>
                                    {formMode === 'edit' ? 'Update zone' : 'Add zone'}
                                </Button>
                                <Button type="button" variant="secondary" onClick={resetForm} disabled={saveState === 'saving'}>
                                    Cancel
                                </Button>
                            </div>
                        </Section>
                    </Card>
                )}

                <Card>
                    <Section
                        title="Shipping zones"
                        description="Customers see delivery options based on the zone that matches their address."
                        action={!formMode && (
                            <Button type="button" variant="secondary" onClick={startAdd}>
                                <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Add zone
                            </Button>
                        )}
                    >
                        {zones.length === 0 ? (
                            <EmptyState scene="shipping"
                                icon={<Truck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                title="No shipping zones configured"
                                body="Create Indian delivery zones and add rates so checkout can offer delivery to eligible addresses."
                                primaryAction={!formMode ? <Button type="button" onClick={startAdd}>Add zone</Button> : undefined}
                            />
                        ) : (
                            <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                                {zones.map((zone) => {
                                    const zoneRates = rates.filter((rate) => rate.zone_id === zone.id)
                                    const isAddingRateHere = addRateForm?.zoneId === zone.id
                                    return (
                                        <div key={zone.id} className="flex flex-col gap-[var(--lb-space-3)] p-[var(--lb-space-4)]">
                                            <div className="flex flex-col gap-[var(--lb-space-4)] md:flex-row md:items-center md:justify-between">
                                                <div className="min-w-0 space-y-[var(--lb-space-2)]">
                                                    <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                        <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                            {zone.name}
                                                        </h3>
                                                        <Badge label={`${zoneRates.length} rate${zoneRates.length === 1 ? '' : 's'}`} variant={zoneRates.length > 0 ? 'success' : 'warning'} />
                                                    </div>
                                                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                        {formatCountries(zone.countries || [])} · {zone.states.length ? zone.states.join(', ') : 'All states'} · {zone.zip_codes.length ? `${zone.zip_codes.length} PIN codes` : 'All PIN codes'}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                                    <Button type="button" variant="secondary" size="sm"
                                                        onClick={() => setAddRateForm(isAddingRateHere ? null : rateForm(zone.id))}
                                                        disabled={Boolean(formMode)}
                                                    >
                                                        {isAddingRateHere ? 'Cancel' : 'Add rate'}
                                                    </Button>
                                                    <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(zone)} disabled={Boolean(formMode)}>
                                                        Edit
                                                    </Button>
                                                    <Button type="button" variant="destructive" size="sm" onClick={() => setZoneToDelete(zone)} disabled={deletingId === zone.id}>
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Rate rows */}
                                            {zoneRates.length > 0 && (
                                                <div className="ml-[var(--lb-space-2)] divide-y divide-[var(--lb-color-border)] rounded-lg border border-[var(--lb-color-border)]">
                                                    {zoneRates.map(rate => (
                                                        <div key={rate.id} className="flex items-center justify-between gap-[var(--lb-space-3)] px-[var(--lb-space-3)] py-[var(--lb-space-2)]">
                                                            <div className="text-[var(--lb-font-size-body)] text-[var(--lb-color-text)]"><span className="block">{rate.name}</span><span className="block text-xs text-[var(--lb-color-text-subdued)]">{rate.type.replace('_', ' ')} · {rate.is_active ? 'Active' : 'Inactive'} · {rate.cod_enabled ? 'COD enabled' : 'Prepaid only'}{rate.estimated_days_min != null ? ` · ${rate.estimated_days_min}–${rate.estimated_days_max ?? rate.estimated_days_min} days (estimate)` : ''}</span></div>
                                                            <div className="flex items-center gap-[var(--lb-space-3)]">
                                                                <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                                                                    {rate.price === 0 ? 'Free' : `₹${rate.price.toLocaleString('en-IN')}`}
                                                                </span>
                                                                <Button type="button" variant="secondary" size="sm" onClick={() => setAddRateForm(rateForm(zone.id, rate))}>Edit rate</Button>
                                                                <Button type="button" variant="destructive" size="sm"
                                                                    onClick={() => void handleDeleteRate(rate.id, rate.name)}
                                                                    disabled={deletingRateId === rate.id}
                                                                >
                                                                    {deletingRateId === rate.id ? 'Removing' : 'Remove'}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Add rate inline form */}
                                            {isAddingRateHere && addRateForm && (
                                                <div className="ml-[var(--lb-space-2)] rounded-lg border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                                                    {addRateForm.error && (
                                                        <p className="mb-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] text-[var(--lb-color-critical)]">{addRateForm.error}</p>
                                                    )}
                                                    <div className="flex flex-wrap items-end gap-[var(--lb-space-2)]">
                                                        <Input
                                                            label="Rate name"
                                                            value={addRateForm.name}
                                                            onChange={e => setAddRateForm(prev => prev ? { ...prev, name: e.target.value } : null)}
                                                            placeholder="e.g. Standard delivery"
                                                        />
                                                        <Input
                                                            label="Price (₹, 0 for free)"
                                                            value={addRateForm.price}
                                                            onChange={e => setAddRateForm(prev => prev ? { ...prev, price: e.target.value } : null)}
                                                            placeholder="99"
                                                            type="number"
                                                            min={0}
                                                        />
                                                        <label className="space-y-2"><span className="block text-sm">Rate type</span><select aria-label="Rate type" className="rounded-lg border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-3" value={addRateForm.type} onChange={event => setAddRateForm(previous => previous ? { ...previous, type: event.target.value as ShippingRate['type'] } : null)}><option value="flat">Flat rate</option><option value="free">Free delivery</option><option value="price_based">Order value range</option><option value="weight_based">Weight range</option></select></label>
                                                        {rangeFields.map((field, index) => <Input key={field} label={rangeLabels[index]} type="number" min={0} step={field.includes('amount') ? '0.01' : '1'} value={addRateForm[field]} onChange={event => setAddRateForm(previous => previous ? { ...previous, [field]: event.target.value } : null)} helperText="Optional. Empty means no limit." />)}
                                                        <label><Input unstyled type="checkbox" checked={addRateForm.cod_enabled} onChange={event => setAddRateForm(previous => previous ? { ...previous, cod_enabled: event.target.checked } : null)} /> Cash on delivery</label>
                                                        <label><Input unstyled type="checkbox" checked={addRateForm.is_active} onChange={event => setAddRateForm(previous => previous ? { ...previous, is_active: event.target.checked } : null)} /> Active</label>
                                                        <Button type="button" onClick={() => void handleAddRate()} loading={addRateForm.saving}>
                                                            {addRateForm.id ? 'Save rate' : 'Add rate'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </Section>
                </Card>
            </SettingsPane>

            <ConfirmDialog
                open={Boolean(zoneToDelete)}
                title="Delete shipping zone?"
                description={zoneToDelete ? `Delete ${zoneToDelete.name} and remove its delivery rates from checkout.` : 'Delete this shipping zone.'}
                confirmLabel={deletingId ? 'Deleting' : 'Delete zone'}
                destructive
                onConfirm={() => void handleConfirmDelete()}
                onClose={() => {
                    if (!deletingId) setZoneToDelete(null)
                }}
            />
        </>
    )
}
