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
import { SECTION_SCHEMAS } from '@/lib/theme-schemas'

// Default template config for Urban Kicks
const DEFAULT_TEMPLATE: TemplateConfig = {
    sections: {
        header: {
            id: 'header',
            type: 'header',
            visible: true,
            settings: {
                behavior: 'sticky',
                logoPlacement: 'left',
                displayMode: 'name',
                showSearch: true,
                showCart: true,
                showAccount: false,
            },
        },
        footer: {
            id: 'footer',
            type: 'footer',
            visible: true,
            settings: {
                columns: 3,
                showLogo: true,
                showNewsletter: true,
                showSocial: true,
                showPaymentIcons: true,
                copyrightText: '© 2026 Urban Kicks. All rights reserved.',
                instagramUrl: 'https://instagram.com/urbankicks',
                twitterUrl: 'https://twitter.com/urbankicks',
                contactEmail: 'hello@urban-kicks.store',
            },
        },
        template: [
            {
                id: 'hero-1',
                type: 'heroBanner',
                visible: true,
                settings: {
                    heading: 'Streetwear 2026',
                    subheading: 'The future of fashion is here.',
                    ctaText: 'Shop New Arrivals',
                    ctaLink: '#products',
                    image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=2000',
                    overlay: 0.4,
                    height: 'full',
                    textAlign: 'center',
                },
            },
            {
                id: 'brand-marquee-1',
                type: 'brandMarquee',
                visible: true,
                settings: {
                    title: 'Trusted by top brands worldwide',
                    speed: 25,
                    pauseOnHover: true,
                },
            },
            {
                id: 'product-grid-1',
                type: 'productGrid',
                visible: true,
                settings: {
                    title: 'Trending Drops',
                    subtitle: 'Hottest picks this season',
                    columns: 4,
                    rows: 2,
                    showPrice: true,
                    showRating: true,
                    showAddToCart: true,
                    cardStyle: 'minimal',
                    sortBy: 'newest',
                },
            },
            {
                id: 'category-grid-1',
                type: 'categoryGrid',
                visible: true,
                settings: {
                    title: 'Shop by Category',
                    subtitle: 'Find exactly what you\'re looking for',
                    columns: 3,
                    cardStyle: 'overlay',
                },
            },
            {
                id: 'testimonials-1',
                type: 'testimonials',
                visible: true,
                settings: {
                    title: 'What Our Customers Say',
                    subtitle: 'Real reviews from real sneakerheads',
                    layout: 'carousel',
                    autoplay: true,
                    showRating: true,
                    showImage: false,
                },
            },
            {
                id: 'trust-badges-1',
                type: 'trustBadges',
                visible: true,
                settings: { title: '' },
            },
            {
                id: 'newsletter-1',
                type: 'newsletter',
                visible: true,
                settings: {
                    title: 'Stay in the Loop',
                    subtitle: 'Get early access to new drops and exclusive discounts.',
                    buttonText: 'Subscribe',
                    placeholder: 'Enter your email',
                    backgroundColor: 'transparent',
                    successMessage: 'Thanks for subscribing!',
                },
            },
        ],
    },
    themeSettings: {
        primaryColor: '#000000',
        secondaryColor: '#FFFFFF',
        accentColor: '#E5E5E5',
        backgroundColor: '#FFFFFF',
        textColor: '#1A1A2E',
        fontFamily: 'Inter',
        headingFontFamily: 'Inter',
        borderRadius: 12,
        enableAnimations: true,
        enableShadows: true,
    },
}

function ThemeEditorInner() {
    const params = useParams()
    const store = params?.store as string
    const themeId = params?.themeId as string

    const { state, canUndo, canRedo, pushState, undo, redo } = useEditorHistory(DEFAULT_TEMPLATE)
    const { selectedSection, setSelectedSection } = useEditorUrl()

    const [activePanel, setActivePanel] = useState<'sections' | 'themeSettings'>('sections')
    const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
    const [isDirty, setIsDirty] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)

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
        const schema = SECTION_SCHEMAS[sectionType]
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
    }, [state, pushState, setSelectedSection])

    const updateThemeSetting = useCallback((key: string, value: unknown) => {
        const next = structuredClone(state)
        next.themeSettings[key] = value
        pushState(next)
        setIsDirty(true)
    }, [state, pushState])

    const handleSave = useCallback(async () => {
        setIsSaving(true)
        try {
            const res = await fetch(
                `/api/themes/${themeId}/editor?store_name=${encodeURIComponent(store)}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ templateConfig: state }),
                }
            )
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.error('[Editor Save] Failed:', data.error || res.statusText)
            }
        } catch (err) {
            console.error('[Editor Save] Error:', err)
        } finally {
            setIsSaving(false)
            setIsDirty(false)
        }
    }, [themeId, store, state])

    return (
        <div className="te-root">
            {/* Header */}
            <EditorHeader
                storeName={store}
                themeName={themeId === 'urban-kicks' ? 'Urban Kicks' : themeId}
                themeId={themeId}
                isDirty={isDirty}
                isSaving={isSaving}
                canUndo={canUndo}
                canRedo={canRedo}
                onSave={handleSave}
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
                        selectedSectionId={selectedSection}
                        onSelectSection={setSelectedSection}
                        onToggleVisibility={toggleVisibility}
                        onDeleteSection={deleteSection}
                        onAddSection={() => setShowAddModal(true)}
                    />
                ) : (
                    <ThemeSettingsPanel
                        themeSettings={state.themeSettings}
                        onSettingChange={updateThemeSetting}
                    />
                )}

                {/* Center Preview */}
                <CenterPanel
                    viewport={viewport}
                    headerSection={state.sections.header}
                    footerSection={state.sections.footer}
                    templateSections={state.sections.template}
                    selectedSectionId={selectedSection}
                    onSelectSection={setSelectedSection}
                />

                {/* Right Sidebar */}
                {selectedSection && activePanel === 'sections' && (
                    <RightSidebar
                        section={selectedSectionEntry}
                        onSettingChange={updateSetting}
                        onClose={() => setSelectedSection(null)}
                    />
                )}
            </div>

            {/* Add Section Modal */}
            <AddSectionModal
                open={showAddModal}
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
