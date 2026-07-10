'use client'

/**
 * SectionTreePanel — Phase R editor shell.
 *
 * Extracted from the inline SectionTree/TreeGroup/TreeSection functions in
 * apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx.
 *
 * Additions vs the former inline version:
 *   • role="tree" on the template-section list container (ARIA tree widget).
 *   • role="treeitem" + aria-selected + tabIndex on each section row.
 *   • ArrowUp/ArrowDown keyboard navigation between template tree items.
 *   • draggable + onDragStart/onDragOver/onDrop/onDragEnd on template-section rows
 *     (pinned header/footer rows are NOT draggable).
 *
 * TreeGroup is also exported so ThemeSettingsTree and VersionTree (still in page.tsx)
 * can continue to use it after the inline declaration is removed.
 *
 * Prop contract is identical to the former SectionTree component.
 * Uses only existing theme-os-* CSS classes from globals.css.
 * All imports are from @letbuyy/ui — no raw px / hex / rounded-[] values.
 */

import { useRef, useState, type ReactNode } from 'react'
import { Button, Select } from '@letbuyy/ui'
import {
    ChevronRight,
    Eye,
    GripVertical,
    PanelLeft,
    Plus,
    Trash2,
} from 'lucide-react'
import type { SectionSchema } from '@/lib/theme-schemas'

// ── Local type mirrors (match page.tsx; avoids cross-file coupling) ────────────

type JsonRecord = Record<string, unknown>

type BlockEntry = {
    id: string
    type: string
    order: number
    visible: boolean
    settings: JsonRecord
}

type SectionEntry = {
    id: string
    type: string
    order: number
    visible: boolean
    settings: JsonRecord
    blocks: BlockEntry[]
}

type EditorState = {
    themeSettings: JsonRecord
    sections: {
        header: SectionEntry | null
        footer: SectionEntry | null
        template: SectionEntry[]
    }
}

type EditorSelection =
    | { kind: 'section'; sectionId: string }
    | { kind: 'block'; sectionId: string; blockId: string }
    | { kind: 'theme'; groupKey: string }

type AvailableSection = {
    type: string
    name: string
    description: string
    hasBlocks: boolean
    settingsCount: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function labelFromKey(key: string): string {
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

// ── TreeGroup ─────────────────────────────────────────────────────────────────

/**
 * TreeGroup — shared panel group header used across section, settings, and version panels.
 *
 * Exported so ThemeSettingsTree and VersionTree (living in page.tsx) can import it
 * after the inline `function TreeGroup` declaration is removed from that file.
 */
export function TreeGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className="theme-os-tree__group">
            <p className="theme-os-tree__label">{label}</p>
            {children}
        </section>
    )
}

// ── TreeSectionRow ────────────────────────────────────────────────────────────

type TreeSectionRowProps = {
    section: SectionEntry
    schema?: SectionSchema
    selected: boolean
    /**
     * Override for aria-selected. When a child block is selected, the parent section
     * row should report aria-selected=true for screen readers even though the visual
     * selection highlight is not shown (selected=false). Defaults to `selected`.
     */
    ariaSelected?: boolean
    blockSelection: string | null
    pinned?: boolean
    canMoveUp?: boolean
    canMoveDown?: boolean
    /** Whether this row is being dragged (adds visual feedback). */
    dragging?: boolean
    /** Whether a drag is hovering over this row (shows drop indicator). */
    dragOver?: boolean
    /** tabIndex for ARIA tree widget: 0 for the active item, -1 for others. */
    tabIndex?: number
    onSelect: () => void
    onSelectBlock: (blockId: string) => void
    onMoveUp?: () => void
    onMoveDown?: () => void
    onToggle: () => void
    onRemove?: () => void
    onDragStart?: React.DragEventHandler
    onDragOver?: React.DragEventHandler
    onDrop?: React.DragEventHandler
    onDragEnd?: React.DragEventHandler
}

function TreeSectionRow({
    section,
    schema,
    selected,
    ariaSelected,
    blockSelection,
    pinned = false,
    canMoveUp = false,
    canMoveDown = false,
    dragging = false,
    dragOver = false,
    tabIndex = -1,
    onSelect,
    onSelectBlock,
    onMoveUp,
    onMoveDown,
    onToggle,
    onRemove,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
}: TreeSectionRowProps) {
    const hasBlocks = section.blocks.length > 0
    const sectionName = schema?.name || labelFromKey(section.type)
    // Accessible label includes block count when blocks are present, since the
    // expand/collapse ChevronDown affordance is not active (no collapse implemented).
    const rowAriaLabel = hasBlocks
        ? `${sectionName}, ${section.blocks.length} block${section.blocks.length === 1 ? '' : 's'}`
        : undefined

    return (
        <div
            role="treeitem"
            aria-selected={ariaSelected ?? selected}
            tabIndex={tabIndex}
            className={[
                'theme-os-tree-section',
                selected ? 'theme-os-tree-section--selected' : '',
                !section.visible ? 'theme-os-tree-section--hidden' : '',
                dragging ? 'theme-os-tree-section--dragging' : '',
                dragOver ? 'theme-os-tree-section--drag-over' : '',
            ].filter(Boolean).join(' ')}
            style={{ opacity: dragging ? 0.45 : undefined }}
            draggable={!pinned}
            onDragStart={!pinned ? onDragStart : undefined}
            onDragOver={!pinned ? onDragOver : undefined}
            onDrop={!pinned ? onDrop : undefined}
            onDragEnd={!pinned ? onDragEnd : undefined}
        >
            <Button
                unstyled
                className="theme-os-tree-section__row"
                type="button"
                onClick={onSelect}
                aria-label={rowAriaLabel}
            >
                <span className="theme-os-tree-section__handle" aria-hidden="true">
                    {pinned ? <PanelLeft size={14} /> : <GripVertical size={14} />}
                </span>
                <span>{sectionName}</span>
            </Button>
            <div className="theme-os-tree-section__actions">
                {/* tabIndex={-1}: action buttons are not in the Tab sequence; the treeitem
                    outer div is the roving tabindex stop. Actions are accessible via focus
                    + Enter/Space on the treeitem, or mouse click. */}
                <Button unstyled type="button" tabIndex={-1} aria-label="Toggle visibility" onClick={onToggle}>
                    <Eye size={13} aria-hidden="true" />
                </Button>
                {!pinned ? (
                    <>
                        <Button unstyled type="button" tabIndex={-1} aria-label="Move up" onClick={onMoveUp} disabled={!canMoveUp}>
                            <ChevronRight className="theme-os-rotate-up" size={13} aria-hidden="true" />
                        </Button>
                        <Button unstyled type="button" tabIndex={-1} aria-label="Move down" onClick={onMoveDown} disabled={!canMoveDown}>
                            <ChevronRight className="theme-os-rotate-down" size={13} aria-hidden="true" />
                        </Button>
                        <Button unstyled type="button" tabIndex={-1} aria-label="Remove" onClick={onRemove}>
                            <Trash2 size={13} aria-hidden="true" />
                        </Button>
                    </>
                ) : null}
            </div>
            {hasBlocks ? (
                <div className="theme-os-tree-blocks">
                    {section.blocks.map((block) => (
                        <Button unstyled
                            key={block.id}
                            className={`theme-os-tree-block ${blockSelection === block.id ? 'theme-os-tree-block--selected' : ''} ${!block.visible ? 'theme-os-tree-block--hidden' : ''}`}
                            type="button"
                            onClick={() => onSelectBlock(block.id)}
                        >
                            <span className="theme-os-tree-block__line" aria-hidden="true" />
                            <span>{schema?.blocks_schema?.[block.type]?.name || labelFromKey(block.type)}</span>
                        </Button>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

// ── SectionTreePanel ──────────────────────────────────────────────────────────

export type SectionTreePanelProps = {
    state: EditorState
    sectionSchemas: Record<string, SectionSchema>
    selection: EditorSelection
    addableSections: AvailableSection[]
    addSectionType: string
    onSelect: (selection: EditorSelection) => void
    onAddSectionTypeChange: (type: string) => void
    onAddSection: () => void
    onMoveSection: (sectionId: string, direction: -1 | 1) => void
    onToggleSection: (sectionId: string) => void
    onRemoveSection: (section: SectionEntry) => void
}

/**
 * SectionTreePanel — left section tree with ARIA tree widget pattern and drag-to-reorder.
 *
 * ARIA: role="tree" on the template list container; role="treeitem" + aria-selected on each row.
 * Keyboard: ArrowUp/ArrowDown on any tree item moves focus between template section rows.
 * Drag: each template-section row is draggable; onDrop calls onMoveSection in the direction
 *        of the drop target. Pinned header/footer rows are never draggable.
 *
 * Props are identical to the former SectionTree inline function in page.tsx.
 */
export default function SectionTreePanel({
    state,
    sectionSchemas,
    selection,
    addableSections,
    addSectionType,
    onSelect,
    onAddSectionTypeChange,
    onAddSection,
    onMoveSection,
    onToggleSection,
    onRemoveSection,
}: SectionTreePanelProps) {
    const [dragIndex, setDragIndex] = useState<number | null>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
    const treeRef = useRef<HTMLDivElement>(null)

    // ── Keyboard navigation ────────────────────────────────────────────────────
    // Event-delegation: listen once on the role="tree" container so individual
    // treeitem divs do not each need their own key handler.
    const handleTreeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
        e.preventDefault()

        const items = treeRef.current
            ? Array.from(treeRef.current.querySelectorAll<HTMLElement>('[role="treeitem"]'))
            : []
        if (items.length === 0) return

        const focused = document.activeElement
        const currentIndex = items.findIndex((item) => item === focused || item.contains(focused))

        if (currentIndex === -1) {
            items[0]?.focus()
            return
        }

        const nextIndex = e.key === 'ArrowDown'
            ? Math.min(items.length - 1, currentIndex + 1)
            : Math.max(0, currentIndex - 1)

        items[nextIndex]?.focus()
    }

    // ── Drag-and-drop reorder ──────────────────────────────────────────────────
    const handleDragStart = (index: number): React.DragEventHandler => (e) => {
        e.dataTransfer.effectAllowed = 'move'
        setDragIndex(index)
    }

    const handleDragOver = (index: number): React.DragEventHandler => (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverIndex(index)
    }

    const handleDrop = (toIndex: number): React.DragEventHandler => (e) => {
        e.preventDefault()
        if (dragIndex !== null && dragIndex !== toIndex) {
            const section = state.sections.template[dragIndex]
            if (section) {
                // Compute the full distance to the drop target and apply it in one
                // gesture. moveSection finds the section by ID each iteration so it
                // correctly tracks the updated position after each step.
                const direction: -1 | 1 = toIndex > dragIndex ? 1 : -1
                const steps = Math.abs(toIndex - dragIndex)
                for (let i = 0; i < steps; i++) {
                    onMoveSection(section.id, direction)
                }
            }
        }
        setDragIndex(null)
        setDragOverIndex(null)
    }

    const handleDragEnd: React.DragEventHandler = () => {
        setDragIndex(null)
        setDragOverIndex(null)
    }

    return (
        <div className="theme-os-tree">
            {/* Header — pinned, not draggable */}
            <TreeGroup label="Header">
                {state.sections.header ? (
                    <TreeSectionRow
                        section={state.sections.header}
                        schema={sectionSchemas[state.sections.header.type]}
                        pinned
                        selected={selection.kind === 'section' && selection.sectionId === state.sections.header.id}
                        blockSelection={selection.kind === 'block' && selection.sectionId === state.sections.header.id ? selection.blockId : null}
                        onSelect={() => onSelect({ kind: 'section', sectionId: state.sections.header?.id || '' })}
                        onSelectBlock={(blockId) => onSelect({ kind: 'block', sectionId: state.sections.header?.id || '', blockId })}
                        onToggle={() => onToggleSection(state.sections.header?.id || '')}
                    />
                ) : null}
            </TreeGroup>

            {/* Template — ARIA tree widget; rows are draggable */}
            <TreeGroup label="Template">
                <div
                    role="tree"
                    aria-label="Template sections"
                    ref={treeRef}
                    onKeyDown={handleTreeKeyDown}
                >
                    {state.sections.template.map((section, index) => {
                        const isSelected = selection.kind === 'section' && selection.sectionId === section.id
                        // When a child block is selected, the parent section row is the
                        // "active parent": it should receive focus (tabIndex=0) and report
                        // aria-selected=true for screen readers, but NOT show the visual
                        // selection highlight (selected stays false).
                        const isActiveParent = selection.kind === 'block' && selection.sectionId === section.id
                        return (
                            <TreeSectionRow
                                key={section.id}
                                section={section}
                                schema={sectionSchemas[section.type]}
                                selected={isSelected}
                                ariaSelected={isSelected || isActiveParent}
                                blockSelection={
                                    selection.kind === 'block' && selection.sectionId === section.id
                                        ? selection.blockId
                                        : null
                                }
                                canMoveUp={index > 0}
                                canMoveDown={index < state.sections.template.length - 1}
                                dragging={dragIndex === index}
                                dragOver={dragOverIndex === index && dragIndex !== null && dragIndex !== index}
                                tabIndex={isSelected || isActiveParent ? 0 : -1}
                                onSelect={() => onSelect({ kind: 'section', sectionId: section.id })}
                                onSelectBlock={(blockId) => onSelect({ kind: 'block', sectionId: section.id, blockId })}
                                onMoveUp={() => onMoveSection(section.id, -1)}
                                onMoveDown={() => onMoveSection(section.id, 1)}
                                onToggle={() => onToggleSection(section.id)}
                                onRemove={() => onRemoveSection(section)}
                                onDragStart={handleDragStart(index)}
                                onDragOver={handleDragOver(index)}
                                onDrop={handleDrop(index)}
                                onDragEnd={handleDragEnd}
                            />
                        )
                    })}
                </div>

                <div className="theme-os-tree__add">
                    <Select
                        unstyled
                        value={addSectionType}
                        onChange={(event) => onAddSectionTypeChange(event.target.value)}
                        options={addableSections.map((section) => ({ label: section.name, value: section.type }))}
                    />
                    <Button unstyled type="button" onClick={onAddSection} disabled={!addSectionType}>
                        <Plus size={14} aria-hidden="true" />
                        Add
                    </Button>
                </div>
            </TreeGroup>

            {/* Footer — pinned, not draggable */}
            <TreeGroup label="Footer">
                {state.sections.footer ? (
                    <TreeSectionRow
                        section={state.sections.footer}
                        schema={sectionSchemas[state.sections.footer.type]}
                        pinned
                        selected={selection.kind === 'section' && selection.sectionId === state.sections.footer.id}
                        blockSelection={
                            selection.kind === 'block' && selection.sectionId === state.sections.footer.id
                                ? selection.blockId
                                : null
                        }
                        onSelect={() => onSelect({ kind: 'section', sectionId: state.sections.footer?.id || '' })}
                        onSelectBlock={(blockId) => onSelect({ kind: 'block', sectionId: state.sections.footer?.id || '', blockId })}
                        onToggle={() => onToggleSection(state.sections.footer?.id || '')}
                    />
                ) : null}
            </TreeGroup>
        </div>
    )
}
