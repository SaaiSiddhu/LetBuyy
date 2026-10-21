'use client'

import { useReadRequest } from '@/lib/api/use-read-request'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input,
    Banner,
    Card,
    Code,
    ColorPreviewButton,
    Image as ImageIcon,
    LayoutGrid,
    Palette,
    Page,
    PageHeader,
    RefreshCw,
    RadiusPreview,
    Save,
    SaveBar,
    Section,
    Select,
    Skeleton,
    PenTool,
    letbuyyPrimitiveTokens,
    useToast,
} from '@letbuyy/ui'
// Phase AA — CustomCssWorkspace replaces the plain Textarea for custom_css.
// RISK-DUAL-N01: writes to site_settings.custom_css (instance data), never section_definitions.
import {
    CustomCssWorkspace,
    validateCustomCss,
} from '@/components/theme-editor/controls/CustomCssWorkspace'

interface AppearanceFormState {
    primary_color: string
    font_family: string
    border_radius: string
    logo_url: string
    favicon_url: string
    custom_css: string
}

const defaultForm: AppearanceFormState = {
    primary_color: letbuyyPrimitiveTokens.color.purple[500],
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
    letbuyyPrimitiveTokens.color.purple[500],
    letbuyyPrimitiveTokens.color.blue[500],
    letbuyyPrimitiveTokens.color.green[500],
    letbuyyPrimitiveTokens.color.amber[500],
    letbuyyPrimitiveTokens.color.red[500],
    'rgb(236 72 153)',
    letbuyyPrimitiveTokens.color.purple[500],
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

    const beginRead = useReadRequest(store)
    const loadAppearance = useCallback(async () => {
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
                throw new Error(getErrorMessage(payload, 'Unable to load appearance settings'))
            }

            const settings = (payload?.data?.site_settings || {}) as Record<string, unknown>
            const nextForm = formFromSettings(settings)
            setForm(nextForm)
            setInitialForm(nextForm)
        } catch (error) {
            if (!request.isCurrent()) return
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
            if (request.isCurrent()) setLoading(false)
        }
    }, [beginRead, notify, store])

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

        // Phase AA — pre-save CSS validation guard (SAFE-CSS LAW).
        // validateCustomCss is a pure function: no DOM, no async.
        // Blocks save and surfaces violations before hitting the network.
        // RISK-DUAL-N01: this writes to site_settings.custom_css (instance), never section_definitions.
        if (form.custom_css.trim()) {
            const cssResult = validateCustomCss(form.custom_css)
            if (!cssResult.valid) {
                notify({
                    title: 'CSS has security violations',
                    description: `${cssResult.violations.length} unsafe construct${cssResult.violations.length === 1 ? '' : 's'} found (${cssResult.violations.map((v) => v.vector).join(', ')}). Fix them in the CSS editor before saving.`,
                    variant: 'critical',
                })
                return
            }
        }

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
                                    const selected = preset.toLowerCase() === form.primary_color.toLowerCase()
                                    return (
                                        <ColorPreviewButton
                                            key={preset}
                                            color={preset}
                                            type="button"
                                            aria-label={`Use ${preset}`}
                                            aria-pressed={selected}
                                            onClick={() => updateForm('primary_color', preset)}
                                            radius="var(--lb-radius-full)"
                                            className={`h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] border ${selected ? 'border-[var(--lb-color-text)] shadow-[var(--lb-shadow-md)]' : 'border-[var(--lb-color-border)]'}`}
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
                                    <Input unstyled
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
                                <RadiusPreview
                                    radius={radiusValue}
                                    className="grid h-[calc(var(--lb-size-control-lg)*2)] w-[calc(var(--lb-size-control-lg)*2)] place-items-center border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] text-[var(--lb-color-text-subdued)]"
                                    label={`Radius preview ${radiusValue}px`}
                                >
                                    <LayoutGrid className="h-[var(--lb-size-icon-lg)] w-[var(--lb-size-icon-lg)]" aria-hidden="true" />
                                </RadiusPreview>
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
                            description="Add small storefront CSS overrides. Unsafe constructs are blocked on save and CSS is automatically scoped to .lb-theme."
                        >
                            {/* Phase AA — CustomCssWorkspace: validated plain-textarea, no CDN.
                                RISK-DUAL-N01: writes instance custom_css value, never section_definitions. */}
                            <CustomCssWorkspace
                                value={form.custom_css}
                                onChange={(css) => updateForm('custom_css', css)}
                                saving={saving}
                                disabled={loading}
                            />
                        </Section>
                    </Card>
                </div>

                <Card>
                    <Section title="Preview" description="A lightweight sample of how the selected brand settings will feel.">
                        <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                            <RadiusPreview
                                radius={radiusValue}
                                className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] p-[var(--lb-space-4)] shadow-[var(--lb-shadow-sm)]"
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
                                <ColorPreviewButton
                                    color={form.primary_color}
                                    radius={radiusValue}
                                    type="button"
                                    className="mt-[var(--lb-space-4)] h-[var(--lb-size-control-md)] px-[var(--lb-space-4)] text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text-inverse)]"
                                >
                                    Shop now
                                </ColorPreviewButton>
                            </RadiusPreview>
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
