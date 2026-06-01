'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import EditorHeader from '@/components/theme-editor/EditorHeader'
import IconRail from '@/components/theme-editor/IconRail'
import LeftSidebar from '@/components/theme-editor/LeftSidebar'
import ThemeSettingsPanel from '@/components/theme-editor/ThemeSettingsPanel'
import CenterPanel from '@/components/theme-editor/CenterPanel'
import RightSidebar from '@/components/theme-editor/RightSidebar'
import AddSectionModal from '@/components/theme-editor/AddSectionModal'
import { useEditorHistory, type TemplateConfig, type SectionEntry } from '@/hooks/useEditorHistory'
import { useEditorUrl } from '@/hooks/useEditorUrl'
import type { SectionSchema, ThemeSettingsSchema } from '@/lib/theme-schemas'

const EMPTY_TEMPLATE: TemplateConfig = {
    sections: {
        header: {
            id: 'header',
            type: 'header',
            visible: false,
            settings: {},
        },
        footer: {
            id: 'footer',
            type: 'footer',
            visible: false,
            settings: {},
        },
        template: [],
    },
    themeSettings: {},
}

const EMPTY_THEME_SETTINGS_SCHEMA: ThemeSettingsSchema = {
    schema_version: 'runtime',
    settings: {},
}

function normalizeTemplateConfig(input: unknown): TemplateConfig {
    const fallback = structuredClone(EMPTY_TEMPLATE)

    if (!input || typeof input !== 'object') {
        return fallback
    }

    const value = input as Record<string, unknown>
    const rawSections = value.sections

    if (rawSections && typeof rawSections === 'object' && !Array.isArray(rawSections)) {
        const sections = rawSections as Record<string, unknown>
        return {
            sections: {
                header: (sections.header as SectionEntry) || fallback.sections.header,
                footer: (sections.footer as SectionEntry) || fallback.sections.footer,
                template: Array.isArray(sections.template)
                    ? (sections.template as SectionEntry[])
                    : fallback.sections.template,
            },
            themeSettings: {
                ...fallback.themeSettings,
                ...((value.themeSettings as Record<string, unknown>) || {}),
            },
        }
    }

    if (Array.isArray(rawSections)) {
        const allSections = rawSections as SectionEntry[]
        const header = allSections.find(section => section.type === 'header') || fallback.sections.header
        const footer = allSections.find(section => section.type === 'footer') || fallback.sections.footer
        const template = allSections.filter(section => section.type !== 'header' && section.type !== 'footer')

        return {
            sections: {
                header,
                footer,
                template,
            },
            themeSettings: {
                ...fallback.themeSettings,
                ...((value.themeSettings as Record<string, unknown>) || {}),
            },
        }
    }

    return fallback
}

function ThemeEditorInner() {
    const params = useParams()
    const store = params?.store as string
    const themeId = params?.themeId as string

    const { state, canUndo, canRedo, pushState, replaceState, undo, redo } = useEditorHistory(EMPTY_TEMPLATE)
    const { selectedSection, setSelectedSection } = useEditorUrl()

    const [activePanel, setActivePanel] = useState<'sections' | 'themeSettings'>('sections')
    const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
    const [isLoading, setIsLoading] = useState(true)
    const [isDirty, setIsDirty] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [previewToken, setPreviewToken] = useState<string | null>(null)
    const [previewError, setPreviewError] = useState<string | null>(null)
    const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false)
    const [sectionSchemas, setSectionSchemas] = useState<Record<string, SectionSchema>>({})
    const [themeSettingsSchema, setThemeSettingsSchema] = useState<ThemeSettingsSchema>(EMPTY_THEME_SETTINGS_SCHEMA)
    const [themeName, setThemeName] = useState(themeId)

    useEffect(() => {
        let cancelled = false

        async function loadEditor() {
            setIsLoading(true)
            setLoadError(null)

            try {
                const res = await fetch(
                    `/api/themes/${themeId}/editor?store_name=${encodeURIComponent(store)}`,
                    { cache: 'no-store' }
                )
                const data = await res.json().catch(() => ({}))

                if (!res.ok) {
                    throw new Error(data.error || 'Failed to load theme editor')
                }

                if (!cancelled) {
                    replaceState(normalizeTemplateConfig(data.draftConfig || data.templateConfig))
                    if (data.sectionSchemas && typeof data.sectionSchemas === 'object') {
                        setSectionSchemas(data.sectionSchemas)
                    }
                    if (data.themeSettingsSchema?.settings) {
                        setThemeSettingsSchema(data.themeSettingsSchema)
                    }
                    if (typeof data.theme?.name === 'string') {
                        setThemeName(data.theme.name)
                    }
                    setIsDirty(false)
                }
            } catch (err) {
                if (!cancelled) {
                    setLoadError(err instanceof Error ? err.message : 'Failed to load theme editor')
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false)
                }
            }
        }

        if (store && themeId) {
            loadEditor()
        }

        return () => {
            cancelled = true
        }
    }, [store, themeId, replaceState])

    // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault()
                if (e.shiftKey) {
                    redo()
                } else {
                    undo()
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                handleSave()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [undo, redo])

    // Find the currently selected section
    const selectedSectionEntry = (() => {
        if (!selectedSection) return null
        if (state.sections.header.id === selectedSection) return state.sections.header
        if (state.sections.footer.id === selectedSection) return state.sections.footer
        return state.sections.template.find(s => s.id === selectedSection) || null
    })()

    // --- Handlers ---

    const updateSetting = useCallback((sectionId: string, key: string, value: unknown) => {
        const next = structuredClone(state)
        const update = (s: SectionEntry) => {
            if (s.id === sectionId) {
                s.settings[key] = value
                return true
            }
            return false
        }
        if (!update(next.sections.header) && !update(next.sections.footer)) {
            next.sections.template.forEach(update)
        }
        pushState(next)
        setIsDirty(true)
    }, [state, pushState])

    const toggleVisibility = useCallback((sectionId: string) => {
        const next = structuredClone(state)
        const toggle = (s: SectionEntry) => {
            if (s.id === sectionId) { s.visible = !s.visible; return true }
            return false
        }
        if (!toggle(next.sections.header) && !toggle(next.sections.footer)) {
            next.sections.template.forEach(toggle)
        }
        pushState(next)
        setIsDirty(true)
    }, [state, pushState])

    const deleteSection = useCallback((sectionId: string) => {
        const next = structuredClone(state)
        next.sections.template = next.sections.template.filter(s => s.id !== sectionId)
        if (selectedSection === sectionId) setSelectedSection(null)
        pushState(next)
        setIsDirty(true)
    }, [state, pushState, selectedSection, setSelectedSection])

    const addSection = useCallback((sectionType: string) => {
        const schema = sectionSchemas[sectionType]
        if (!schema) return
        const newSection: SectionEntry = {
            id: `${sectionType}-${Date.now()}`,
            type: sectionType,
            visible: true,
            settings: { ...schema.defaults },
        }
        const next = structuredClone(state)
        next.sections.template.push(newSection)
        pushState(next)
        setIsDirty(true)
        setSelectedSection(newSection.id)
    }, [sectionSchemas, state, pushState, setSelectedSection])

    const updateThemeSetting = useCallback((key: string, value: unknown) => {
        const next = structuredClone(state)
        next.themeSettings[key] = value
        pushState(next)
        setIsDirty(true)
    }, [state, pushState])

    const updateBlockSetting = useCallback((sectionId: string, blockId: string, key: string, value: unknown) => {
        const next = structuredClone(state)
        const update = (section: SectionEntry) => {
            if (section.id !== sectionId) return false
            const block = section.blocks?.find(entry => entry.id === blockId)
            if (!block) return true
            block.settings[key] = value
            return true
        }

        if (!update(next.sections.header) && !update(next.sections.footer)) {
            next.sections.template.forEach(update)
        }

        pushState(next)
        setIsDirty(true)
    }, [state, pushState])

    const addBlock = useCallback((sectionId: string, blockType: string) => {
        const next = structuredClone(state)
        const add = (section: SectionEntry) => {
            if (section.id !== sectionId) return false
            const sectionSchema = sectionSchemas[section.type]
            const blockSchema = sectionSchema?.blocks_schema?.[blockType]
            if (!blockSchema) return true

            const settings = Object.fromEntries(
                Object.entries(blockSchema.fields).map(([key, field]) => [key, field.default ?? ''])
            )

            section.blocks = [
                ...(section.blocks || []),
                {
                    id: `${blockType}-${Date.now()}`,
                    type: blockType,
                    settings,
                },
            ]
            return true
        }

        if (!add(next.sections.header) && !add(next.sections.footer)) {
            next.sections.template.forEach(add)
        }

        pushState(next)
        setIsDirty(true)
    }, [sectionSchemas, state, pushState])

    const deleteBlock = useCallback((sectionId: string, blockId: string) => {
        const next = structuredClone(state)
        const remove = (section: SectionEntry) => {
            if (section.id !== sectionId) return false
            section.blocks = (section.blocks || []).filter(block => block.id !== blockId)
            return true
        }

        if (!remove(next.sections.header) && !remove(next.sections.footer)) {
            next.sections.template.forEach(remove)
        }

        pushState(next)
        setIsDirty(true)
    }, [state, pushState])

    const saveDraft = useCallback(async () => {
        const res = await fetch(
            `/api/themes/${themeId}/editor/draft?store_name=${encodeURIComponent(store)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ draftConfig: state }),
            }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            throw new Error(data.error?.message || (typeof data.error === 'string' ? data.error : res.statusText))
        }

        return data
    }, [themeId, store, state])

    const handleSave = useCallback(async () => {
        setIsSaving(true)
        try {
            await saveDraft()
            setLoadError(null)
            setIsDirty(false)
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Failed to save draft')
        } finally {
            setIsSaving(false)
        }
    }, [saveDraft])

    const handlePublish = useCallback(async () => {
        setIsPublishing(true)
        try {
            const res = await fetch(
                `/api/themes/${themeId}/editor?store_name=${encodeURIComponent(store)}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ templateConfig: state }),
                }
            )
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data.error?.message || (typeof data.error === 'string' ? data.error : res.statusText))
            }
            setLoadError(null)
            setIsDirty(false)
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Failed to publish theme')
        } finally {
            setIsPublishing(false)
        }
    }, [themeId, store, state])

    useEffect(() => {
        if (!store || !themeId || isLoading || loadError) return

        let cancelled = false
        const timer = window.setTimeout(async () => {
            setIsPreviewRefreshing(true)
            setPreviewError(null)

            try {
                await saveDraft()
                const res = await fetch(`/api/themes/${themeId}/preview-session?store_name=${encodeURIComponent(store)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ store_name: store, ttl_seconds: 900 }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) {
                    throw new Error(data.error?.message || data.error || res.statusText)
                }

                const token = data.data?.preview_token
                if (!cancelled && typeof token === 'string') {
                    setPreviewToken(token)
                }
            } catch (err) {
                if (!cancelled) {
                    setPreviewError(err instanceof Error ? err.message : 'Unable to refresh preview')
                }
            } finally {
                if (!cancelled) {
                    setIsPreviewRefreshing(false)
                }
            }
        }, 700)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [store, themeId, state, isLoading, loadError, saveDraft])

    if (isLoading) {
        return <ThemeEditorLoading />
    }

    if (loadError) {
        return (
            <div className="te-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--clr-bg-secondary, #f8f8f8)' }}>
                <div style={{ textAlign: 'center', maxWidth: 420 }}>
                    <p style={{ fontWeight: 700, marginBottom: 8 }}>Theme editor could not load</p>
                    <p style={{ color: 'var(--clr-text-secondary)', marginBottom: 16 }}>{loadError}</p>
                    <button className="te-header-save" onClick={() => window.location.reload()}>
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="te-root">
            {/* Header */}
            <EditorHeader
                storeName={store}
                themeName={themeName}
                themeId={themeId}
                isDirty={isDirty}
                isSaving={isSaving}
                isPublishing={isPublishing}
                canUndo={canUndo}
                canRedo={canRedo}
                onSave={handleSave}
                onPublish={handlePublish}
                onUndo={undo}
                onRedo={redo}
            />

            {/* Body */}
            <div className="te-body">
                {/* Icon Rail */}
                <IconRail
                    activePanel={activePanel}
                    viewport={viewport}
                    onPanelChange={setActivePanel}
                    onViewportChange={setViewport}
                />

                {/* Left Panel */}
                {activePanel === 'sections' ? (
                    <LeftSidebar
                        headerSection={state.sections.header}
                        footerSection={state.sections.footer}
                        templateSections={state.sections.template}
                        sectionSchemas={sectionSchemas}
                        selectedSectionId={selectedSection}
                        onSelectSection={setSelectedSection}
                        onToggleVisibility={toggleVisibility}
                        onDeleteSection={deleteSection}
                        onAddSection={() => setShowAddModal(true)}
                    />
                ) : (
                    <ThemeSettingsPanel
                        themeSettings={state.themeSettings}
                        settingsSchema={themeSettingsSchema}
                        onSettingChange={updateThemeSetting}
                    />
                )}

                {/* Center Preview */}
                <CenterPanel
                    storeName={store}
                    viewport={viewport}
                    previewToken={previewToken}
                    previewError={previewError}
                    isPreviewRefreshing={isPreviewRefreshing}
                    selectedSectionId={selectedSection}
                />

                {/* Right Sidebar */}
                {selectedSection && activePanel === 'sections' && (
                    <RightSidebar
                        section={selectedSectionEntry}
                        sectionSchemas={sectionSchemas}
                        onSettingChange={updateSetting}
                        onBlockSettingChange={updateBlockSetting}
                        onAddBlock={addBlock}
                        onDeleteBlock={deleteBlock}
                        onClose={() => setSelectedSection(null)}
                        storeName={store}
                    />
                )}
            </div>

            {/* Add Section Modal */}
            <AddSectionModal
                open={showAddModal}
                sectionSchemas={sectionSchemas}
                existingSectionTypes={state.sections.template.map(s => s.type)}
                onAdd={addSection}
                onClose={() => setShowAddModal(false)}
            />
        </div>
    )
}

export default function ThemeEditorPage() {
    return (
        <Suspense fallback={<ThemeEditorLoading />}>
            <ThemeEditorInner />
        </Suspense>
    )
}

function ThemeEditorLoading() {
    return (
        <div className="te-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--clr-bg-secondary, #f8f8f8)' }}>
            <div style={{ textAlign: 'center' }}>
                <span className="te-spinner" style={{ width: 32, height: 32 }} />
                <p style={{ marginTop: 16, color: 'var(--clr-text-secondary)' }}>Loading editor…</p>
            </div>
        </div>
    )
}
