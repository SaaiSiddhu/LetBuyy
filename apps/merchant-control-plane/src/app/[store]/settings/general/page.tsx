'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { DEFAULT_ADMIN_LOCALE, getAdminLocaleOptions, normalizeAdminLocale } from '@/lib/i18n/admin-locales'
import {
    Banner,
    Button,
    Card,
    ConfirmDialog,
    Input,
    Section,
    Select,
    Skeleton,
    Textarea,
    useToast,
} from '@letbuyy/ui'
import { SettingsPane } from '@/components/settings/SettingsPane'

interface GeneralData {
    id: string
    store_name: string
    name: string
    description: string
    subdomain: string
    custom_domain: string
    currency: string
    locale: string
    site_type: string
}

type SaveState = 'saved' | 'unsaved' | 'saving'

const currencyOptions = [
    { value: 'INR', label: 'Indian Rupee (INR)' },
    { value: 'USD', label: 'US Dollar (USD)' },
    { value: 'EUR', label: 'Euro (EUR)' },
    { value: 'GBP', label: 'British Pound (GBP)' },
]

const editableFields: Array<keyof Pick<GeneralData, 'name' | 'description' | 'currency' | 'locale'>> = [
    'name',
    'description',
    'currency',
    'locale',
]

const emptyGeneralData: GeneralData = {
    id: '',
    store_name: '',
    name: '',
    description: '',
    subdomain: '',
    custom_domain: '',
    currency: 'INR',
    locale: DEFAULT_ADMIN_LOCALE,
    site_type: 'store',
}

function readString(record: Record<string, unknown>, key: string, fallback = '') {
    const value = record[key]
    return typeof value === 'string' ? value : fallback
}

function formatSiteType(value: string) {
    if (!value) return 'Store'
    return value
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ')
}

export default function GeneralSettingsPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saveState, setSaveState] = useState<SaveState>('saved')
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [initialData, setInitialData] = useState<GeneralData | null>(null)
    const [data, setData] = useState<GeneralData>(emptyGeneralData)

    const localeOptions = useMemo(() => getAdminLocaleOptions(), [])
    const hasUnsavedChanges = useMemo(() => {
        if (!initialData) return false
        return editableFields.some((field) => data[field] !== initialData[field])
    }, [data, initialData])

    const activeSaveState: SaveState = saveState === 'saving' ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

    const loadData = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                cache: 'no-store',
                signal,
            })
            const payload = await response.json() as { data?: Record<string, unknown>; error?: string }

            if (!response.ok) {
                throw new Error(payload.error || 'Unable to load general settings')
            }

            const storeData = payload.data
            if (!storeData) {
                throw new Error('General settings were not returned for this store')
            }

            const nextData: GeneralData = {
                id: readString(storeData, 'id'),
                store_name: readString(storeData, 'store_name'),
                name: readString(storeData, 'name', readString(storeData, 'store_name')),
                description: readString(storeData, 'description'),
                subdomain: readString(storeData, 'subdomain', readString(storeData, 'store_name')),
                custom_domain: readString(storeData, 'custom_domain'),
                currency: readString(storeData, 'currency', 'INR'),
                locale: normalizeAdminLocale(readString(storeData, 'locale', DEFAULT_ADMIN_LOCALE)),
                site_type: readString(storeData, 'site_type', 'store'),
            }

            setData(nextData)
            setInitialData(nextData)
            setSaveState('saved')
        } catch (error) {
            if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) return

            const message = error instanceof Error ? error.message : 'Unable to load general settings'
            setLoadError(message)
            notify({
                title: 'General settings could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        const controller = new AbortController()
        void loadData(controller.signal)

        return () => {
            controller.abort()
        }
    }, [loadData])

    const updateField = useCallback(<Key extends keyof GeneralData>(field: Key, value: GeneralData[Key]) => {
        setData((current) => ({ ...current, [field]: value }))
    }, [])

    const handleSave = useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault()
        if (!hasUnsavedChanges || saveState === 'saving') return

        setSaveState('saving')

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: data.name,
                    description: data.description,
                    currency: data.currency,
                    locale: data.locale,
                }),
            })
            const payload = await response.json() as { error?: string }

            if (!response.ok) {
                throw new Error(payload.error || 'Unable to save general settings')
            }

            setInitialData(data)
            setSaveState('saved')
            notify({
                title: 'General settings saved',
                description: 'Store details, currency, and language are up to date.',
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save general settings'
            setSaveState('unsaved')
            notify({
                title: 'Could not save settings',
                description: message,
                variant: 'critical',
            })
        }
    }, [data, hasUnsavedChanges, notify, saveState, store])

    const handleDiscard = useCallback(() => {
        if (!initialData) return
        setData(initialData)
        setSaveState('saved')
        notify({
            title: 'Changes discarded',
            description: 'General settings were reset to the last saved version.',
            variant: 'info',
        })
    }, [initialData, notify])

    const handleDelete = useCallback(async () => {
        if (deleting) return
        setDeleting(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => ({})) as { error?: string }

            if (!response.ok) {
                throw new Error(payload.error || 'Unable to delete store')
            }

            notify({
                title: 'Store deletion started',
                description: 'Redirecting to your accounts workspace.',
                variant: 'success',
            })
            const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.store'
            window.location.href = accountsUrl
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to delete store'
            setDeleting(false)
            setDeleteDialogOpen(false)
            notify({
                title: 'Could not delete store',
                description: message,
                variant: 'critical',
            })
        }
    }, [deleting, notify, store])

    if (loading) {
        return (
            <SettingsPane
                title="General"
                description="Manage the core identity, language, and market defaults for this store."
                store={store}
            >
                <Card>
                    <Section title="Store details">
                        <Skeleton variant="text" lines={4} />
                    </Section>
                </Card>
                <Card>
                    <Section title="Store currency and language">
                        <Skeleton variant="text" lines={3} />
                    </Section>
                </Card>
                <Skeleton variant="card" />
            </SettingsPane>
        )
    }

    return (
        <>
            <SettingsPane
                title="General"
                description="Manage the core identity, language, and market defaults for this store."
                store={store}
                guidance={{
                    title: 'Core store identity',
                    body: 'Keep these details aligned with the public storefront, billing records, and support workflows before launch.',
                }}
                saveBar={{
                    state: activeSaveState,
                    onSave: () => void handleSave(),
                    onDiscard: handleDiscard,
                    saveLabel: 'Save settings',
                }}
            >
                {loadError && (
                    <Banner
                        variant="critical"
                        title="General settings could not load"
                        action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}
                    >
                        {loadError}
                    </Banner>
                )}

                <form className="flex flex-col gap-[var(--lb-space-5)]" onSubmit={handleSave}>
                    <Card>
                        <Section
                            title="Store details"
                            description="These details appear in merchant workflows and storefront metadata."
                        >
                            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                <Input
                                    label="Store name"
                                    value={data.name}
                                    onChange={(event) => updateField('name', event.target.value)}
                                    autoComplete="organization"
                                />
                                <Input
                                    label="Store handle"
                                    value={data.store_name}
                                    helperText="This unique store identifier cannot be changed."
                                    disabled
                                />
                            </div>
                            <Textarea
                                label="Store description"
                                value={data.description}
                                onChange={(event) => updateField('description', event.target.value)}
                                rows={4}
                                placeholder="Tell customers about your business..."
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title="Store currency and language"
                            description="Set the default currency and storefront locale used in customer-facing flows."
                        >
                            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                <Select
                                    label="Currency"
                                    value={data.currency}
                                    options={currencyOptions}
                                    onChange={(event) => updateField('currency', event.target.value)}
                                />
                                <Select
                                    label="Storefront language"
                                    value={data.locale}
                                    options={localeOptions}
                                    onChange={(event) => updateField('locale', normalizeAdminLocale(event.target.value))}
                                />
                            </div>
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title="Site type"
                            description="The site type was set when this store was created."
                        >
                            <Input
                                label="Type"
                                value={formatSiteType(data.site_type)}
                                helperText="Changing site type requires a governed migration and is not available from settings."
                                disabled
                            />
                        </Section>
                    </Card>
                </form>

                <Card className="border-[var(--lb-color-critical)]">
                    <Section
                        title="Danger zone"
                        description="Permanently delete this store and all associated data including products, orders, and pages."
                        action={(
                            <Button
                                variant="destructive"
                                onClick={() => setDeleteDialogOpen(true)}
                                loading={deleting}
                            >
                                Delete store
                            </Button>
                        )}
                    >
                        <Banner variant="critical" title="This cannot be undone">
                            Store deletion is permanent. Use this only after exporting any data you need to keep.
                        </Banner>
                    </Section>
                </Card>
            </SettingsPane>

            <ConfirmDialog
                open={deleteDialogOpen}
                title={`Delete ${data.name || 'this store'}?`}
                description="This permanently deletes the store, products, orders, pages, and settings. This action cannot be undone."
                confirmLabel={deleting ? 'Deleting' : 'Delete store'}
                destructive
                onClose={() => {
                    if (!deleting) setDeleteDialogOpen(false)
                }}
                onConfirm={() => void handleDelete()}
            />
        </>
    )
}
