'use client'

/**
 * BlockChildRow — Phase T nested block row for the theme editor SectionTreePanel.
 *
 * Renders a block instance in the section tree as a role=treeitem node, supporting:
 *   - Indented child rows for each depth level (1 up to MAX_EDITOR_BLOCK_DEPTH)
 *   - add-child / remove-child / reorder-child action affordances
 *   - ARIA tree levels (aria-level={depth}) for screen readers
 *   - Depth cap: nested children are NOT rendered past MAX_EDITOR_BLOCK_DEPTH (render-time
 *     bound complementing the parse-time bound in theme-document.ts)
 *
 * Design invariants enforced here:
 *   RISK-DUAL-N01 — callbacks mutate template.sections[].blocks[].children (instance tree)
 *     NOT block_definitions (the type catalog). Definitions stay source-of-truth for block
 *     types; this component only renders and mutates instances.
 *   MAX_EDITOR_BLOCK_DEPTH must stay in sync with MAX_BLOCK_NESTING_DEPTH in
 *     packages/theme-engine/src/theme-document.ts. Divergence causes documents that
 *     parse at depth=N to be silently truncated in the UI at a different depth.
 *
 * Styling: uses only existing theme-os-tree-block* CSS classes + depth-level modifier
 *   (theme-os-tree-block--depth-N). No raw px / hex / rounded-[] values.
 *   Imports from @letbuyy/ui only.
 */

import { Button } from '@letbuyy/ui'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { BlockEntry } from './SectionTreePanel'

// ── Depth constant ─────────────────────────────────────────────────────────────
/**
 * Maximum nesting depth for block children in the editor UI.
 *
 * Must stay in sync with MAX_BLOCK_NESTING_DEPTH in
 * packages/theme-engine/src/theme-document.ts (currently 3).
 * The parse-time bound rejects over-depth documents; this render-time bound
 * prevents the UI from rendering or offering to add blocks beyond the limit,
 * making the editor a safe DoS-free surface even with malformed data.
 */
export const MAX_EDITOR_BLOCK_DEPTH = 3

// ── Props ──────────────────────────────────────────────────────────────────────

export type BlockChildRowProps = {
    /**
     * Block instance from the template document.
     * Carries children[] when nested blocks are present (Phase T).
     */
    block: BlockEntry
    /**
     * Current nesting depth: 1 = direct child of a section's blocks list.
     * Must be ≤ MAX_EDITOR_BLOCK_DEPTH; this component short-circuits child
     * rendering when depth >= MAX_EDITOR_BLOCK_DEPTH.
     */
    depth: number
    /** Section id that owns this block tree. Threaded to callbacks unchanged. */
    sectionId: string
    /**
     * ID of the direct parent of this block. For depth=1 blocks the parent is the
     * section (pass section.id). For depth>1 blocks the parent is the enclosing
     * block. Used by remove/reorder callbacks to locate this block in its parent's
     * children list.
     */
    parentBlockId: string
    /** Currently selected block id — drives the --selected modifier class. */
    selectedBlockId: string | null
    /**
     * Pre-resolved display label for this block's type.
     * Callers compute this from SectionSchema.blocks_schema[block.type].name.
     * Falls back to block.type when undefined.
     */
    blockLabel?: string
    /**
     * Child block types that may be nested inside this block, sourced from
     * block_definitions[block.type].allowed_child_types. When undefined or empty
     * the add-child affordance is hidden — backward-compatible with all existing
     * block definitions that do not declare allowed children.
     */
    allowedChildTypes?: string[]
    /** Notify the editor that this block has been activated for settings editing. */
    onSelectBlock: (blockId: string) => void
    /**
     * Add a child block of childType to parentBlockId's instance children list.
     * Raw three-argument form (same as SectionTreePanelProps.onAddChildBlock) so
     * each recursive level can re-bind it to the correct (sectionId, parentBlockId).
     * RISK-DUAL-N01: mutates the instance tree, never block_definitions.
     */
    onAddChildBlock?: (sectionId: string, parentBlockId: string, childType: string) => void
    /**
     * Remove childId from parentBlockId's instance children list.
     * RISK-DUAL-N01: mutates the instance tree, never block_definitions.
     */
    onRemoveChildBlock?: (sectionId: string, parentBlockId: string, childId: string) => void
    /**
     * Reorder childId within parentBlockId's instance children list.
     * RISK-DUAL-N01: mutates the instance tree, never block_definitions.
     */
    onMoveChildBlock?: (
        sectionId: string,
        parentBlockId: string,
        childId: string,
        direction: -1 | 1,
    ) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * BlockChildRow renders one block instance in the section tree.
 *
 * Recursion: when the block has children AND depth < MAX_EDITOR_BLOCK_DEPTH,
 * the children are rendered as a nested <div role="group" class="theme-os-tree-blocks">
 * containing further <BlockChildRow> nodes at depth+1. The depth guard is applied
 * at the JSX level so malformed data never causes a stack overflow.
 *
 * ARIA: role="treeitem" + aria-level={depth} marks the depth for screen readers.
 * The parent role="tree" container (in SectionTreePanel) owns keyboard navigation.
 */
export function BlockChildRow({
    block,
    depth,
    sectionId,
    parentBlockId,
    selectedBlockId,
    blockLabel,
    allowedChildTypes,
    onSelectBlock,
    onAddChildBlock,
    onRemoveChildBlock,
    onMoveChildBlock,
}: BlockChildRowProps) {
    const isSelected = selectedBlockId === block.id
    const hasChildren = (block.children?.length ?? 0) > 0

    // Depth cap (render-time bound).
    // When depth >= MAX_EDITOR_BLOCK_DEPTH the nested children container is NOT
    // rendered and the add-child affordance is NOT shown — this is the UI
    // complement to the parse-time superRefine depth check in theme-document.ts.
    const canNestDeeper = depth < MAX_EDITOR_BLOCK_DEPTH

    // Add-child affordance: only show when under the depth cap AND the block's
    // type definition declares accepted child types.
    const canAddChildren =
        canNestDeeper &&
        Array.isArray(allowedChildTypes) &&
        allowedChildTypes.length > 0

    // Whether this block has nested children that are currently rendered.
    // Used to set aria-expanded on the treeitem.
    const isExpanded = canNestDeeper && hasChildren

    return (
        // role=treeitem: part of the parent role=tree ARIA widget.
        // aria-level: hierarchical depth (1 = direct section child; max = MAX_EDITOR_BLOCK_DEPTH).
        // aria-expanded: set when the node has visible nested children.
        // tabIndex=-1: focus is managed by the parent TreeSectionRow roving tabindex.
        <div
            role="treeitem"
            aria-selected={isSelected}
            aria-level={depth}
            aria-expanded={isExpanded || undefined}
            tabIndex={-1}
            className={[
                `theme-os-tree-block--depth-${depth}`,
            ].filter(Boolean).join(' ')}
        >
            {/* Primary select button — same structure as the existing flat block rows. */}
            <Button
                unstyled
                type="button"
                className={[
                    'theme-os-tree-block',
                    isSelected ? 'theme-os-tree-block--selected' : '',
                    !block.visible ? 'theme-os-tree-block--hidden' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onSelectBlock(block.id)}
            >
                <span className="theme-os-tree-block__line" aria-hidden="true" />
                <span>{blockLabel ?? block.type}</span>
            </Button>

            {/* Remove / reorder actions — only for nested blocks (depth > 1).
                Depth=1 blocks are section-level; their lifecycle is managed by
                the section's own remove callback (not onRemoveChildBlock). */}
            {depth > 1 ? (
                <div className="theme-os-tree-block__actions">
                    {onMoveChildBlock ? (
                        <>
                            <Button
                                unstyled
                                type="button"
                                tabIndex={-1}
                                aria-label="Move child block up"
                                onClick={() => onMoveChildBlock(sectionId, parentBlockId, block.id, -1)}
                            >
                                <ChevronRight
                                    className="theme-os-rotate-up"
                                    size={12}
                                    aria-hidden="true"
                                />
                            </Button>
                            <Button
                                unstyled
                                type="button"
                                tabIndex={-1}
                                aria-label="Move child block down"
                                onClick={() => onMoveChildBlock(sectionId, parentBlockId, block.id, 1)}
                            >
                                <ChevronRight
                                    className="theme-os-rotate-down"
                                    size={12}
                                    aria-hidden="true"
                                />
                            </Button>
                        </>
                    ) : null}
                    {onRemoveChildBlock ? (
                        <Button
                            unstyled
                            type="button"
                            tabIndex={-1}
                            aria-label="Remove child block"
                            onClick={() => onRemoveChildBlock(sectionId, parentBlockId, block.id)}
                        >
                            <Trash2 size={12} aria-hidden="true" />
                        </Button>
                    ) : null}
                </div>
            ) : null}

            {/* Add-child affordance — shown only when:
                  (a) the block's type definition declares allowed child types, AND
                  (b) depth < MAX_EDITOR_BLOCK_DEPTH (render-time depth cap)
                Uses the first allowed type as a default; a future picker UI can expand
                this to a <Select> of all allowedChildTypes. */}
            {canAddChildren && onAddChildBlock ? (
                <Button
                    unstyled
                    type="button"
                    tabIndex={-1}
                    aria-label="Add child block"
                    className="theme-os-tree-block__add-child"
                    onClick={() => {
                        // allowedChildTypes is non-empty (checked by canAddChildren)
                        onAddChildBlock(sectionId, block.id, allowedChildTypes![0]!)
                    }}
                >
                    <Plus size={12} aria-hidden="true" />
                </Button>
            ) : null}

            {/* Nested children container — rendered only when:
                  (a) the block has children in the instance tree, AND
                  (b) depth < MAX_EDITOR_BLOCK_DEPTH (render-time depth cap)
                role=group marks this as a subtree within the ARIA tree widget.
                The .theme-os-tree-blocks container provides the same visual
                connector lines and indentation as top-level section blocks. */}
            {canNestDeeper && hasChildren ? (
                <div className="theme-os-tree-blocks" role="group">
                    {block.children!.map((child) => (
                        <BlockChildRow
                            key={child.id}
                            block={child}
                            depth={depth + 1}
                            sectionId={sectionId}
                            parentBlockId={block.id}
                            selectedBlockId={selectedBlockId}
                            // blockLabel and allowedChildTypes for children would be
                            // resolved from the caller's sectionSchemas; for now they
                            // fall back to block.type. A future enhancement can pass
                            // them from the parent's schema lookup.
                            blockLabel={undefined}
                            allowedChildTypes={undefined}
                            onSelectBlock={onSelectBlock}
                            onAddChildBlock={onAddChildBlock}
                            onRemoveChildBlock={onRemoveChildBlock}
                            onMoveChildBlock={onMoveChildBlock}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    )
}
