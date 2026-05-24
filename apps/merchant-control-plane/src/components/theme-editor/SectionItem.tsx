'use client'

import type { SectionEntry } from '@/hooks/useEditorHistory'

interface SectionItemProps {
    section: SectionEntry
    sectionName: string
    isSelected: boolean
    isPinned: boolean
    onSelect: () => void
    onToggleVisibility: () => void
    onDelete?: () => void
}

export default function SectionItem({
    section,
    sectionName,
    isSelected,
    isPinned,
    onSelect,
    onToggleVisibility,
    onDelete,
}: SectionItemProps) {
    return (
        <div
            className={`te-section-item ${isSelected ? 'te-section-item--selected' : ''} ${!section.visible ? 'te-section-item--hidden' : ''}`}
            onClick={onSelect}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect()}
        >
            {/* Drag handle */}
            <span className={`te-section-item-drag ${isPinned ? 'te-section-item-drag--disabled' : ''}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>drag_indicator</span>
            </span>

            {/* Section name */}
            <span className="te-section-item-name">{sectionName}</span>

            {/* Selected indicator */}
            {isSelected && (
                <span className="te-section-item-indicator">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_left</span>
                </span>
            )}

            {/* Actions */}
            <div className="te-section-item-actions" onClick={(e) => e.stopPropagation()}>
                <button
                    className="te-section-item-btn"
                    onClick={onToggleVisibility}
                    title={section.visible ? 'Hide section' : 'Show section'}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {section.visible ? 'visibility' : 'visibility_off'}
                    </span>
                </button>

                {onDelete && !isPinned && (
                    <button
                        className="te-section-item-btn te-section-item-btn--danger"
                        onClick={onDelete}
                        title="Remove section"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                    </button>
                )}
            </div>
        </div>
    )
}
