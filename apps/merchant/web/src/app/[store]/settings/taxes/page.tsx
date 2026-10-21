'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input,
    Badge,
    Banner,
    Card,
    ClipboardList,
    ConfirmDialog,
    EmptyState,
    Globe,
    IndianRupee,
    Plus,
    Section,
    ShieldCheck,
    Skeleton,
    Tag,
    Trash2,
    Truck,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'

interface TaxRate {
    id: string
    name: string
    rate: number
    country: string
    state: string | null
    is_compound: boolean
    is_shipping: boolean
    priority: number
    is_active: boolean
    created_at: string
}

type TaxesPayload = {
    data?: unknown
    error?: string | { message?: string }
}

type SaveState = 'saved' | 'unsaved' | 'saving'
type FormMode = 'add' | 'edit' | null

function getPayloadError(payload: TaxesPayload | null, fallback: string) {
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

function normalizeTaxRates(value: unknown): TaxRate[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((rate) => {
        if (!isRecord(rate) || typeof rate.id !== 'string' || !rate.id) return []

        return [{
            id: rate.id,
            name: readString(rate.name, 'Unnamed tax rate'),
            rate: coerceNumber(rate.rate),
            country: readString(rate.country, 'IN'),
            state: typeof rate.state === 'string' ? rate.state : null,
            is_compound: rate.is_compound === true,
            is_shipping: rate.is_shipping === true,
            priority: coerceNumber(rate.priority),
            is_active: rate.is_active === true,
            created_at: readString(rate.created_at),
        }]
    })
}

function formatTaxPercent(rate: number) {
    return `${Math.round(rate * 10000) / 100}%`
}

interface TaxMetricProps {
    icon: ReactNode
    label: string
    value: string
}

function TaxMetric({ icon, label, value }: TaxMetricProps) {
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

export default function TaxesSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [taxData, setTaxData] = useState({ tax_inclusive: false })
    const [initialTaxInclusive, setInitialTaxInclusive] = useState(false)
    const [taxRates, setTaxRates] = useState<TaxRate[]>([])
    const [settingsSaveState, setSettingsSaveState] = useState<SaveState>('saved')
    const [formSaveState, setFormSaveState] = useState<SaveState>('saved')
    const [formMode, setFormMode] = useState<FormMode>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formName, setFormName] = useState('')
    const [formRate, setFormRate] = useState('')
    const [formCountry, setFormCountry] = useState('IN')
    const [formState, setFormState] = useState('')
    const [formCompound, setFormCompound] = useState(false)
    const [formShipping, setFormShipping] = useState(false)
    const [formActive, setFormActive] = useState(true)
    const [formError, setFormError] = useState<string | null>(null)
    const [rateToDelete, setRateToDelete] = useState<TaxRate | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const activeRates = useMemo(() => taxRates.filter((rate) => rate.is_active).length, [taxRates])
    const shippingRates = useMemo(() => taxRates.filter((rate) => rate.is_shipping).length, [taxRates])
    const activeSaveState: SaveState = formMode
        ? (formSaveState === 'saving' ? 'saving' : 'unsaved')
        : settingsSaveState

    const loadData = useCallback(async (options?: { quiet?: boolean }) => {
        if (!options?.quiet) setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/taxes`, {
                cache: 'no-store',
            })
            const payload = (await response.json().catch(() => null)) as TaxesPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to load tax settings'))
            }

            const data = isRecord(payload?.data) ? payload.data : {}
            const taxInclusive = data.tax_inclusive === true
            setTaxData({ tax_inclusive: taxInclusive })
            setInitialTaxInclusive(taxInclusive)
            setTaxRates(normalizeTaxRates(data.rates))
            setSettingsSaveState('saved')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load tax settings'
            setLoadError(message)
            notify({
                title: 'Tax settings could not load',
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
        setFormRate('')
        setFormCountry('IN')
        setFormState('')
        setFormCompound(false)
        setFormShipping(false)
        setFormActive(true)
        setFormError(null)
        setFormSaveState('saved')
    }, [])

    const handleTaxInclusiveChange = useCallback((checked: boolean) => {
        setTaxData({ tax_inclusive: checked })
        setSettingsSaveState(checked === initialTaxInclusive ? 'saved' : 'unsaved')
    }, [initialTaxInclusive])

    const handleSaveSettings = useCallback(async () => {
        if (settingsSaveState === 'saving') return

        setSettingsSaveState('saving')

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/taxes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tax_inclusive: taxData.tax_inclusive }),
            })
            const payload = (await response.json().catch(() => null)) as TaxesPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to save tax settings'))
            }

            setInitialTaxInclusive(taxData.tax_inclusive)
            setSettingsSaveState('saved')
            notify({
                title: 'Tax settings saved',
                description: taxData.tax_inclusive
                    ? 'Product prices are now treated as tax inclusive.'
                    : 'Product prices are now treated as tax exclusive.',
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save tax settings'
            setSettingsSaveState('unsaved')
            notify({
                title: 'Could not save tax settings',
                description: message,
                variant: 'critical',
            })
        }
    }, [notify, settingsSaveState, store, taxData.tax_inclusive])

    const startAdd = useCallback(() => {
        resetForm()
        setFormMode('add')
        setFormSaveState('unsaved')
    }, [resetForm])

    const startEdit = useCallback((rate: TaxRate) => {
        setFormMode('edit')
        setEditingId(rate.id)
        setFormName(rate.name)
        setFormRate(String(Math.round(rate.rate * 10000) / 100))
        setFormCountry(rate.country || 'IN')
        setFormState(rate.state || '')
        setFormCompound(rate.is_compound)
        setFormShipping(rate.is_shipping)
        setFormActive(rate.is_active)
        setFormError(null)
        setFormSaveState('unsaved')
    }, [])

    const handleSaveRate = useCallback(async () => {
        if (!formMode || formSaveState === 'saving') return

        const name = formName.trim()
        const rateValue = Number.parseFloat(formRate)

        if (!name) {
            const message = 'Enter a tax rate name.'
            setFormError(message)
            notify({
                title: 'Tax rate needs a name',
                description: message,
                variant: 'warning',
            })
            return
        }

        if (!Number.isFinite(rateValue)) {
            const message = 'Enter a valid percentage rate.'
            setFormError(message)
            notify({
                title: 'Tax rate needs a percentage',
                description: message,
                variant: 'warning',
            })
            return
        }

        if (formMode === 'edit' && !editingId) {
            const message = 'Select a tax rate before updating.'
            setFormError(message)
            notify({
                title: 'Tax rate could not be updated',
                description: message,
                variant: 'critical',
            })
            return
        }

        setFormSaveState('saving')
        setFormError(null)

        const body = {
            name,
            rate: rateValue / 100,
            country: formCountry || 'IN',
            ...(formState.trim() ? { state: formState.trim() } : formMode === 'edit' ? { state: null } : {}),
            is_compound: formCompound,
            is_shipping: formShipping,
            is_active: formActive,
        }

        const endpoint = formMode === 'edit'
            ? `/api/stores/${encodeURIComponent(store)}/taxes/${encodeURIComponent(editingId as string)}`
            : `/api/stores/${encodeURIComponent(store)}/taxes`

        try {
            const response = await fetch(endpoint, {
                method: formMode === 'edit' ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const payload = (await response.json().catch(() => null)) as TaxesPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to save tax rate'))
            }

            const action = formMode === 'edit' ? 'updated' : 'created'
            resetForm()
            await loadData({ quiet: true })
            notify({
                title: `Tax rate ${action}`,
                description: `${name} is ready for checkout tax calculations.`,
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save tax rate'
            setFormError(message)
            setFormSaveState('unsaved')
            notify({
                title: 'Could not save tax rate',
                description: message,
                variant: 'critical',
            })
        }
    }, [
        editingId,
        formActive,
        formCompound,
        formCountry,
        formMode,
        formName,
        formRate,
        formSaveState,
        formShipping,
        formState,
        loadData,
        notify,
        resetForm,
        store,
    ])

    const handleConfirmDelete = useCallback(async () => {
        if (!rateToDelete || deletingId) return

        setDeletingId(rateToDelete.id)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/taxes/${encodeURIComponent(rateToDelete.id)}`, {
                method: 'DELETE',
            })
            const payload = (await response.json().catch(() => null)) as TaxesPayload | null

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Unable to delete tax rate'))
            }

            setTaxRates((current) => current.filter((rate) => rate.id !== rateToDelete.id))
            notify({
                title: 'Tax rate deleted',
                description: `${rateToDelete.name} was removed from checkout tax calculations.`,
                variant: 'success',
            })
            setRateToDelete(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete tax rate'
            notify({
                title: 'Could not delete tax rate',
                description: message,
                variant: 'critical',
            })
        } finally {
            setDeletingId(null)
        }
    }, [deletingId, notify, rateToDelete, store])

    if (loading) {
        return (
            <SettingsPane
                title="Taxes and duties"
                description="Configure price tax handling and checkout tax rates."
                store={store}
            >
                <Card>
                    <Section title="Tax rates">
                        <Skeleton variant="table" lines={5} />
                    </Section>
                </Card>
            </SettingsPane>
        )
    }

    return (
        <>
            <SettingsPane
                title="Taxes and duties"
                description="Configure price tax handling and checkout tax rates."
                store={store}
                guidance={{
                    title: 'Checkout impact',
                    body: 'Compound taxes are calculated on top of other taxes. Shipping taxes apply to delivery costs when checkout has a shipping rate.',
                }}
                primaryAction={{
                    label: 'Add tax rate',
                    onClick: startAdd,
                    disabled: Boolean(formMode) || settingsSaveState !== 'saved',
                    icon: <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                saveBar={{
                    state: activeSaveState,
                    onSave: () => {
                        if (formMode) {
                            void handleSaveRate()
                        } else {
                            void handleSaveSettings()
                        }
                    },
                    onDiscard: () => {
                        if (formMode) {
                            resetForm()
                        } else {
                            handleTaxInclusiveChange(initialTaxInclusive)
                        }
                    },
                    saveLabel: formMode ? (formMode === 'edit' ? 'Update rate' : 'Add rate') : 'Save taxes',
                }}
            >
                {loadError && (
                    <Banner
                        variant="critical"
                        title="Tax settings could not load"
                        action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                    >
                        {loadError}
                    </Banner>
                )}

                {formError && (
                    <Banner variant="critical" title="Tax rate needs attention">
                        {formError}
                    </Banner>
                )}

                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                    <TaxMetric
                        icon={<IndianRupee className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                        label="Price mode"
                        value={taxData.tax_inclusive ? 'Tax inclusive' : 'Tax exclusive'}
                    />
                    <TaxMetric
                        icon={<ClipboardList className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                        label="Active rates"
                        value={`${activeRates} of ${taxRates.length}`}
                    />
                    <TaxMetric
                        icon={<Truck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                        label="Shipping taxes"
                        value={`${shippingRates} configured`}
                    />
                </div>

                <Card>
                    <Section
                        title="Tax region"
                        description="India is the default tax region for this store. Choose whether product prices already include taxes."
                    >
                        <label className="flex cursor-pointer items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)]">
                            <Input unstyled
                                type="checkbox"
                                checked={taxData.tax_inclusive}
                                onChange={(event) => handleTaxInclusiveChange(event.target.checked)}
                                disabled={Boolean(formMode) || settingsSaveState === 'saving'}
                                className="mt-[var(--lb-space-1)] h-[var(--lb-space-4)] w-[var(--lb-space-4)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                            />
                            <span className="space-y-[var(--lb-space-1)]">
                                <span className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                    All prices include tax
                                </span>
                                <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                    Checkout will treat displayed product prices as tax inclusive and show tax as part of the total.
                                </span>
                            </span>
                        </label>
                    </Section>
                </Card>

                {settingsSaveState !== 'saved' && !formMode && (
                    <Banner variant="warning" title="Unsaved tax setting">
                        Save the tax-inclusive setting before adding or editing tax rates.
                    </Banner>
                )}

                {formMode && (
                    <Card>
                        <Section
                            title={formMode === 'edit' ? 'Edit tax rate' : 'Add tax rate'}
                            description="Create GST or duty rates for checkout calculations. Rates are stored as percentages."
                        >
                            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                <Input
                                    label="Tax name"
                                    value={formName}
                                    onChange={(event) => setFormName(event.target.value)}
                                    placeholder="e.g. GST 18%"
                                    helperText="Use a name your team will recognize during order reviews."
                                />
                                <Input
                                    label="Rate (%)"
                                    type="number"
                                    step="0.01"
                                    value={formRate}
                                    onChange={(event) => setFormRate(event.target.value)}
                                    placeholder="e.g. 18"
                                    helperText="Enter the percentage shown at checkout."
                                />
                                <Input
                                    label="Country"
                                    value={formCountry}
                                    onChange={(event) => setFormCountry(event.target.value)}
                                    placeholder="IN"
                                    helperText="Use the country code or configured market label."
                                />
                                <Input
                                    label="State"
                                    value={formState}
                                    onChange={(event) => setFormState(event.target.value)}
                                    placeholder="e.g. TN"
                                    helperText="Optional. Leave blank for country-wide tax."
                                />
                            </div>
                            <div className="grid gap-[var(--lb-space-3)] md:grid-cols-3">
                                <label className="flex cursor-pointer items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)]">
                                    <Input unstyled
                                        type="checkbox"
                                        checked={formCompound}
                                        onChange={(event) => setFormCompound(event.target.checked)}
                                        className="mt-[var(--lb-space-1)] h-[var(--lb-space-4)] w-[var(--lb-space-4)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                    />
                                    <span className="space-y-[var(--lb-space-1)]">
                                        <span className="block text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text)]">
                                            Compound tax
                                        </span>
                                        <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            Calculate on top of other taxes.
                                        </span>
                                    </span>
                                </label>
                                <label className="flex cursor-pointer items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)]">
                                    <Input unstyled
                                        type="checkbox"
                                        checked={formShipping}
                                        onChange={(event) => setFormShipping(event.target.checked)}
                                        className="mt-[var(--lb-space-1)] h-[var(--lb-space-4)] w-[var(--lb-space-4)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                    />
                                    <span className="space-y-[var(--lb-space-1)]">
                                        <span className="block text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text)]">
                                            Apply to shipping
                                        </span>
                                        <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            Include delivery costs in tax.
                                        </span>
                                    </span>
                                </label>
                                <label className="flex cursor-pointer items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-3)]">
                                    <Input unstyled
                                        type="checkbox"
                                        checked={formActive}
                                        onChange={(event) => setFormActive(event.target.checked)}
                                        className="mt-[var(--lb-space-1)] h-[var(--lb-space-4)] w-[var(--lb-space-4)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                    />
                                    <span className="space-y-[var(--lb-space-1)]">
                                        <span className="block text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text)]">
                                            Active
                                        </span>
                                        <span className="block text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                            Make this rate available now.
                                        </span>
                                    </span>
                                </label>
                            </div>
                            <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                <Button type="button" onClick={() => void handleSaveRate()} loading={formSaveState === 'saving'}>
                                    {formMode === 'edit' ? 'Update rate' : 'Add rate'}
                                </Button>
                                <Button type="button" variant="secondary" onClick={resetForm} disabled={formSaveState === 'saving'}>
                                    Cancel
                                </Button>
                            </div>
                        </Section>
                    </Card>
                )}

                <Card>
                    <Section
                        title="Tax rates"
                        description="Rates are applied during checkout based on the customer address and product pricing mode."
                        action={!formMode && (
                            <Button type="button" variant="secondary" onClick={startAdd} disabled={settingsSaveState !== 'saved'}>
                                <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                Add tax rate
                            </Button>
                        )}
                    >
                        {taxRates.length === 0 ? (
                            <EmptyState
                                icon={<Tag className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                title="No tax rates configured"
                                body="Add GST, state, or duty rates so checkout can calculate taxes consistently."
                                primaryAction={!formMode ? <Button type="button" onClick={startAdd} disabled={settingsSaveState !== 'saved'}>Add tax rate</Button> : undefined}
                            />
                        ) : (
                            <div className="divide-y divide-[var(--lb-color-border)] rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)]">
                                {taxRates.map((rate) => (
                                    <div key={rate.id} className="flex flex-col gap-[var(--lb-space-4)] p-[var(--lb-space-4)] md:flex-row md:items-center md:justify-between">
                                        <div className="min-w-0 space-y-[var(--lb-space-2)]">
                                            <div className="flex flex-wrap items-center gap-[var(--lb-space-2)]">
                                                <h3 className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                    {rate.name}
                                                </h3>
                                                <Badge label={formatTaxPercent(rate.rate)} variant="info" />
                                                <Badge label={rate.is_active ? 'Active' : 'Inactive'} variant={rate.is_active ? 'success' : 'warning'} />
                                                {rate.is_compound && <Badge label="Compound" variant="default" />}
                                                {rate.is_shipping && <Badge label="Shipping" variant="default" />}
                                            </div>
                                            <p className="m-0 flex flex-wrap items-center gap-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                <Globe className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                <span>{rate.country || 'IN'}{rate.state ? ` / ${rate.state}` : ''}</span>
                                                <ShieldCheck className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                <span>Priority {rate.priority ?? 0}</span>
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-[var(--lb-space-2)]">
                                            <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(rate)} disabled={Boolean(formMode) || settingsSaveState !== 'saved'}>
                                                Edit
                                            </Button>
                                            <Button type="button" variant="destructive" size="sm" onClick={() => setRateToDelete(rate)} disabled={deletingId === rate.id || Boolean(formMode)}>
                                                <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>
                </Card>
            </SettingsPane>

            <ConfirmDialog
                open={Boolean(rateToDelete)}
                title="Delete tax rate?"
                description={rateToDelete ? `Delete ${rateToDelete.name} from checkout tax calculations.` : 'Delete this tax rate.'}
                confirmLabel={deletingId ? 'Deleting' : 'Delete rate'}
                destructive
                onConfirm={() => void handleConfirmDelete()}
                onClose={() => {
                    if (!deletingId) setRateToDelete(null)
                }}
            />
        </>
    )
}
