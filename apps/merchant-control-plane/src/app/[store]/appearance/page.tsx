'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import {
    Banner,
    Button,
    Card,
    Code,
    Image as ImageIcon,
    Input,
    LayoutGrid,
    Palette,
    Page,
    PageHeader,
    RefreshCw,
    Save,
    SaveBar,
    Section,
    Select,
    Skeleton,
    Textarea,
    PenTool,
    useToast,
} from '@letbuyy/ui'

interface AppearanceFormState {
    primary_color: string
    font_family: string
    border_radius: string
    logo_url: string
    favicon_url: string
    custom_css: string
}

const defaultForm: AppearanceFormState = {
    primary_color: '#6366f1',
    font_family: 'Inter',
    border_radius: '8',
    logo_url: '',
    favicon_url: '',
    custom_css: '',
}

const fontOptions = [
    'Inter',
    'Roboto',
    'Outfit',
    'Poppins',
    'DM Sans',
    'Space Grotesk',
    'Playfair Display',
    'Lora',
    'Merriweather',
].map((font) => ({ label: font, value: font }))

const colorPresets = [
    { value: '#6366f1', className: 'bg-[#6366f1]' },
    { value: '#3b82f6', className: 'bg-[#3b82f6]' },
    { value: '#22c55e', className: 'bg-[#22c55e]' },
    { value: '#f59e0b', className: 'bg-[#f59e0b]' },
    { value: '#ef4444', className: 'bg-[#ef4444]' },
    { value: '#ec4899', className: 'bg-[#ec4899]' },
    { value: '#8b5cf6', className: 'bg-[#8b5cf6]' },
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

function formsEqual(a: AppearanceFormState, b: AppearanceFormState) {
    return a.primary_color === b.primary_color
        && a.font_family === b.font_family
        && a.border_radius === b.border_radius
        && a.logo_url === b.logo_url
        && a.favicon_url === b.favicon_url
        && a.custom_css === b.custom_css
}

function formFromSettings(settings: Record<string, unknown>): AppearanceFormState {
    return {
        primary_color: String(settings.primary_color || defaultForm.primary_color),
        font_family: String(settings.font_family || defaultForm.font_family),
        border_radius: String(settings.border_radius || defaultForm.border_radius),
        logo_url: String(settings.logo_url || ''),
        favicon_url: String(settings.favicon_url || ''),
        custom_css: String(settings.custom_css || ''),
    }
}

export default function AppearancePage() {
    const { store } = useParams<{ store: string }>()
    const { notify } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [form, setForm] = useState<AppearanceFormState>(defaultForm)
    const [initialForm, setInitialForm] = useState<AppearanceFormState>(defaultForm)

    const loadAppearance = useCallback(async () => {
        setLoading(true)
        setLoadError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                cache: 'no-store',
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to load appearance settings'))
            }

            const settings = (payload?.data?.site_settings || {}) as Record<string, unknown>
            const nextForm = formFromSettings(settings)
            setForm(nextForm)
            setInitialForm(nextForm)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load appearance settings'
            setForm(defaultForm)
            setInitialForm(defaultForm)
            setLoadError(message)
            notify({
                title: 'Appearance could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoading(false)
        }
    }, [notify, store])

    useEffect(() => {
        void loadAppearance()
    }, [loadAppearance])

    const hasUnsavedChanges = !formsEqual(form, initialForm)
    const saveState = saving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'
    const radiusValue = useMemo(() => Math.max(0, Math.min(24, Number.parseInt(form.border_radius, 10) || 0)), [form.border_radius])

    const updateForm = useCallback(<Key extends keyof AppearanceFormState>(key: Key, value: AppearanceFormState[Key]) => {
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
                    site_settings: {
                        ...form,
                        border_radius: radiusValue,
                    },
                }),
            })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getErrorMessage(payload, 'Unable to save appearance settings'))
            }

            const nextForm = {
                ...form,
                border_radius: String(radiusValue),
            }
            setForm(nextForm)
            setInitialForm(nextForm)
            notify({
                title: 'Appearance saved',
                description: 'Brand styles were updated for this store.',
                variant: 'success',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to save appearance settings'
            notify({
                title: 'Could not save appearance',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [form, hasUnsavedChanges, notify, radiusValue, saving, store])

    if (loading) {
        return (
            <Page>
                <PageHeader
                    title="Appearance"
                    description="Control the storefront brand color, typography, logo assets, and custom CSS."
                    breadcrumbs={[{ label: 'Online Store' }, { label: 'Appearance' }]}
                />
                <Card>
                    <Section title="Appearance settings">
                        <Skeleton variant="card" lines={8} />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader
                title="Appearance"
                description="Control the storefront brand color, typography, logo assets, and custom CSS."
                breadcrumbs={[{ label: 'Online Store' }, { label: 'Appearance' }]}
                primaryAction={{
                    label: saving ? 'Saving...' : 'Save changes',
                    onClick: () => void handleSave(),
                    disabled: saving || !hasUnsavedChanges,
                    icon: <Save className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                }}
                secondaryActions={[
                    {
                        label: 'Refresh',
                        onClick: () => void loadAppearance(),
                        disabled: saving,
                        icon: <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    },
                ]}
            />

            {loadError && (
                <Banner
                    variant="critical"
                    title="Appearance could not load"
                    action={<Button variant="secondary" onClick={() => void loadAppearance()}>Retry</Button>}
                >
                    {loadError}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-4)] xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex flex-col gap-[var(--lb-space-4)]">
                    <Card>
                        <Section
                            title="Brand color"
                            description="Use a primary color that works across storefront buttons, links, accents, and focus states."
                        >
                            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                                <Input
                                    label="Primary color"
                                    value={form.primary_color}
                                    onChange={(event) => updateForm('primary_color', event.target.value)}
                                    helperText="Hex color used by the storefront theme."
                                    leftIcon={<Palette className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                />
                                <Input
                                    label="Color picker"
                                    type="color"
                                    value={form.primary_color}
                                    onChange={(event) => updateForm('primary_color', event.target.value)}
                                    className="h-[var(--lb-size-control-lg)] w-[var(--lb-size-control-lg)] cursor-pointer p-[var(--lb-space-1)]"
                                />
                            </div>
                            <div className="flex flex-wrap gap-[var(--lb-space-2)]" aria-label="Color presets">
                                {colorPresets.map((preset) => {
                                    const selected = preset.value.toLowerCase() === form.primary_color.toLowerCase()
                                    return (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            aria-label={`Use ${preset.value}`}
                                            aria-pressed={selected}
                                            onClick={() => updateForm('primary_color', preset.value)}
                                            className={`h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-full)] border transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)] ${preset.className} ${selected ? 'border-[var(--lb-color-text)] shadow-[var(--lb-shadow-md)]' : 'border-[var(--lb-color-border)]'}`}
                                        />
                                    )
                                })}
                            </div>
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title="Typography"
                            description="Choose a storefront font family that matches your brand and keeps product pages readable."
                        >
                            <Select
                                label="Font family"
                                value={form.font_family}
                                options={fontOptions}
                                onChange={(event) => updateForm('font_family', event.target.value)}
                                helperText="Fonts are self-hosted or system-safe; no remote font requests are introduced."
                            />
                            <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                <p className="m-0 inline-flex items-center gap-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                    <PenTool className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Preview
                                </p>
                                <p className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                    New arrivals for your next launch
                                </p>
                                <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                    Product copy should stay scannable and balanced across desktop and mobile storefronts.
                                </p>
                            </div>
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title="Corners and assets"
                            description="Tune the storefront radius and brand image URLs without changing theme code."
                        >
                            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                <div>
                                    <label
                                        htmlFor="border-radius"
                                        className="block text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]"
                                    >
                                        Border radius
                                    </label>
                                    <input
                                        id="border-radius"
                                        type="range"
                                        min="0"
                                        max="24"
                                        value={radiusValue}
                                        onChange={(event) => updateForm('border_radius', event.target.value)}
                                        className="mt-[var(--lb-space-2)] h-[var(--lb-size-control-sm)] w-full accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                    />
                                    <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                        {radiusValue}px applied to storefront surfaces.
                                    </p>
                                </div>
                                <div
                                    className="grid h-[calc(var(--lb-size-control-lg)*2)] w-[calc(var(--lb-size-control-lg)*2)] place-items-center border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] text-[var(--lb-color-text-subdued)]"
                                    style={{ borderRadius: `${radiusValue}px` }}
                                    aria-label={`Radius preview ${radiusValue}px`}
                                >
                                    <LayoutGrid className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />
                                </div>
                            </div>
                            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                <Input
                                    label="Logo URL"
                                    type="url"
                                    placeholder="https://..."
                                    value={form.logo_url}
                                    onChange={(event) => updateForm('logo_url', event.target.value)}
                                    leftIcon={<ImageIcon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                />
                                <Input
                                    label="Favicon URL"
                                    type="url"
                                    placeholder="https://..."
                                    value={form.favicon_url}
                                    onChange={(event) => updateForm('favicon_url', event.target.value)}
                                    leftIcon={<ImageIcon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                />
                            </div>
                        </Section>
                    </Card>

                    <Card>
                        <Section
                            title="Custom CSS"
                            description="Add small storefront CSS overrides when the theme settings are not enough."
                        >
                            <Textarea
                                label="CSS overrides"
                                rows={8}
                                value={form.custom_css}
                                onChange={(event) => updateForm('custom_css', event.target.value)}
                                placeholder="/* Add custom CSS */"
                                className="font-mono text-[var(--lb-font-size-caption)]"
                                helperText="Saved as part of existing site settings. Keep overrides scoped to storefront selectors."
                            />
                        </Section>
                    </Card>
                </div>

                <Card>
                    <Section title="Preview" description="A lightweight sample of how the selected brand settings will feel.">
                        <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                            <div
                                className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] shadow-[var(--lb-shadow-sm)]"
                                style={{ borderRadius: `${radiusValue}px` }}
                            >
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                                    Storefront card
                                </p>
                                <h3 className="m-0 mt-[var(--lb-space-2)] text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-text)]">
                                    Urban Kicks Drop
                                </h3>
                                <p className="m-0 mt-[var(--lb-space-1)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                    Logo, color, radius, and copy all stay visible before saving.
                                </p>
                                <button
                                    type="button"
                                    className="mt-[var(--lb-space-4)] inline-flex h-[var(--lb-size-control-md)] items-center justify-center rounded-[var(--lb-radius-lg)] px-[var(--lb-space-4)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-inverse)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                    style={{ backgroundColor: form.primary_color, borderRadius: `${radiusValue}px` }}
                                >
                                    Shop now
                                </button>
                            </div>
                        </div>
                        <Banner variant="info" title="Theme editor connection">
                            These settings continue to save through the existing store settings endpoint. The flagship live theme editor work remains in UX7.
                        </Banner>
                        <p className="m-0 inline-flex items-center gap-[var(--lb-space-2)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text-subdued)]">
                            <Code className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                            Custom CSS is stored but not executed in this preview.
                        </p>
                    </Section>
                </Card>
            </div>

            <SaveBar
                state={saveState}
                onSave={() => void handleSave()}
                onDiscard={discardChanges}
                saveLabel="Save changes"
                discardLabel="Discard"
            />
        </Page>
    )
}
