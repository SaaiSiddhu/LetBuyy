'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Button, EmptyState, FileJson, Monitor, RefreshCw, Save, SaveBar, Send, Settings, useToast } from '@letbuyy/ui'
import SchemaFormRenderer from '@/components/theme-editor/SchemaFormRenderer'
import type { SchemaField, ThemeSettingsGroup, ThemeSettingsSchema } from '@/lib/theme-schemas'

type JsonRecord = Record<string, unknown>

type SettingsData = {
    current: JsonRecord
    presets: JsonRecord
}

type ApiEditorResponse = {
    store?: {
        name?: string
        subdomain?: string
        status?: string
    }
    theme?: {
        name?: string
        slug?: string
        schema_source?: string
        schema_manifest_version?: string
    }
    templateConfig?: unknown
    draftConfig?: unknown
    draftSavedAt?: string | null
    release?: {
        version?: number
        published_at?: string
    } | null
    themeSettingsSchema?: unknown
    version?: number
}

const EMPTY_SETTINGS_SCHEMA: ThemeSettingsSchema = {
    schema_version: '2026-05-json-contract',
    settings: {},
}

const EMPTY_SETTINGS_DATA: SettingsData = {
    current: {},
    presets: {},
}

const FIELD_TYPES = new Set([
    'text',
    'textarea',
    'richtext',
    'color',
    'image',
    'select',
    'toggle',
    'range',
    'number',
    'url',
    'radio',
])

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as JsonRecord)
        : {}
}

function stringValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function optionalString(value: unknown): string | undefined {
    const text = stringValue(value)
    return text.length > 0 ? text : undefined
}

function numberValue(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function labelFromKey(key: string): string {
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeFieldType(value: unknown): SchemaField['type'] {
    const rawType = typeof value === 'string' ? value : 'text'
    if (rawType === 'checkbox') return 'toggle'
    if (rawType === 'font') return 'select'
    return FIELD_TYPES.has(rawType) ? (rawType as SchemaField['type']) : 'text'
}

function normalizeFieldOptions(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined

    const options = value.flatMap((entry) => {
        if (typeof entry === 'string') return [entry]
        const record = asRecord(entry)
        const optionValue = record.value
        if (typeof optionValue === 'string') return [optionValue]
        if (typeof optionValue === 'number' || typeof optionValue === 'boolean') return [String(optionValue)]
        return []
    })

    return options.length > 0 ? options : undefined
}

function normalizeField(key: string, value: unknown): SchemaField {
    const record = asRecord(value)
    return {
        type: normalizeFieldType(record.type),
        label: stringValue(record.label, labelFromKey(key)),
        default: record.default,
        maxLength: numberValue(record.maxLength) ?? numberValue(record.max_length),
        options: normalizeFieldOptions(record.options),
        min: numberValue(record.min),
        max: numberValue(record.max),
        step: numberValue(record.step),
        unit: optionalString(record.unit),
        info: optionalString(record.info) || optionalString(record.help_text),
        description: optionalString(record.description),
    }
}

function normalizeFields(value: unknown): Record<string, SchemaField> {
    if (Array.isArray(value)) {
        return value.reduce<Record<string, SchemaField>>((acc, entry, index) => {
            const record = asRecord(entry)
            const id = stringValue(record.id, `field_${index + 1}`)
            acc[id] = normalizeField(id, record)
            return acc
        }, {})
    }

    return Object.entries(asRecord(value)).reduce<Record<string, SchemaField>>((acc, [key, field]) => {
        acc[key] = normalizeField(key, field)
        return acc
    }, {})
}

function normalizeSettingsSchema(value: unknown): ThemeSettingsSchema {
    const record = asRecord(value)
    const groups = asRecord(record.settings)

    if (Object.keys(groups).length > 0) {
        return {
            schema_version: stringValue(record.schema_version, EMPTY_SETTINGS_SCHEMA.schema_version),
            settings: Object.entries(groups).reduce<Record<string, ThemeSettingsGroup>>((acc, [groupKey, groupValue]) => {
                const group = asRecord(groupValue)
                acc[groupKey] = {
                    label: stringValue(group.label, labelFromKey(groupKey)),
                    description: stringValue(group.description),
                    fields: normalizeFields(group.fields),
                }
                return acc
            }, {}),
        }
    }

    if (Object.prototype.hasOwnProperty.call(record, 'settings')) {
        return {
            schema_version: stringValue(record.schema_version, EMPTY_SETTINGS_SCHEMA.schema_version),
            settings: {},
        }
    }

    const fields = normalizeFields(Array.isArray(value) ? value : record)
    if (Object.keys(fields).length === 0) return EMPTY_SETTINGS_SCHEMA

    return {
        schema_version: stringValue(record.schema_version, EMPTY_SETTINGS_SCHEMA.schema_version),
        settings: {
            general: {
                label: 'Theme settings',
                description: '',
                fields,
            },
        },
    }
}

function defaultValueForField(field: SchemaField): unknown {
    if (field.default !== undefined) return field.default
    if (field.type === 'toggle') return false
    if (field.type === 'number' || field.type === 'range') return field.min ?? 0
    if (field.type === 'color') return '#000000'
    return ''
}

function defaultSettings(schema: ThemeSettingsSchema): JsonRecord {
    return Object.values(schema.settings).reduce<JsonRecord>((acc, group) => {
        for (const [key, field] of Object.entries(group.fields)) {
            acc[key] = defaultValueForField(field)
        }
        return acc
    }, {})
}

function normalizeTemplateConfig(value: unknown): JsonRecord {
    return asRecord(value)
}

function normalizeSettingsData(templateConfig: JsonRecord, schema: ThemeSettingsSchema): SettingsData {
    const configSettingsData = asRecord(asRecord(asRecord(templateConfig.config).settings_data))
    const rootSettingsData = asRecord(templateConfig.settings_data)

    return {
        current: {
            ...defaultSettings(schema),
            ...asRecord(configSettingsData.current),
            ...asRecord(rootSettingsData.current),
            ...asRecord(templateConfig.themeSettings),
        },
        presets: {
            ...asRecord(configSettingsData.presets),
            ...asRecord(rootSettingsData.presets),
        },
    }
}

function buildDraftConfig(templateConfig: JsonRecord, settingsData: SettingsData): JsonRecord {
    const config = asRecord(templateConfig.config)
    const configSettingsData = asRecord(config.settings_data)
    const rootSettingsData = asRecord(templateConfig.settings_data)
    const nextSettingsData = {
        current: settingsData.current,
        presets: {
            ...asRecord(configSettingsData.presets),
            ...asRecord(rootSettingsData.presets),
            ...settingsData.presets,
        },
    }

    return {
        ...templateConfig,
        config: {
            ...config,
            settings_data: nextSettingsData,
        },
        settings_data: {
            ...rootSettingsData,
            ...nextSettingsData,
        },
        themeSettings: settingsData.current,
    }
}

function findField(schema: ThemeSettingsSchema, key: string): SchemaField | null {
    for (const group of Object.values(schema.settings)) {
        const field = group.fields[key]
        if (field) return field
    }
    return null
}

function coerceFieldValue(field: SchemaField | null, value: unknown): unknown {
    if (!field) return value
    if (field.type === 'toggle') return Boolean(value)
    if (field.type === 'number' || field.type === 'range') {
        return typeof value === 'number' && Number.isFinite(value) ? value : Number(value || 0)
    }
    return value
}

function previewBaseUrl() {
    const configured = process.env.NEXT_PUBLIC_STOREFRONT_URL?.replace(/\/$/, '')
    if (configured) return configured
    if (typeof window === 'undefined') return ''
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3003'
        : window.location.origin
}

function ThemeSettingsEditorInner() {
    const params = useParams()
    const store = params?.store as string
    const themeId = params?.themeId as string
    const { notify } = useToast()

    const [schema, setSchema] = useState<ThemeSettingsSchema>(EMPTY_SETTINGS_SCHEMA)
    const [baseConfig, setBaseConfig] = useState<JsonRecord>({})
    const [settingsData, setSettingsData] = useState<SettingsData>(EMPTY_SETTINGS_DATA)
    const [themeName, setThemeName] = useState(themeId)
    const [schemaSource, setSchemaSource] = useState('runtime')
    const [version, setVersion] = useState<number | null>(null)
    const [savedAt, setSavedAt] = useState<string | null>(null)
    const [activeGroup, setActiveGroup] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isDirty, setIsDirty] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [previewToken, setPreviewToken] = useState<string | null>(null)
    const [previewUnavailable, setPreviewUnavailable] = useState(false)
    const [previewRetryNonce, setPreviewRetryNonce] = useState(0)

    const groups = useMemo(() => Object.entries(schema.settings), [schema])
    const visibleGroups = useMemo(() => {
        if (!activeGroup) return groups
        return groups.filter(([key]) => key === activeGroup)
    }, [activeGroup, groups])

    const previewUrl = useMemo(() => {
        const baseUrl = previewBaseUrl()
        if (!baseUrl || !store) return ''
        const url = new URL(`/store/${encodeURIComponent(store)}`, baseUrl)
        url.searchParams.set('editor', '1')
        if (previewToken) url.searchParams.set('theme_preview_token', previewToken)
        return url.toString()
    }, [previewToken, store])

    useEffect(() => {
        if (!previewUrl) {
            setPreviewUnavailable(false)
            return undefined
        }

        setPreviewUnavailable(false)
        const timer = window.setTimeout(() => setPreviewUnavailable(true), 2500)
        return () => window.clearTimeout(timer)
    }, [previewRetryNonce, previewUrl])

    const refreshPreview = useCallback(async (announce = false) => {
        if (!store || !themeId) return
        try {
            const res = await fetch(`/api/themes/${themeId}/preview-session?store_name=${encodeURIComponent(store)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_name: store, ttl_seconds: 900 }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                const errorRecord = asRecord(asRecord(data).error)
                throw new Error(stringValue(errorRecord.message, stringValue(asRecord(data).error, 'Preview session failed')))
            }
            const token = asRecord(data.data).preview_token
            if (typeof token === 'string') setPreviewToken(token)
            if (announce) {
                notify({
                    title: 'Preview refreshed',
                    description: 'The storefront preview has a fresh editor session.',
                    variant: 'success',
                })
            }
        } catch (err) {
            if (announce) {
                notify({
                    title: 'Preview refresh failed',
                    description: err instanceof Error ? err.message : 'Try refreshing the preview again.',
                    variant: 'critical',
                })
            }
        }
    }, [notify, store, themeId])

    const handlePreviewRetry = useCallback(() => {
        setPreviewUnavailable(false)
        setPreviewRetryNonce((value) => value + 1)
        void refreshPreview(true)
    }, [refreshPreview])

    const loadEditor = useCallback(async () => {
        if (!store || !themeId) return

        setIsLoading(true)
        setLoadError(null)

        try {
            const res = await fetch(
                `/api/themes/${themeId}/editor?store_name=${encodeURIComponent(store)}`,
                { cache: 'no-store' }
            )
            const data = await res.json().catch(() => ({})) as ApiEditorResponse

            if (!res.ok) {
                const errorRecord = asRecord((data as { error?: unknown }).error)
                throw new Error(stringValue(errorRecord.message, stringValue((data as { error?: unknown }).error, 'Failed to load theme editor')))
            }

            const nextSchema = normalizeSettingsSchema(data.themeSettingsSchema)
            const nextConfig = normalizeTemplateConfig(data.draftConfig || data.templateConfig)
            setSchema(nextSchema)
            setBaseConfig(nextConfig)
            setSettingsData(normalizeSettingsData(nextConfig, nextSchema))
            setThemeName(stringValue(data.theme?.name, themeId))
            setSchemaSource(stringValue(data.theme?.schema_source, 'runtime'))
            setVersion(typeof data.version === 'number' ? data.version : null)
            setSavedAt(data.draftSavedAt || null)
            setActiveGroup((current) => current || Object.keys(nextSchema.settings)[0] || null)
            setIsDirty(false)
            await refreshPreview()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load theme editor'
            setLoadError(message)
            notify({
                title: 'Theme editor could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setIsLoading(false)
        }
    }, [notify, refreshPreview, store, themeId])

    useEffect(() => {
        void loadEditor()
    }, [loadEditor])

    const updateSetting = useCallback((key: string, value: unknown) => {
        setSettingsData((current) => ({
            ...current,
            current: {
                ...current.current,
                [key]: coerceFieldValue(findField(schema, key), value),
            },
        }))
        setIsDirty(true)
    }, [schema])

    const saveDraft = useCallback(async () => {
        const draftConfig = buildDraftConfig(baseConfig, settingsData)
        const res = await fetch(
            `/api/themes/${themeId}/editor/draft?store_name=${encodeURIComponent(store)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ draftConfig }),
            }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            const errorRecord = asRecord(asRecord(data).error)
            throw new Error(stringValue(errorRecord.message, stringValue(asRecord(data).error, res.statusText)))
        }

        setBaseConfig(draftConfig)
        setVersion(typeof asRecord(data).version === 'number' ? (asRecord(data).version as number) : version)
        setSavedAt(stringValue(asRecord(data).savedAt, new Date().toISOString()))
        setIsDirty(false)
        await refreshPreview()
        return data
    }, [baseConfig, refreshPreview, settingsData, store, themeId, version])

    const handleSave = useCallback(async () => {
        setIsSaving(true)
        try {
            await saveDraft()
            notify({
                title: 'Theme draft saved',
                description: 'Settings data has been saved to the current draft.',
                variant: 'success',
            })
        } catch (err) {
            notify({
                title: 'Theme draft save failed',
                description: err instanceof Error ? err.message : 'Failed to save settings data.',
                variant: 'critical',
            })
        } finally {
            setIsSaving(false)
        }
    }, [notify, saveDraft])

    const handlePublish = useCallback(async () => {
        setIsPublishing(true)
        try {
            const templateConfig = buildDraftConfig(baseConfig, settingsData)
            const res = await fetch(
                `/api/themes/${themeId}/editor?store_name=${encodeURIComponent(store)}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ templateConfig }),
                }
            )
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                const errorRecord = asRecord(asRecord(data).error)
                throw new Error(stringValue(errorRecord.message, stringValue(asRecord(data).error, res.statusText)))
            }
            setBaseConfig(templateConfig)
            setIsDirty(false)
            setSavedAt(new Date().toISOString())
            await refreshPreview()
            notify({
                title: 'Theme published',
                description: 'The current theme settings are now live on the storefront.',
                variant: 'success',
            })
        } catch (err) {
            notify({
                title: 'Theme publish failed',
                description: err instanceof Error ? err.message : 'Failed to publish theme.',
                variant: 'critical',
            })
        } finally {
            setIsPublishing(false)
        }
    }, [baseConfig, notify, refreshPreview, settingsData, store, themeId])

    const handleDiscard = useCallback(() => {
        setSettingsData(normalizeSettingsData(baseConfig, schema))
        setIsDirty(false)
        notify({
            title: 'Theme changes discarded',
            description: 'Unsaved settings have been reset to the saved draft.',
            variant: 'info',
        })
    }, [baseConfig, notify, schema])

    if (isLoading) return <EditorLoading />

    if (loadError) {
        return (
            <main className="generic-theme-editor generic-theme-editor--centered">
                <section className="generic-theme-editor__state" role="alert">
                    <AlertTriangle size={28} aria-hidden="true" />
                    <h1>Theme editor could not load</h1>
                    <p>{loadError}</p>
                    <button className="os-btn os-btn-primary" type="button" onClick={() => void loadEditor()}>
                        <RefreshCw size={16} aria-hidden="true" />
                        Retry
                    </button>
                </section>
            </main>
        )
    }

    return (
        <main className="generic-theme-editor">
            <header className="generic-theme-editor__header">
                <div className="generic-theme-editor__header-left">
                    <Link href={`/${store}/online-store/themes`} className="generic-theme-editor__icon-button" aria-label="Back to themes">
                        <ArrowLeft size={18} aria-hidden="true" />
                    </Link>
                    <div>
                        <p className="generic-theme-editor__eyebrow">{schemaSource} schema</p>
                        <h1>{themeName}</h1>
                    </div>
                </div>
                <div className="generic-theme-editor__header-actions">
                    <button className="os-btn os-btn-outline" type="button" onClick={handleSave} disabled={isSaving || isPublishing || !isDirty}>
                        {isSaving ? <RefreshCw className="generic-theme-editor__spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
                        Save
                    </button>
                    <button className="os-btn os-btn-primary" type="button" onClick={handlePublish} disabled={isSaving || isPublishing}>
                        {isPublishing ? <RefreshCw className="generic-theme-editor__spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                        Publish
                    </button>
                </div>
            </header>

            <div className="generic-theme-editor__body">
                <aside className="generic-theme-editor__sidebar" aria-label="Settings groups">
                    <div className="generic-theme-editor__sidebar-card">
                        <div className="generic-theme-editor__sidebar-title">
                            <Settings size={16} aria-hidden="true" />
                            <span>Settings groups</span>
                        </div>
                        <button
                            className={`generic-theme-editor__group-button ${activeGroup === null ? 'generic-theme-editor__group-button--active' : ''}`}
                            type="button"
                            onClick={() => setActiveGroup(null)}
                        >
                            All settings
                        </button>
                        {groups.map(([groupKey, group]) => (
                            <button
                                key={groupKey}
                                className={`generic-theme-editor__group-button ${activeGroup === groupKey ? 'generic-theme-editor__group-button--active' : ''}`}
                                type="button"
                                onClick={() => setActiveGroup(groupKey)}
                            >
                                {group.label}
                            </button>
                        ))}
                    </div>
                    <div className="generic-theme-editor__schema-card">
                        <FileJson size={18} aria-hidden="true" />
                        <div>
                            <span>config/settings_schema.json</span>
                            <strong>config/settings_data.json</strong>
                            {version ? <small>Draft v{version}</small> : null}
                            {savedAt ? <small>Saved {new Date(savedAt).toLocaleString()}</small> : null}
                        </div>
                    </div>
                </aside>

                <section className="generic-theme-editor__settings" aria-label="Generated theme settings">
                    {visibleGroups.length === 0 ? (
                        <EmptyState
                            className="min-h-[260px]"
                            icon={<FileJson className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="No editable fields"
                            body="This theme schema does not define editable settings yet."
                        />
                    ) : (
                        visibleGroups.map(([groupKey, group]) => (
                            <section className="generic-theme-editor__group" key={groupKey}>
                                <div className="generic-theme-editor__group-header">
                                    <h2>{group.label}</h2>
                                    {group.description ? <p>{group.description}</p> : null}
                                </div>
                                <div className="generic-theme-editor__fields">
                                    <SchemaFormRenderer
                                        schema={group.fields}
                                        values={settingsData.current}
                                        onChange={updateSetting}
                                        storeName={store}
                                    />
                                </div>
                            </section>
                        ))
                    )}
                </section>

                <aside className="generic-theme-editor__preview" aria-label="Theme preview">
                    <div className="generic-theme-editor__preview-header">
                        <span>{store}.letbuyy.store</span>
                        <button className="generic-theme-editor__icon-button" type="button" onClick={handlePreviewRetry} aria-label="Refresh preview">
                            <RefreshCw size={16} aria-hidden="true" />
                        </button>
                    </div>
                    {previewUrl ? (
                        <div className="relative flex flex-1">
                            <iframe
                                className="generic-theme-editor__iframe"
                                title={`${store} storefront preview`}
                                src={previewUrl}
                                sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
                                onLoad={() => setPreviewUnavailable(false)}
                            />
                            {previewUnavailable ? (
                                <div className="absolute inset-[var(--lb-space-4)] flex">
                                    <EmptyState
                                        className="min-h-[240px] flex-1 p-[var(--lb-space-6)]"
                                        icon={<Monitor className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                        title="Preview unavailable"
                                        body="The storefront preview could not load. Refresh the preview to try again."
                                        primaryAction={(
                                            <Button type="button" variant="secondary" size="sm" onClick={handlePreviewRetry}>
                                                <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                Retry preview
                                            </Button>
                                        )}
                                    />
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <EmptyState
                            className="m-[var(--lb-space-4)] min-h-[560px] flex-1 p-[var(--lb-space-6)]"
                            icon={<Monitor className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                            title="Preview unavailable"
                            body="Refresh the preview after the storefront session is available."
                            primaryAction={(
                                <Button type="button" variant="secondary" size="sm" onClick={handlePreviewRetry}>
                                    <RefreshCw className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Retry preview
                                </Button>
                            )}
                        />
                    )}
                </aside>
            </div>

            <SaveBar
                state={isSaving ? 'saving' : isDirty ? 'unsaved' : 'saved'}
                saveLabel="Save draft"
                discardLabel="Discard changes"
                onSave={() => void handleSave()}
                onDiscard={handleDiscard}
            />
        </main>
    )
}

export default function ThemeEditorPage() {
    return (
        <Suspense fallback={<EditorLoading />}>
            <ThemeSettingsEditorInner />
        </Suspense>
    )
}

function EditorLoading() {
    return (
        <main className="generic-theme-editor generic-theme-editor--centered">
            <section className="generic-theme-editor__state" role="status">
                <RefreshCw className="generic-theme-editor__spin" size={28} aria-hidden="true" />
                <h1>Loading editor</h1>
            </section>
        </main>
    )
}
