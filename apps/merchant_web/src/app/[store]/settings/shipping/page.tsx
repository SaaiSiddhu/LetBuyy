'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Badge, Banner, Button, ConfirmDialog, EmptyState, Globe, Input, Modal, normalizeProviderMode, Plus, ProviderModeBadge, Section, Skeleton, Truck, useToast, type ProviderMode } from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'

interface ShippingZone {
    id: string
    name: string
    countries: string[]
}

interface ShippingRate {
    id: string
    zone_id: string
    name: string
    price: number
    min_order_amount: number | null
}

interface AddRateFormState {
    zoneId: string
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
        }]
    })
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
    // See orders/page.tsx: unresolved resolves to 'mock', never null/sandbox.
    const [providerMode, setProviderMode] = useState<ProviderMode>('mock')
    const [formMode, setFormMode] = useState<FormMode>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formName, setFormName] = useState('')
    const [formCountries, setFormCountries] = useState('')
    const [formError, setFormError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [zoneToDelete, setZoneToDelete] = useState<ShippingZone | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const totalRates = useMemo(() => rates.length, [rates])
    const [addRateForm, setAddRateForm] = useState<AddRateFormState | null>(null)
    const [deletingRateId, setDeletingRateId] = useState<string | null>(null)

    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/shipping/zones`, {
                cache: 'no-store',
            })
            const payload = (await response.json().catch(() => null)) as ShippingPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to load shipping settings'))
            }

            const data = isRecord(payload?.data) ? payload.data : {}
            setZones(normalizeZones(data.zones))
            setRates(normalizeRates(data.rates))
            setProviderMode(normalizeProviderMode(data.provider_mode))
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load shipping settings'
            setLoadError(message)
            notify({
                title: 'Shipping settings could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadData()
    }, [loadData])

    const resetForm = useCallback(() => {
        setFormMode(null)
        setEditingId(null)
        setFormName('')
        setFormCountries('')
        setFormError(null)
        setSaveState('saved')
    }, [])

    const startAdd = useCallback(() => {
        setFormMode('add')
        setEditingId(null)
        setFormName('')
        setFormCountries('')
        setFormError(null)
        setSaveState('unsaved')
    }, [])

    const startEdit = useCallback((zone: ShippingZone) => {
        setFormMode('edit')
        setEditingId(zone.id)
        setFormName(zone.name)
        setFormCountries((zone.countries || []).join(', '))
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
                body: JSON.stringify({ name, countries }),
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
    }, [editingId, formCountries, formMode, formName, loadData, notify, resetForm, saveState, store])

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

        if (!name || Number.isNaN(price) || price < 0) {
            setAddRateForm(prev => prev ? { ...prev, error: 'Enter a valid rate name and price (0 for free).' } : null)
            return
        }

        setAddRateForm(prev => prev ? { ...prev, saving: true, error: null } : null)

        try {
            const response = await fetch(
                `/api/stores/${encodeURIComponent(store)}/shipping/rates`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ zone_id: addRateForm.zoneId, name, price, type: 'flat' }),
                }
            )
            const payload = (await response.json().catch(() => null)) as ShippingPayload | null

            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to add rate'))

            setAddRateForm(null)
            await loadData({ quiet: true })
            notify({ title: 'Shipping rate added', description: `${name} will appear in checkout.`, variant: 'success' })
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
                title="Shipping and delivery"
                description="Define delivery zones and rate coverage for checkout."
                store={store}
            >
                <Section variant="grouped" title="Shipping zones">
                    <Skeleton variant="table" lines={4} />
                </Section>
            </SettingsPane>
        )
    }

    return (
        <>
            <SettingsPane
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

                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                    <ZoneMetric
                        icon={<Truck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                        label="Shipping zones"
                        value={`${zones.length} configured`}
                    />
                    <ZoneMetric
                        icon={<Globe className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                        label="Country groups"
                        value={`${zones.reduce((total, zone) => total + (zone.countries?.length || 0), 0)} countries`}
                    />
                    <ZoneMetric
                        icon={<Truck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                        label="Delivery rates"
                        value={`${totalRates} rate${totalRates === 1 ? '' : 's'}`}
                    />
                </div>

                <Section variant="grouped" title="Carrier provider" action={<ProviderModeBadge mode={providerMode} />}>
                    <p className="m-0 text-[length:var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                        Shipping labels and fulfillment rates
                    </p>
                </Section>

                <Section
                    variant="grouped"
                    title="Shipping zones"
                    action={(
                        <Button type="button" variant="secondary" size="sm" onClick={startAdd} disabled={Boolean(formMode)}>
                            <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Add zone
                        </Button>
                    )}
                >
                    <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                        Customers see delivery options based on the zone that matches their address.
                    </p>
                        {zones.length === 0 ? (
                            <EmptyState
                                icon={<Truck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                title="No shipping zones configured"
                                body="Create zones for domestic, regional, or international delivery so checkout can offer the right rates."
                                primaryAction={!formMode ? <Button type="button" onClick={startAdd}>Add zone</Button> : undefined}
                            />
                        ) : (
                            <div className="grid gap-[var(--lb-space-3)]">
                                {zones.map((zone) => {
                                    const zoneRates = rates.filter((rate) => rate.zone_id === zone.id)
                                    const isAddingRateHere = addRateForm?.zoneId === zone.id
                                    return (
                                        <div key={zone.id} className="flex flex-col gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
                                            <div className="flex flex-col gap-[var(--lb-space-4)] md:flex-row md:items-center md:justify-between">
                                                <div className="min-w-0 space-y-[var(--lb-space-2)]">
                                                    <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                        <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                            {zone.name}
                                                        </h3>
                                                        <Badge label={`${zoneRates.length} rate${zoneRates.length === 1 ? '' : 's'}`} variant={zoneRates.length > 0 ? 'success' : 'warning'} />
                                                    </div>
                                                    <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                        {formatCountries(zone.countries || [])}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                                    <Button type="button" variant="secondary" size="sm"
                                                        onClick={() => setAddRateForm(isAddingRateHere ? null : { zoneId: zone.id, name: '', price: '', saving: false, error: null })}
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
                                                            <span className="text-[var(--lb-font-size-body)] text-[var(--lb-color-text)]">{rate.name}</span>
                                                            <div className="flex items-center gap-[var(--lb-space-3)]">
                                                                <span className="text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">
                                                                    {rate.price === 0 ? 'Free' : `₹${rate.price.toLocaleString('en-IN')}`}
                                                                </span>
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
                                                        <Button type="button" onClick={() => void handleAddRate()} loading={addRateForm.saving}>
                                                            Add rate
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

            <Modal
                open={Boolean(formMode)}
                title={formMode === 'edit' ? 'Edit shipping zone' : 'Add shipping zone'}
                description="Group countries into delivery zones so checkout can show the right shipping options."
                onClose={() => { if (saveState !== 'saving') resetForm() }}
                footer={(
                    <>
                        <Button type="button" variant="secondary" onClick={resetForm} disabled={saveState === 'saving'}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void handleSaveZone()} loading={saveState === 'saving'}>
                            {formMode === 'edit' ? 'Update zone' : 'Add zone'}
                        </Button>
                    </>
                )}
            >
                <div className="grid gap-[var(--lb-space-4)]">
                    {formError && (
                        <Banner variant="critical" title="Shipping zone needs attention">
                            {formError}
                        </Banner>
                    )}
                    <Input
                        label="Zone name"
                        value={formName}
                        onChange={(event) => setFormName(event.target.value)}
                        placeholder="e.g. Domestic, International"
                        helperText="Use a merchant-friendly name for fulfilment teams."
                        autoFocus
                    />
                    <Input
                        label="Countries"
                        value={formCountries}
                        onChange={(event) => setFormCountries(event.target.value)}
                        placeholder="e.g. India, Nepal, Sri Lanka"
                        helperText="Separate country names with commas."
                    />
                </div>
            </Modal>
        </>
    )
}
