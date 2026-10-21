'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { getStorefrontRootDomain } from '@/lib/public-urls'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input,
    Badge,
    Banner,
    BarChart3,
    Card,
    Image as ImageIcon,
    Lock,
    Page,
    PageHeader,
    RefreshCw,
    Save,
    SaveBar,
    Section,
    Skeleton,
    Star,
    Textarea,
    useToast,
} from '@letbuyy/ui'

interface PreferencesFormState {
    seoTitle: string
    seoDescription: string
}

const emptyForm: PreferencesFormState = {
    seoTitle: '',
    seoDescription: '',
}

const advancedPreferences = [
    {
        title: 'Social sharing image',
        description: 'Default image for social previews when a store link is shared.',
        icon: ImageIcon,
        value: 'No image connected',
    },
    {
        title: 'Password protection',
        description: 'Restrict storefront access while preparing publication.',
        icon: Lock,
        value: 'Locked pending safe editing',
    },
    {
        title: 'Google Analytics',
        description: 'Measurement ID for storefront analytics.',
        icon: BarChart3,
        value: 'No measurement ID connected',
    },
    {
        title: 'Favicon',
        description: 'Browser tab and bookmark icon for the storefront.',
        icon: Star,
        value: 'No favicon connected',
    },
]

function getErrorMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error
        if (typeof error === 'string') return error
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message
            if (typeof message === 'string') return message
        }
        const message = (payload as { message?: unknown }).message
        if (typeof message === 'string') return message
    }

    return fallback
}

function formsEqual(a: PreferencesFormState, b: PreferencesFormState) {
    return a.seoTitle === b.seoTitle && a.seoDescription === b.seoDescription
}

function formFromSettings(settings: Record<string, unknown>): PreferencesFormState {
    return {
        seoTitle: String(settings.seo_title || settings.store_name || settings.name || ''),
        seoDescription: String(settings.seo_description || ''),
    }
}

export default function PreferencesPage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [form, setForm] = useState<PreferencesFormState>(emptyForm)
    const [initialForm, setInitialForm] = useState<PreferencesFormState>(emptyForm)

    const beginRead = useReadRequest(store)
    const loadPreferences = useCallback(async () => {
        const request = beginRead()
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                cache: 'no-store', signal: request.signal,
            })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load storefront preferences'))
            }

            const nextForm = formFromSettings((payload?.data || {}) as Record<string, unknown>)
            setForm(nextForm)
            setInitialForm(nextForm)
        } catch (error) {
            if (!request.isCurrent()) return
            const message = error instanceof Error ? error.message : 'Unable to load storefront preferences'
            setForm(emptyForm)
            setInitialForm(emptyForm)
            setLoadError(message)
            notify({
                title: 'Preferences could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

    useEffect(() => {
        void loadPreferences()
    }, [loadPreferences])

    const hasUnsavedChanges = !formsEqual(form, initialForm)
    const saveState = saving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'
    const seoTitleCount = form.seoTitle.length
    const seoDescriptionCount = form.seoDescription.length
    const previewTitle = useMemo(() => form.seoTitle.trim() || 'Your Store Title', [form.seoTitle])
    const previewDescription = useMemo(
        () => form.seoDescription.trim() || 'Your store description will appear here.',
        [form.seoDescription],
    )

    const updateForm = useCallback(<Key extends keyof PreferencesFormState>(key: Key, value: PreferencesFormState[Key]) => {
        setForm((current) => ({ ...current, [key]: value }))
    }, [])

    const discardChanges = useCallback(() => {
        setForm(initialForm)
    }, [initialForm])

    const handleSave = useCallback(async () => {
        if (saving || !hasUnsavedChanges) return
        setSaving(true)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seo_title: form.seoTitle,
                    seo_description: form.seoDescription,
                }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to save storefront preferences'))
            }

            setInitialForm(form)
            notify({
                title: 'Preferences saved',
                description: 'Search listing details were updated for this storefront.',
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save storefront preferences'
            notify({
                title: 'Could not save preferences',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [form, hasUnsavedChanges, notify, saving, store])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Preferences"
                    description="Control search previews and storefront preference fields."
                    breadcrumbs={[{ label: 'Online Store' }, { label: 'Preferences' }]}
                />
                <Card>
                    <Section title="Search engine listing">
                        <Skeleton variant="card" lines={7} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Preferences"
                description="Control search previews and storefront preference fields."
                breadcrumbs={[{ label: 'Online Store' }, { label: 'Preferences' }]}
                primaryAction={{
                    label: saving ? 'Saving...' : 'Save changes',
                    onClick: () => void handleSave(),
                    disabled: saving || !hasUnsavedChanges,
                    icon: <Save className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadPreferences(),
                        disabled: saving,
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Preferences could not load"
                    action={<Button variant="secondary" onClick={() => void loadPreferences()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <Card>
                <Section
                    title="Search engine listing"
                    description="Set the title and description used by search engines and link previews."
                    action={<Badge label="Store SEO" variant="info" />}
                >
                    <div className="grid gap-[var(--lb-space-5)] xl:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="flex flex-col gap-[var(--lb-space-4)]">
                            <Input
                                label="Homepage title"
                                value={form.seoTitle}
                                onChange={(event) => updateForm('seoTitle', event.target.value)}
                                placeholder="My Store - Modern Fashion"
                                maxLength={70}
                                helperText={`${seoTitleCount} of 70 characters used`}
                            />
                            <Textarea
                                label="Meta description"
                                value={form.seoDescription}
                                onChange={(event) => updateForm('seoDescription', event.target.value)}
                                placeholder="Describe your store for search engines."
                                rows={4}
                                maxLength={320}
                                helperText={`${seoDescriptionCount} of 320 characters used`}
                            />
                        </div>

                        <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                            <p className="m-0 text-[var(--lb-font-size-caption)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                Search engine listing preview
                            </p>
                            <div className="mt-[var(--lb-space-3)] rounded-[var(--lb-radius-md)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] shadow-[var(--lb-shadow-sm)]">
                                <p className="m-0 truncate text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-primary)]">
                                    {previewTitle}
                                </p>
                                <p className="m-0 mt-[var(--lb-space-1)] truncate text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-success)]">
                                    {store}.{getStorefrontRootDomain()}
                                </p>
                                <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                    {previewDescription}
                                </p>
                            </div>
                        </div>
                    </div>
                </Section>
            </Card>

            <Card>
                <Section
                    title="Advanced preferences"
                    description="Additional storefront preferences are read-only until safe editing is available."
                    action={<Badge label="Read-only" variant="warning" />}
                >
                    <Banner variant="warning" title="Advanced fields are read-only">
                        Social image, password protection, analytics ID, and favicon controls are locked pending safe editing.
                    </Banner>

                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                        {advancedPreferences.map((preference) => {
                            const Icon = preference.icon
                            return (
                                <div
                                    key={preference.title}
                                    className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)] opacity-80"
                                    aria-disabled="true"
                                >
                                    <div className="flex items-start gap-[var(--lb-space-3)]">
                                        <span className="flex h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] shrink-0 items-center justify-center rounded-[var(--lb-radius-lg)] bg-[var(--lb-color-primary-soft)] text-[var(--lb-color-primary)]">
                                            <Icon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0">
                                            <h3 className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                                {preference.title}
                                            </h3>
                                            <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                                {preference.description}
                                            </p>
                                            <p className="m-0 mt-[var(--lb-space-3)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                {preference.value}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Section>
            </Card>

            <SaveBar
                state={saveState}
                onSave={() => void handleSave()}
                onDiscard={discardChanges}
                saveLabel="Save preferences"
            />
        </Page>
    )
}
