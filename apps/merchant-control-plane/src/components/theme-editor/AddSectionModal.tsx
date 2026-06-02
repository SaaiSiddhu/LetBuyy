'use client'

import { useState } from 'react'
import type { SectionSchema } from '@/lib/theme-schemas'
import { MaterialIcon } from '@letbuyy/ui'

interface AddSectionModalProps {
    open: boolean
    sectionSchemas: Record<string, SectionSchema>
    existingSectionTypes: string[]
    onAdd: (sectionType: string) => void
    onClose: () => void
}

export default function AddSectionModal({ open, sectionSchemas, existingSectionTypes, onAdd, onClose }: AddSectionModalProps) {
    const [search, setSearch] = useState('')

    if (!open) return null

    const availableSections = Object.entries(sectionSchemas)
        .filter(([type]) => type !== 'header' && type !== 'footer') // pinned, can't add
        .filter(([type, schema]) => {
            const q = search.toLowerCase()
            return schema.name.toLowerCase().includes(q) || type.toLowerCase().includes(q)
        })

    return (
        <div className="te-modal-backdrop" onClick={onClose}>
            <div className="te-modal" onClick={(e) => e.stopPropagation()}>
                <div className="te-modal-header">
                    <h3 className="te-modal-title">Add section</h3>
                    <button className="te-modal-close" onClick={onClose}>
                        <MaterialIcon name="close" />
                    </button>
                </div>

                <div className="te-modal-search">
                    <MaterialIcon name="search" style={{ fontSize: '16px', color: 'var(--clr-text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Search sections…"
                        className="te-modal-search-input"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="te-modal-body">
                    {availableSections.length === 0 ? (
                        <div className="te-modal-empty">No sections found</div>
                    ) : (
                        <div className="te-modal-grid">
                            {availableSections.map(([type, schema]) => {
                                const alreadyExists = existingSectionTypes.includes(type)
                                return (
                                    <button
                                        key={type}
                                        className="te-modal-section-card"
                                        onClick={() => { onAdd(type); onClose() }}
                                    >
                                        <div className="te-modal-section-icon">
                                            <MaterialIcon name={getIconForType(type)} />
                                        </div>
                                        <div className="te-modal-section-info">
                                            <span className="te-modal-section-name">{schema.name}</span>
                                            <span className="te-modal-section-desc">{schema.description}</span>
                                            {alreadyExists && (
                                                <span className="te-modal-section-badge">Already added</span>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function getIconForType(type: string): string {
    const iconMap: Record<string, string> = {
        heroBanner: 'perm_media',
        productGrid: 'grid_view',
        categoryGrid: 'category',
        brandMarquee: 'view_carousel',
        testimonials: 'format_quote',
        trustBadges: 'verified',
        newsletter: 'mail',
    }
    return iconMap[type] || 'widgets'
}
