import { isLiquidAppBlockType, MAX_BUNDLE_BLOCK_NESTING_DEPTH, normalizeEditorSchemaField, qualifiedFirstPartyInlineChildParents } from '@letbuyy/theme-engine'
import type { ExtendedBlockSchema, ExtendedSectionSchema, LiquidThemePackageBundle } from '@letbuyy/theme-engine'
import type { BlockEntry, SectionEntry } from './editor-view-state'

/** A view of installed definitions, never another document or draft store. */
export type EditorBlockCatalog = {
    schemas: Record<string, ExtendedBlockSchema>
    reusableSchemas: Record<string, ExtendedBlockSchema>
    rootTypes: string[]
    childTypes: Record<string, string[]>
    rootLimits: Record<string, number>
}

export function editorBlockCatalog(schema: ExtendedSectionSchema, bundle?: LiquidThemePackageBundle | null): EditorBlockCatalog {
    const schemas: Record<string, ExtendedBlockSchema> = {}
    for (const [type, file] of Object.entries(bundle?.blocks || {})) {
        if (isLiquidAppBlockType(type)) continue
        schemas[type] = { name: file.schema.name, fields: Object.fromEntries(file.schema.settings.map(field => [field.id, normalizeEditorSchemaField(field, field.id)])) }
    }
    const reusableSchemas = { ...schemas }
    for (const [type, definition] of Object.entries(schema.blocks_schema || {})) {
        if (!isLiquidAppBlockType(type)) schemas[type] = definition
    }
    const childTypes: Record<string, string[]> = {}
    const reusableTypes = Object.keys(bundle?.blocks || {}).filter(type => !isLiquidAppBlockType(type))
    for (const type of reusableTypes) {
        // Canonical undefined means unrestricted; [] means no children. The
        // installed reusable definitions retain their canonical child semantics.
        const allowed = bundle?.blocks[type]?.schema.allowed_child_types
        childTypes[type] = allowed === undefined ? [...reusableTypes] : reusableTypes.filter(child => allowed.includes(child))
    }
    if (bundle) {
        for (const type of qualifiedFirstPartyInlineChildParents(bundle, schema.type)) childTypes[type] = [...reusableTypes]
    }
    return {
        schemas,
        reusableSchemas,
        rootTypes: Object.keys(schema.blocks_schema || {}).filter(type => !isLiquidAppBlockType(type)),
        childTypes,
        rootLimits: Object.fromEntries((bundle?.sections[schema.type]?.schema.blocks || []).flatMap(block => 'limit' in block && block.limit !== undefined ? [[block.type, block.limit]] : [])),
    }
}

export function editorBlockSchema(catalog: EditorBlockCatalog | undefined, type: string, depth: number): ExtendedBlockSchema | undefined {
    return depth > 1 ? catalog?.reusableSchemas[type] : catalog?.schemas[type]
}

export function findEditorBlock(blocks: BlockEntry[], id: string, depth = 1): { block: BlockEntry; depth: number } | null {
    for (const block of blocks) {
        if (block.id === id) return { block, depth }
        const found = findEditorBlock(block.children || [], id, depth + 1)
        if (found) return found
    }
    return null
}

function updateChildren(blocks: BlockEntry[], parentId: string, update: (children: BlockEntry[]) => BlockEntry[]): BlockEntry[] {
    let changed = false
    const next = blocks.map(block => {
        const children = block.id === parentId ? update(block.children || []) : updateChildren(block.children || [], parentId, update)
        if (children === block.children || (!block.children && children.length === 0)) return block
        changed = true
        return { ...block, children }
    })
    return changed ? next : blocks
}

export function editorBlockSiblings(section: SectionEntry, parentId: string): BlockEntry[] | null {
    return parentId === section.id ? section.blocks : findEditorBlock(section.blocks, parentId)?.block.children || null
}

export function canAddEditorBlock(section: SectionEntry, catalog: EditorBlockCatalog, parentId: string, type: string): boolean {
    if (isLiquidAppBlockType(type) || !Object.hasOwn(catalog.schemas, type)) return false
    if (parentId === section.id) {
        const limit = catalog.rootLimits[type]
        // The existing editor DTO validator caps direct section blocks at50.
        return catalog.rootTypes.includes(type) && section.blocks.length < 50 && (limit === undefined || section.blocks.filter(block => block.type === type).length < limit)
    }
    const parent = findEditorBlock(section.blocks, parentId)
    return Boolean(parent && parent.depth < MAX_BUNDLE_BLOCK_NESTING_DEPTH && (parent.block.children?.length || 0) < 100 && catalog.childTypes[parent.block.type]?.includes(type))
}

export function addEditorBlock(section: SectionEntry, catalog: EditorBlockCatalog, parentId: string, block: BlockEntry): SectionEntry {
    if (!canAddEditorBlock(section, catalog, parentId, block.type) || block.id === section.id || findEditorBlock(section.blocks, block.id) || block.children?.length) return section
    const append = (siblings: BlockEntry[]) => [...siblings, { ...block, order: siblings.length * 10 + 10 }]
    const blocks = parentId === section.id ? append(section.blocks) : updateChildren(section.blocks, parentId, append)
    return { ...section, blocks }
}

export function moveEditorBlock(section: SectionEntry, parentId: string, id: string, direction: -1 | 1): SectionEntry {
    const move = (siblings: BlockEntry[]) => {
        const index = siblings.findIndex(block => block.id === id), nextIndex = index + direction
        if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return siblings
        const next = [...siblings], [block] = next.splice(index, 1)
        next.splice(nextIndex, 0, block)
        return next.map((entry, order) => ({ ...entry, order: (order + 1) * 10 }))
    }
    const blocks = parentId === section.id ? move(section.blocks) : updateChildren(section.blocks, parentId, move)
    return blocks === section.blocks ? section : { ...section, blocks }
}

export function toggleEditorBlock(section: SectionEntry, id: string): SectionEntry {
    const toggle = (blocks: BlockEntry[]): BlockEntry[] => {
        let changed = false
        const next = blocks.map(block => {
            if (block.id === id) { changed = true; return { ...block, visible: !block.visible } }
            const children = toggle(block.children || [])
            if (children === block.children || (!block.children && children.length === 0)) return block
            changed = true
            return { ...block, children }
        })
        return changed ? next : blocks
    }
    const blocks = toggle(section.blocks)
    return blocks === section.blocks ? section : { ...section, blocks }
}
