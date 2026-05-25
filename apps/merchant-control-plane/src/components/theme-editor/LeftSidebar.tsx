'use client'

import { useState } from 'react'
import SectionItem from './SectionItem'
import type { SectionEntry } from '@/hooks/useEditorHistory'
import type { SectionSchema } from '@/lib/theme-schemas'

interface LeftSidebarProps {
    headerSection: SectionEntry
    footerSection: SectionEntry
    templateSections: SectionEntry[]
    sectionSchemas: Record<string, SectionSchema>
    selectedSectionId: string | null
    onSelectSection: (id: string) => void
    onToggleVisibility: (id: string) => void
    onDeleteSection: (id: string) => void
    onAddSection: () => void
}

export default function LeftSidebar({
    headerSection,
    footerSection,
    templateSections,
    sectionSchemas,
    selectedSectionId,
    onSelectSection,
    onToggleVisibility,
    onDeleteSection,
    onAddSection,
}: LeftSidebarProps) {
    const [searchTerm, setSearchTerm] = useState('')

    const filteredSections = templateSections.filter((s) => {
        const schema = sectionSchemas[s.type]
        const name = schema?.name || s.type
        return name.toLowerCase().includes(searchTerm.toLowerCase())
    })

    return (
        <aside className="te-left-sidebar">
            <div className="te-left-sidebar-header">
                <h3 className="te-left-sidebar-title">Sections</h3>
            </div>

            {/* Search */}
            <div className="te-left-sidebar-search">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--clr-text-secondary)' }}>search</span>
                <input
                    type="text"
                    placeholder="Filter sections…"
                    className="te-left-sidebar-search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Pinned Header */}
            <div className="te-left-sidebar-group">
                <span className="te-left-sidebar-group-label">Header</span>
                <SectionItem
                    section={headerSection}
                    sectionName={sectionSchemas[headerSection.type]?.name || 'Header'}
                    isSelected={selectedSectionId === headerSection.id}
                    isPinned
                    onSelect={() => onSelectSection(headerSection.id)}
                    onToggleVisibility={() => onToggleVisibility(headerSection.id)}
                />
            </div>

            {/* Template Sections */}
            <div className="te-left-sidebar-group te-left-sidebar-group--scroll">
                <span className="te-left-sidebar-group-label">Template</span>

                {filteredSections.length === 0 && searchTerm ? (
                    <div className="te-left-sidebar-empty">No sections matching &ldquo;{searchTerm}&rdquo;</div>
                ) : (
                    filteredSections.map((section) => (
                        <SectionItem
                            key={section.id}
                            section={section}
                            sectionName={sectionSchemas[section.type]?.name || section.type}
                            isSelected={selectedSectionId === section.id}
                            isPinned={false}
                            onSelect={() => onSelectSection(section.id)}
                            onToggleVisibility={() => onToggleVisibility(section.id)}
                            onDelete={() => onDeleteSection(section.id)}
                        />
                    ))
                )}

                <button className="te-add-section-btn" onClick={onAddSection}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                    Add section
                </button>
            </div>

            {/* Pinned Footer */}
            <div className="te-left-sidebar-group">
                <span className="te-left-sidebar-group-label">Footer</span>
                <SectionItem
                    section={footerSection}
                    sectionName={sectionSchemas[footerSection.type]?.name || 'Footer'}
                    isSelected={selectedSectionId === footerSection.id}
                    isPinned
                    onSelect={() => onSelectSection(footerSection.id)}
                    onToggleVisibility={() => onToggleVisibility(footerSection.id)}
                />
            </div>
        </aside>
    )
}
