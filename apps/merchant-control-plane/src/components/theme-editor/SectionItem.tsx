'use client'

import type { SectionEntry } from '@/hooks/useEditorHistory'
import { MaterialIcon } from '@letbuyy/ui'

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
                <MaterialIcon name="drag_indicator" style={{ fontSize: '16px' }} />
            </span>

            {/* Section name */}
            <span className="te-section-item-name">{sectionName}</span>

            {/* Selected indicator */}
            {isSelected && (
                <span className="te-section-item-indicator">
                    <MaterialIcon name="chevron_left" style={{ fontSize: '14px' }} />
                </span>
            )}

            {/* Actions */}
            <div className="te-section-item-actions" onClick={(e) => e.stopPropagation()}>
                <button
                    className="te-section-item-btn"
                    onClick={onToggleVisibility}
                    title={section.visible ? 'Hide section' : 'Show section'}
                >
                    <MaterialIcon name={section.visible ? 'visibility' : 'visibility_off'} style={{ fontSize: '16px' }} />
                </button>

                {onDelete && !isPinned && (
                    <button
                        className="te-section-item-btn te-section-item-btn--danger"
                        onClick={onDelete}
                        title="Remove section"
                    >
                        <MaterialIcon name="delete" style={{ fontSize: '16px' }} />
                    </button>
                )}
            </div>
        </div>
    )
}
