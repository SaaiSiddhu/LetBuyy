'use client'

import editorStyles from '@/components/theme-editor/editor-workspace.module.css'
import { MerchantEmptyArtwork } from '@/components/empty-states/MerchantEmptyState'
import { getStorefrontRootDomain } from '@/lib/public-urls'
import { isUnchangedCoreDemoCategoryBlocks, isFirstPartyCoreBundleSlug } from '@letbuyy/theme-engine'
import { useReadRequest } from '@/lib/api/use-read-request'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    ArrowLeft,
    Blocks,
    CheckCircle2,
    ChevronDown,
    CircleAlert,
    Eye,
    FileJson,
    Laptop,
    Layers3,
    Loader2,
    Monitor,
    Palette,
    PanelLeft,
    Plus,
    Redo2,
    RefreshCw,
    Rocket,
    Save,
    Settings,
    Smartphone,
    Sparkles,
    Tablet,
    Trash2,
    Undo2,
    WandSparkles,
    X,
} from 'lucide-react'
import { Button, Badge, ConfirmDialog, SaveBar, Select, Input, letbuyyPrimitiveTokens, useToast } from '@letbuyy/ui'
import {
    getDefaultStorefrontThemeTemplate,
    getSectionSchemas,
    getThemeSettingsSchema,
    hasRenderableThemeTemplate,
    resolveExperiencePresetItems,
    compilePortableToLiquidBundle,
    parseLiquidThemePackageBundle,
    toThemeDocumentV2,
    fromThemeDocumentV2,
    MAX_BUNDLE_BLOCK_NESTING_DEPTH,
    isLiquidAppBlockType,
    ThemeEditorTemplateKeySchema,
    EditorPreviewContextSchema,
    createEditorPreviewIdentityIndex,
    normalizeEditorSchemaField,
    resolveFieldDefault,
    parseTemplateKey,
    listEditorSectionCandidates,
    insertEditorSection,
    sectionInsertionRefusal,
    type EditorSectionInsertionTarget,
    type EditorPreviewContext,
    composeExperienceTemplateSections,
    type ExperienceApplyMode,
    type ExperienceTemplateKey,
    type ExperiencePresetItem,
} from '@letbuyy/theme-engine'
import SchemaFormRenderer from '@/components/theme-editor/SchemaFormRenderer'
import CenterPanel from '@/components/theme-editor/CenterPanel'
import { ResourcePickerControl } from '@/components/theme-editor/controls/ResourcePickerControl'
import { PREVIEW_VIEWPORT_WIDTHS } from '@/components/theme-editor/preview-viewport'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import ExperiencePicker from '@/components/theme-editor/ExperiencePicker'
import ConflictDialog from '@/components/theme-editor/ConflictDialog'
import { ThemeDraftClient, ThemeDraftConflictError, ThemeDraftValidationError } from '@/lib/theme-draft-client'
import SectionTreePanel, { TreeGroup } from '@/components/theme-editor/SectionTreePanel'
import { addEditorBlock, canAddEditorBlock, editorBlockCatalog, editorBlockSchema, editorBlockSiblings, findEditorBlock, moveEditorBlock, toggleEditorBlock } from '@/components/theme-editor/editor-block-actions'
import type { BlockEntry, SectionEntry, EditorState, EditorSelection } from '@/components/theme-editor/editor-view-state'
import type { ExtendedBlockSchema as BlockSchema, ExtendedSchemaField as SchemaField, ExtendedSectionSchema as SectionSchema, ExtendedThemeSettingsGroup as ThemeSettingsGroup, ExtendedThemeSettingsSchema as ThemeSettingsSchema } from '@letbuyy/theme-engine'

type JsonRecord = Record<string, unknown>
type PreviewDevice = 'desktop' | 'tablet' | 'mobile'
type PanelMode = 'sections' | 'settings' | 'experiences' | 'versions'

type EditorHistory = {
    past: EditorState[]
    future: EditorState[]
}

type ApiEditorResponse = {
    actorId?: string
    store?: {
        id?: string
        name?: string
        subdomain?: string
        status?: string
    }
    theme?: {
        name?: string
        slug?: string
        schema_source?: string
        schema_manifest_version?: string
        renderer_key?: string
    }
    templateKey?: string
    templates?: unknown
    templateConfig?: unknown
    draftConfig?: unknown
    draftSavedAt?: string | null
    release?: {
        version?: number
        published_at?: string
    } | null
    sectionSchemas?: Record<string, unknown>
    themeSettingsSchema?: unknown
    version?: number
}

type ReleaseEntry = {
    id?: string
    release_id?: string
    version?: number
    release_version?: number
    release_status?: string
    is_current?: boolean
    published_at?: string
}

type TemplateOption = {
    key: string
    label: string
    type: string
}

const DEFAULT_TEMPLATE_OPTIONS: TemplateOption[] = [
    { key: 'index', label: 'Home page', type: 'home' },
    { key: 'product', label: 'Product page', type: 'product' },
    { key: 'collection', label: 'Collection page', type: 'collection' },
    { key: 'page', label: 'Content page', type: 'page' },
    { key: 'cart', label: 'Cart page', type: 'cart' },
    { key: 'blog', label: 'Blog listing', type: 'blog' },
    { key: 'article', label: 'Blog post', type: 'article' },
]

const EMPTY_SETTINGS_SCHEMA: ThemeSettingsSchema = {
    schema_version: '2026-05-json-contract',
    settings: {},
}

const EMPTY_STATE: EditorState = {
    themeSettings: {},
    sections: {
        header: [],
        footer: [],
        template: [],
    },
}

const PREVIEW_DEVICES: Array<{ value: PreviewDevice; label: string; icon: typeof Monitor; width: number }> = [
    { value: 'desktop', label: 'Desktop', icon: Monitor, width: PREVIEW_VIEWPORT_WIDTHS.desktop },
    { value: 'tablet', label: 'Tablet', icon: Tablet, width: PREVIEW_VIEWPORT_WIDTHS.tablet },
    { value: 'mobile', label: 'Mobile', icon: Smartphone, width: PREVIEW_VIEWPORT_WIDTHS.mobile },
]

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as JsonRecord)
        : {}
}

function stringValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function numberValue(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

function optionalString(value: unknown): string | undefined {
    const text = stringValue(value)
    return text.length > 0 ? text : undefined
}

function isTextEditingTarget(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest('textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"], input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"])'))
}

function labelFromKey(key: string): string {
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeTemplateKey(value: unknown, fallback = 'index'): string {
    const parsed = ThemeEditorTemplateKeySchema.safeParse(value)
    return parsed.success ? parsed.data : fallback
}

function templateLabel(key: string, template?: JsonRecord): string {
    const name = stringValue(template?.name)
    if (name) return name
    return DEFAULT_TEMPLATE_OPTIONS.find((option) => option.key === key)?.label || labelFromKey(key)
}

function normalizeTemplateOptions(value: unknown, templateConfig: JsonRecord): TemplateOption[] {
    const fromApi = Array.isArray(value)
        ? value.flatMap((entry) => {
            const record = asRecord(entry)
            const key = normalizeTemplateKey(record.key, '')
            return key && !['header', 'footer'].includes(key) ? [{
                key,
                label: stringValue(record.label, templateLabel(key, record)),
                type: stringValue(record.type, key),
            }] : []
        })
        : []
    const options = new Map<string, TemplateOption>()

    for (const option of [...DEFAULT_TEMPLATE_OPTIONS, ...fromApi]) {
        options.set(option.key, option)
    }

    for (const [key, template] of Object.entries(asRecord(templateConfig.templates))) {
        const normalizedKey = normalizeTemplateKey(key, '')
        if (!normalizedKey || ['header', 'footer'].includes(normalizedKey)) continue
        options.set(normalizedKey, {
            key: normalizedKey,
            label: templateLabel(normalizedKey, asRecord(template)),
            type: stringValue(asRecord(template).type, normalizedKey),
        })
    }

    return Array.from(options.values())
}

function normalizeField(key: string, value: unknown): SchemaField {
    return normalizeEditorSchemaField(value, labelFromKey(key))
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
    if (field.type === 'color' && field.default === undefined) return letbuyyPrimitiveTokens.color.black
    return resolveFieldDefault(field)
}

function defaultSettingsForFields(fields: Record<string, SchemaField>): JsonRecord {
    return Object.entries(fields).reduce<JsonRecord>((acc, [key, field]) => {
        acc[key] = defaultValueForField(field)
        return acc
    }, {})
}

function defaultThemeSettings(schema: ThemeSettingsSchema): JsonRecord {
    return Object.values(schema.settings).reduce<JsonRecord>((acc, group) => {
        return { ...acc, ...defaultSettingsForFields(group.fields) }
    }, {})
}

function portableBlocksToArray(section: JsonRecord): unknown[] {
    const blocks = section.blocks
    if (Array.isArray(blocks)) return blocks

    const blockRecords = asRecord(blocks)
    const blockOrder = Array.isArray(section.block_order)
        ? section.block_order.filter((blockId): blockId is string => typeof blockId === 'string')
        : Object.keys(blockRecords)

    return blockOrder
        .filter((blockId) => Object.prototype.hasOwnProperty.call(blockRecords, blockId))
        .map((blockId, index) => ({
            id: blockId,
            order: index * 10,
            ...asRecord(blockRecords[blockId]),
        }))
}

function portableTemplateSectionsToArray(template: JsonRecord): unknown[] | null {
    if (Array.isArray(template.sections)) return template.sections
    if (!template.sections || typeof template.sections !== 'object') return null
    const sections = asRecord(template.sections)

    const order = Array.isArray(template.order)
        ? template.order.filter((sectionId): sectionId is string => typeof sectionId === 'string')
        : Object.keys(sections)

    return order
        .filter((sectionId) => Object.prototype.hasOwnProperty.call(sections, sectionId))
        .map((sectionId, index) => {
            const section = asRecord(sections[sectionId])
            return {
                id: sectionId,
                order: index * 10,
                ...section,
                blocks: portableBlocksToArray(section),
            }
        })
}

function getSectionRoot(templateConfig: JsonRecord, templateKey = 'index'): JsonRecord {
    const rootSections = templateConfig.sections
    const legacyRoot = Array.isArray(rootSections)
        ? { template: rootSections }
        : Object.keys(asRecord(rootSections)).length > 0
            ? asRecord(rootSections)
            : {}

    const templates = asRecord(templateConfig.templates)
    const selectedTemplate = asRecord(templates[templateKey] || templates.index || templates.home || Object.values(templates)[0])
    const selectedSections = portableTemplateSectionsToArray(selectedTemplate)
    if (selectedSections) {
        return {
            ...legacyRoot,
            template: selectedSections,
        }
    }

    if (Object.keys(legacyRoot).length > 0) return legacyRoot

    const configSections = asRecord(asRecord(templateConfig.config).sections)
    if (Object.keys(configSections).length > 0) return configSections

    const homeTemplate = asRecord(templates.home || templates.index || Object.values(templates)[0])
    const homeSections = homeTemplate.sections
    if (Array.isArray(homeSections)) return { template: homeSections }
    const homeTemplateSections = portableTemplateSectionsToArray(homeTemplate)
    if (homeTemplateSections) return { template: homeTemplateSections }
    return asRecord(homeSections)
}

function sectionDefaults(type: string, schemas: Record<string, SectionSchema>): JsonRecord {
    return asRecord(schemas[type]?.defaults)
}

function sampleBlocksForSchema(schema?: SectionSchema): BlockEntry[] {
    const samples = Array.isArray(schema?.sample_blocks) ? schema.sample_blocks : []
    return samples.map((block, index) => {
        const record = asRecord(block)
        return {
            id: stringValue(record.id, `${stringValue(record.type, 'block')}-${index + 1}`),
            type: stringValue(record.type, `block_${index + 1}`),
            order: index,
            visible: record.visible === false || record.isVisible === false ? false : true,
            settings: asRecord(record.settings),
        }
    })
}

/** Reusable definitions own nested defaults; section inline descriptors own roots. */
function reusableSchemasFromBundle(bundle: unknown): Record<string, BlockSchema> {
    return Object.fromEntries(Object.entries(asRecord(asRecord(bundle).blocks)).map(([type, value]) => {
        const schema = asRecord(asRecord(value).schema)
        const settings = Array.isArray(schema.settings) ? schema.settings : []
        const fields = Object.fromEntries(settings.flatMap(value => {
            const field = asRecord(value)
            return typeof field.id === 'string' ? [[field.id, normalizeEditorSchemaField(field, field.id)]] : []
        }))
        return [type, { name: stringValue(schema.name, type), fields }]
    }))
}

function normalizeBlock(value: unknown, index: number, blockSchemas?: Record<string, BlockSchema>, depth = 1, reusableSchemas?: Record<string, BlockSchema>): BlockEntry | null {
    const record = asRecord(value)
    const type = stringValue(record.type)
    if (!type) return null
    if (depth > MAX_BUNDLE_BLOCK_NESTING_DEPTH) throw new Error('This block tree exceeds the supported nesting limit. Your saved document has been kept.')

    const blockSchema = (depth > 1 && reusableSchemas ? reusableSchemas : blockSchemas)?.[type]
    const defaults = blockSchema?.fields ? defaultSettingsForFields(blockSchema.fields) : {}
    const children = Array.isArray(record.children) ? record.children : portableBlocksToArray(record)

    return {
        id: stringValue(record.id, `${type}-${index + 1}`),
        type,
        order: numberValue(record.order, index),
        visible: record.disabled !== true && record.visible !== false && record.isVisible !== false,
        settings: {
            ...defaults,
            ...asRecord(record.settings),
        },
        children: children.flatMap((child, childIndex) => {
            const normalized = normalizeBlock(child, childIndex, blockSchemas, depth + 1, reusableSchemas)
            return normalized ? [normalized] : []
        }),
    }
}

function normalizeSection(
    value: unknown,
    fallbackType: string,
    fallbackId: string,
    index: number,
    schemas: Record<string, SectionSchema>,
    reusableSchemas?: Record<string, BlockSchema>,
): SectionEntry | null {
    const record = asRecord(value)
    const type = stringValue(record.type, fallbackType)
    if (!type) return null

    const schema = schemas[type]
    const blocks = Array.isArray(record.blocks)
        ? record.blocks.flatMap((block, blockIndex) => {
            const normalized = normalizeBlock(block, blockIndex, schema?.blocks_schema, 1, reusableSchemas)
            return normalized ? [normalized] : []
        })
        : sampleBlocksForSchema(schema)

    return {
        id: stringValue(record.id, fallbackId),
        type,
        order: numberValue(record.order, index * 10),
        visible: record.disabled !== true && record.visible !== false && record.isVisible !== false,
        settings: {
            ...sectionDefaults(type, schemas),
            ...asRecord(record.settings),
        },
        blocks,
    }
}

function createSectionFromSchema(type: string, schemas: Record<string, SectionSchema>, order: number): SectionEntry {
    const schema = schemas[type]
    return {
        id: `section-${crypto.randomUUID()}`,
        type,
        order,
        visible: true,
        settings: {
            ...asRecord(schema?.defaults),
        },
        blocks: sampleBlocksForSchema(schema),
    }
}

function createBlockFromSchema(blockType: string, blockSchema: BlockSchema | undefined, order: number): BlockEntry {
    return {
        id: `block-${crypto.randomUUID()}`,
        type: blockType,
        order,
        visible: true,
        settings: blockSchema ? defaultSettingsForFields(blockSchema.fields) : {},
    }
}

function normalizeEditorState(
    templateConfig: unknown,
    themeId: string,
    templateKey: string,
    sectionSchemas: Record<string, SectionSchema>,
    settingsSchema: ThemeSettingsSchema,
): EditorState {
    const fallback = getDefaultStorefrontThemeTemplate(themeId)
    const fallbackConfig = fallback as unknown as JsonRecord
    const candidate = hasRenderableThemeTemplate(templateConfig) ? asRecord(templateConfig) : fallbackConfig
    const isLiquid = candidate.rendererEngine === 'liquid' || asRecord(asRecord(candidate.liquidBundle).renderer).engine === 'liquid'
    const reusableSchemas = isLiquid ? reusableSchemasFromBundle(candidate.liquidBundle) : undefined
    const root = getSectionRoot(candidate, templateKey)
    const fallbackRoot = getSectionRoot(fallbackConfig, templateKey)
    const templateEntries = Array.isArray(root.template) ? root.template : []
    const templates = asRecord(candidate.templates)
    // Portable themes own their header/footer and setting defaults. Importing
    // another renderer's fallback fields makes the first draft fail validation.
    const normalizeGroup = (key: 'header' | 'footer'): SectionEntry[] => {
        // Liquid templates contain the complete group. The legacy root is only
        // a first-section compatibility projection and cannot describe the group.
        const group = isLiquid && Object.hasOwn(templates, key)
            ? portableTemplateSectionsToArray(asRecord(templates[key])) || []
            : [root[key] || (!isLiquid ? fallbackRoot[key] : null)].filter(Boolean)
        return group.flatMap((section, index) => {
            const normalized = normalizeSection(section, key, `${key}-${index + 1}`, index, sectionSchemas, reusableSchemas)
            return normalized ? [normalized] : []
        })
    }
    const header = normalizeGroup('header')
    const footer = normalizeGroup('footer')
    const template = templateEntries.flatMap((section, index) => {
        const normalized = normalizeSection(section, `section_${index + 1}`, `section-${index + 1}`, index + 1, sectionSchemas, reusableSchemas)
        if (normalized && isFirstPartyCoreBundleSlug(asRecord(asRecord(candidate.liquidBundle).package).slug, asRecord(asRecord(candidate.liquidBundle).package).version)
            && ['categoryGrid', 'category-grid'].includes(normalized.type) && isUnchangedCoreDemoCategoryBlocks(normalized.blocks)) {
            return [{ ...normalized, blocks: [] }]
        }
        return normalized ? [normalized] : []
    })

    const configSettingsData = asRecord(asRecord(asRecord(candidate.config).settings_data).current)
    const rootSettingsData = asRecord(asRecord(candidate.settings_data).current)

    const legacyExperienceId = asRecord(candidate.themeSettings).experienceId
    return {
        experienceId: typeof candidate.experienceId === 'string' ? candidate.experienceId : typeof legacyExperienceId === 'string' ? legacyExperienceId : undefined,
        themeSettings: {
            ...defaultThemeSettings(settingsSchema),
            ...(isLiquid ? {} : asRecord(fallback.themeSettings)),
            ...configSettingsData,
            ...rootSettingsData,
            ...asRecord(candidate.themeSettings),
        },
        sections: {
            header,
            footer,
            template: template.sort((left, right) => left.order - right.order),
        },
    }
}

function blockToPortableRecord(block: BlockEntry): JsonRecord {
    const children = block.children || []
    return {
        type: block.type,
        visible: block.visible,
        settings: block.settings,
        blocks: Object.fromEntries(children.map(child => [child.id, blockToPortableRecord(child)])),
        block_order: children.map(child => child.id),
    }
}

function sectionToPortableRecord(section: SectionEntry): JsonRecord {
    const blockEntries = section.blocks.map((block) => [block.id, blockToPortableRecord(block)])
    return {
        type: section.type,
        visible: section.visible,
        settings: section.settings,
        blocks: Object.fromEntries(blockEntries),
        block_order: section.blocks.map((block) => block.id),
    }
}

function buildDraftConfig(baseConfig: JsonRecord, themeId: string, state: EditorState, templateKey = 'index'): JsonRecord {
    const config = asRecord(baseConfig.config)
    const rootSettingsData = asRecord(baseConfig.settings_data)
    const templates = asRecord(baseConfig.templates)
    const fallbackTemplate = asRecord(templates.index || templates.home || Object.values(templates)[0])
    const existingTemplate = asRecord(templates[templateKey] || fallbackTemplate)
    const nextTemplate = {
        ...existingTemplate,
        name: stringValue(existingTemplate.name, templateLabel(templateKey, existingTemplate)),
        sections: Object.fromEntries(state.sections.template.map((section) => [section.id, sectionToPortableRecord(section)])),
        order: state.sections.template.map((section) => section.id),
    }
    const groupTemplate = (key: 'header' | 'footer') => ({
        ...asRecord(templates[key]),
        sections: Object.fromEntries(state.sections[key].map(section => [section.id, sectionToPortableRecord(section)])),
        order: state.sections[key].map(section => section.id),
    })
    const nextSettingsData = {
        ...rootSettingsData,
        current: Object.fromEntries(Object.entries(state.themeSettings).filter(([key]) => key !== 'experienceId')),
        presets: presetsFromBaseConfig(baseConfig),
    }

    return {
        ...baseConfig,
        themeId: stringValue(baseConfig.themeId, themeId),
        experienceId: state.experienceId,
        themeSettings: Object.fromEntries(Object.entries(state.themeSettings).filter(([key]) => key !== 'experienceId')),
        // Preserve the established API projection; all group entries are owned
        // by templates, which the canonical compiler consumes in full.
        sections: { template: state.sections.template,
            ...(state.sections.header[0] ? { header: state.sections.header[0] } : {}),
            ...(state.sections.footer[0] ? { footer: state.sections.footer[0] } : {}),
        },
        templates: {
            ...templates,
            [templateKey]: nextTemplate,
            header: groupTemplate('header'),
            footer: groupTemplate('footer'),
        },
        settings_data: nextSettingsData,
        config: {
            ...config,
            settings_data: nextSettingsData,
        },
    }
}

// S4-FIX/Defect 2 — settings_data.presets (not the Experience registry) is the single source for
// which presets this theme has and what values applying one writes. Mirrors buildDraftConfig's own
// config-then-root precedence for `presets` so reading and writing agree on which layer wins.
function presetsFromBaseConfig(baseConfig: JsonRecord): Record<string, unknown> {
    const configSettingsData = asRecord(asRecord(baseConfig.config).settings_data)
    const rootSettingsData = asRecord(baseConfig.settings_data)
    const bundleSettingsData = asRecord(asRecord(asRecord(baseConfig.liquidBundle).config).settings_data)
    return {
        ...asRecord(bundleSettingsData.presets),
        ...asRecord(configSettingsData.presets),
        ...asRecord(rootSettingsData.presets),
    }
}

function getAllSections(state: EditorState): SectionEntry[] {
    return [
        ...state.sections.header,
        ...state.sections.template,
        ...state.sections.footer,
    ]
}

function getSectionById(state: EditorState, sectionId: string): SectionEntry | null {
    return getAllSections(state).find((section) => section.id === sectionId) || null
}

function getBlockById(section: SectionEntry | null, blockId: string): BlockEntry | null {
    const find = (blocks: BlockEntry[]): BlockEntry | null => {
        for (const block of blocks) {
            if (block.id === blockId) return block
            const child = find(block.children || [])
            if (child) return child
        }
        return null
    }
    return find(section?.blocks || [])
}

function updateBlockInTree(blocks: BlockEntry[], blockId: string, update: (block: BlockEntry) => BlockEntry): BlockEntry[] {
    return blocks.map(block => block.id === blockId ? update(block) : block.children?.length
        ? { ...block, children: updateBlockInTree(block.children, blockId, update) } : block)
}

function removeBlockFromTree(blocks: BlockEntry[], blockId: string): BlockEntry[] {
    return blocks.filter(block => block.id !== blockId).map(block => block.children?.length
        ? { ...block, children: removeBlockFromTree(block.children, blockId) } : block)
}

function updateSectionById(state: EditorState, sectionId: string, updater: (section: SectionEntry) => SectionEntry): EditorState {
    const update = (section: SectionEntry) => section.id === sectionId ? updater(section) : section

    return {
        ...state,
        sections: {
            header: state.sections.header.map(update),
            footer: state.sections.footer.map(update),
            template: state.sections.template.map(update),
        },
    }
}

function coerceFieldValue(field: SchemaField | undefined, value: unknown): unknown {
    if (!field) return value
    if (field.type === 'toggle' || field.type === 'checkbox') return Boolean(value)
    if (field.type === 'number' || field.type === 'range') return numberValue(value, field.min ?? 0)
    return value
}

function fieldByKey(schema: ThemeSettingsSchema, key: string): SchemaField | undefined {
    for (const group of Object.values(schema.settings)) {
        if (group.fields[key]) return group.fields[key]
    }
    return undefined
}

function firstSelection(state: EditorState, settingsSchema: ThemeSettingsSchema): EditorSelection {
    const firstSection = getAllSections(state)[0]
    if (firstSection) return { kind: 'section', sectionId: firstSection.id }
    return { kind: 'theme', groupKey: Object.keys(settingsSchema.settings)[0] || 'general' }
}

function releaseVersion(release: ReleaseEntry): number | null {
    const version = typeof release.release_version === 'number' ? release.release_version : release.version
    return typeof version === 'number' ? version : null
}

function currentReleaseVersionFromRows(releases: ReleaseEntry[]): number | null {
    const current = releases.filter(release => release.is_current === true && release.release_status === 'published')
    if (current.length !== 1) return null
    const version = releaseVersion(current[0])
    return Number.isInteger(version) && Number(version) > 0 ? Number(version) : null
}

function releaseId(release: ReleaseEntry): string {
    return stringValue(release.release_id, stringValue(release.id, 'release'))
}

function releaseDate(release: ReleaseEntry): string {
    if (!release.published_at) return 'Unpublished'
    return new Date(release.published_at).toLocaleString()
}



function ThemeEditorInner() {
    const params = useParams()
    const store = params?.store as string
    const themeId = params?.themeId as string
    const { actorId: editorActorId } = useMerchantSecurityContext(store)
    const { notify } = useToast()
    const router = useRouter()

    const [settingsSchema, setSettingsSchema] = useState<ThemeSettingsSchema>(() => normalizeSettingsSchema(getThemeSettingsSchema(themeId || 'urban-kicks')))
    const [sectionSchemas, setSectionSchemas] = useState<Record<string, SectionSchema>>(() => getSectionSchemas(themeId || 'urban-kicks'))
    const [editorState, setEditorState] = useState<EditorState>(EMPTY_STATE)
    const [savedState, setSavedState] = useState<EditorState>(EMPTY_STATE)
    const [baseConfig, setBaseConfig] = useState<JsonRecord>({})
    const [designReview, setDesignReview] = useState<{ state: EditorState; mode: ExperienceApplyMode; changes: string[]; atRisk: boolean } | null>(null)
    const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>(DEFAULT_TEMPLATE_OPTIONS)
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('index')
    const [history, setHistory] = useState<EditorHistory>({ past: [], future: [] })
    const [selection, setSelection] = useState<EditorSelection>({ kind: 'section', sectionId: 'header' })
    const [panelMode, setPanelMode] = useState<PanelMode>('sections')
    const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop')
    const [mobilePanel, setMobilePanel] = useState<'sections' | 'preview' | 'properties'>('preview')
    const [navigationOpen, setNavigationOpen] = useState(true)
    const [leaveRequested, setLeaveRequested] = useState(false)
    const [isLiveTheme, setIsLiveTheme] = useState(false)
    const [addSectionTarget, setAddSectionTarget] = useState<EditorSectionInsertionTarget | null>(null)
    const [sectionPendingRemoval, setSectionPendingRemoval] = useState<SectionEntry | null>(null)
    const [blockPendingRemoval, setBlockPendingRemoval] = useState<{ sectionId: string; block: BlockEntry } | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [themeName, setThemeName] = useState('LetBuyy Core')
    const [draftVersion, setDraftVersion] = useState<number | null>(null)
    const [savedAt, setSavedAt] = useState<string | null>(null)
    const [currentReleaseVersion, setCurrentReleaseVersion] = useState<number | null>(null)
    const [releases, setReleases] = useState<ReleaseEntry[]>([])
    const [previewToken, setPreviewToken] = useState<string | null>(null)
    const [previewContext, setPreviewContext] = useState<EditorPreviewContext | null>(null)
    const [previewResourceId, setPreviewResourceId] = useState('')
    const [previewBlogPage, setPreviewBlogPage] = useState(1)
    const [previewBlogPageInput, setPreviewBlogPageInput] = useState('1')
    const [previewError, setPreviewError] = useState<string | null>(null)
    const [isPreviewRefreshing, setIsPreviewRefreshing] = useState(false)
    // Phase R — conflict state: set when a draft PUT returns HTTP 409 (code 'CONFLICT').
    const [hasConflict, setHasConflict] = useState(false)
    const [conflictSource, setConflictSource] = useState<'autosave' | 'manual-save'>('autosave')
    const previewRequestCounter = useRef(0)
    const loadRequestCounter = useRef(0)
    const releaseRequestCounter = useRef(0)
    const draftClientRef = useRef<ThemeDraftClient | null>(null)
    const draftClientScopeRef = useRef('')
    const latestEditorState = useRef(editorState)
    latestEditorState.current = editorState
    const [replacementVersion, setReplacementVersion] = useState<number | null>(null)
    const [isReviewingConflict, setIsReviewingConflict] = useState(false)
    const conflictRecoveryBusy = useRef(false)

    useEffect(() => () => { draftClientRef.current?.dispose(); loadRequestCounter.current += 1 }, [])


    const canUndo = history.past.length > 0
    const canRedo = history.future.length > 0
    const themeGroups = useMemo(() => Object.entries(settingsSchema.settings), [settingsSchema])
    // S4-FIX/Defect 2 — resolved from the loaded theme's own settings_data.presets, enriched by
    // name lookup against the Experience registry. Recomputes only when the loaded config changes.
    const presetItems: ExperiencePresetItem[] = useMemo(
        () => resolveExperiencePresetItems(presetsFromBaseConfig(baseConfig)),
        [baseConfig],
    )
    const selectedSection = useMemo(() => {
        if (selection.kind === 'section') return getSectionById(editorState, selection.sectionId)
        if (selection.kind === 'block') return getSectionById(editorState, selection.sectionId)
        return null
    }, [editorState, selection])
    const selectedBlock = useMemo(() => {
        if (selection.kind !== 'block') return null
        return getBlockById(getSectionById(editorState, selection.sectionId), selection.blockId)
    }, [editorState, selection])
    const selectedThemeGroup = selection.kind === 'theme'
        ? settingsSchema.settings[selection.groupKey] || themeGroups[0]?.[1]
        : null
    const selectedThemeGroupKey = selection.kind === 'theme'
        ? selection.groupKey
        : themeGroups[0]?.[0] || 'general'
    const selectedSectionSchema = selectedSection ? sectionSchemas[selectedSection.type] : undefined
    const installedBlockBundle = useMemo(() => {
        try { return parseLiquidThemePackageBundle(baseConfig.liquidBundle) } catch { return null }
    }, [baseConfig.liquidBundle])
    const blockCatalogs = useMemo(() => Object.fromEntries(Object.entries(sectionSchemas).map(([type, schema]) => [type, editorBlockCatalog(schema, installedBlockBundle)])), [sectionSchemas, installedBlockBundle])
    const selectedBlockSchema = selectedSection && selectedBlock
        ? editorBlockSchema(blockCatalogs[selectedSection.type], selectedBlock.type, findEditorBlock(selectedSection.blocks, selectedBlock.id)?.depth || 1)
        : undefined
    const sectionCandidates = useMemo(() => addSectionTarget
        ? listEditorSectionCandidates(installedBlockBundle, editorState.sections, selectedTemplateKey, addSectionTarget)
            .map(candidate => sectionSchemas[candidate.type] ? candidate : {
                ...candidate, available: false, reason: 'The installed editor schema for this section is unavailable.',
            })
        : [], [addSectionTarget, installedBlockBundle, editorState.sections, selectedTemplateKey, sectionSchemas])
    const activeDevice = PREVIEW_DEVICES.find((device) => device.value === previewDevice) || PREVIEW_DEVICES[0]
    const selectedTemplate = templateOptions.find((option) => option.key === selectedTemplateKey) || templateOptions[0] || DEFAULT_TEMPLATE_OPTIONS[0]
    const templateBase = parseTemplateKey(selectedTemplateKey).baseType
    const previewBlogPageValid = /^[1-9]\d*$/.test(previewBlogPageInput) && Number(previewBlogPageInput) <= 1000
    const previewResourceType = templateBase === 'article' ? 'blog' : ['page', 'product', 'collection'].includes(templateBase) ? templateBase as 'page' | 'product' | 'collection' : null
    const selectedPreviewSectionId = selection.kind === 'theme' ? null : selection.sectionId
    const previewIdentities = useMemo(() => createEditorPreviewIdentityIndex(getAllSections(savedState)), [savedState])

    const applyChange = useCallback((updater: (current: EditorState) => EditorState) => {
        setEditorState((current) => {
            const next = updater(current)
            if (next === current) return current
            setHistory((existing) => ({
                past: [...existing.past.slice(-49), current],
                future: [],
            }))
            setIsDirty(true)
            return next
        })
    }, [])

    // Phase-2.5 Stream A/B — apply a merchant-facing preset to the draft. Merges the preset's
    // BUNDLE values into themeSettings (buildDraftConfig propagates it to BOTH themeSettings and
    // settings_data.current), records the active preset id, flips isDirty so the existing 900ms
    // debounce auto-saves the draft and refreshes the live preview. No page refresh, no new API.
    // S4-FIX/Defect 2 — presetId identifies an entry in presetItems (settings_data.presets), not a
    // raw Experience registry id; values come from that entry's `values`, sourced from the bundle.
    const applyExperience = useCallback((presetId: string) => {
        const preset = presetItems.find((item) => item.id === presetId)
        if (!preset) return
        applyChange((current) => ({
            ...current,
            experienceId: preset.id,
            themeSettings: { ...current.themeSettings, ...preset.values },
        }))
    }, [applyChange, presetItems])

    const reviewThreadlinePage = (mode: ExperienceApplyMode) => {
        try {
            const draft = buildDraftConfig(baseConfig, themeId, editorState, selectedTemplateKey)
            const bundle = compilePortableToLiquidBundle(draft, { baseBundle: parseLiquidThemePackageBundle(baseConfig.liquidBundle) }).bundle
            const document = toThemeDocumentV2(bundle)
            const template = document.templates.find(item => item.key === selectedTemplateKey)
            if (!template || !['index', 'product', 'collection'].includes(selectedTemplateKey)) return
            const result = composeExperienceTemplateSections({ experienceId: 'sense', templateKey: selectedTemplateKey as ExperienceTemplateKey, sections: template.sections, sectionDefinitions: document.section_definitions, blockDefinitions: document.block_definitions, options: { mode, preserveContent: true } })
            if (result.diff.some(item => item.action === 'incompatible')) throw new Error('This installed package does not contain the required page sections.')
            template.sections = result.sections
            const nextBundle = fromThemeDocumentV2(document)
            const next = normalizeEditorState({ ...draft, templates: nextBundle.templates, sections: {}, liquidBundle: nextBundle }, themeId, selectedTemplateKey, sectionSchemas, settingsSchema)
            setDesignReview({ state: next, mode, atRisk: result.requiresDuplicate, changes: result.diff.map(item => `${item.action}: ${sectionSchemas[item.type]?.name || item.type}${item.lostContent ? ' — contains saved content or bindings' : ''}`) })
        } catch (error) {
            notify({ title: 'Layout could not be prepared', description: error instanceof Error ? error.message : 'Review this installed package.', variant: 'critical' })
        }
    }

    const loadReleases = useCallback(async () => {
        if (!store || !themeId) return
        const scope = draftClientScopeRef.current, generation = loadRequestCounter.current, request = ++releaseRequestCounter.current

        try {
            const res = await fetch(`/api/themes/${themeId}/releases?store_name=${encodeURIComponent(store)}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
            const payload = await res.json().catch(() => ({}))
            if (scope !== draftClientScopeRef.current || generation !== loadRequestCounter.current || request !== releaseRequestCounter.current) return
            if (!res.ok) { setReleases([]); setCurrentReleaseVersion(null); return }
            const rawData = asRecord(payload).data
            const releaseValue: unknown = Array.isArray(rawData)
                ? rawData
                : Array.isArray(asRecord(rawData).releases)
                    ? asRecord(rawData).releases
                    : []
            const releaseList = Array.isArray(releaseValue) ? releaseValue : []
            const rows = releaseList.map((release: unknown) => asRecord(release) as ReleaseEntry)
            setReleases(rows)
            setCurrentReleaseVersion(currentReleaseVersionFromRows(rows))
        } catch {
            if (scope !== draftClientScopeRef.current || generation !== loadRequestCounter.current || request !== releaseRequestCounter.current) return
            setReleases([])
            setCurrentReleaseVersion(null)
        }
    }, [store, themeId])

    const beginEditorRead = useReadRequest(JSON.stringify([editorActorId, store, themeId, selectedTemplateKey]))
    const loadEditor = useCallback(async () => {
        if (!store || !themeId) return
        const read = beginEditorRead()
        const loadId = ++loadRequestCounter.current
        previewRequestCounter.current += 1
        setPreviewToken(null)
        setPreviewContext(null)
        setIsLoading(true)
        setLoadError(null)

        try {
            const fallbackSectionSchemas = getSectionSchemas(themeId)
            // The owned editor snapshot already includes the same runtime schemas.
            const editorRes = await fetch(`/api/themes/${themeId}/editor?store_name=${encodeURIComponent(store)}&template=${encodeURIComponent(selectedTemplateKey)}`, { cache: 'no-store', signal: read.signal })
            const editorPayload = await editorRes.json().catch(() => ({})) as ApiEditorResponse
            if (!read.isCurrent() || loadRequestCounter.current !== loadId) return

            if (!editorRes.ok) {
                const errorRecord = asRecord((editorPayload as { error?: unknown }).error)
                throw new Error(stringValue(errorRecord.message, stringValue((editorPayload as { error?: unknown }).error, 'Failed to load theme editor')))
            }

            const apiSectionSchemas = {
                ...fallbackSectionSchemas,
                ...asRecord(editorPayload.sectionSchemas),
            } as Record<string, SectionSchema>
            const nextSettingsSchema = normalizeSettingsSchema(editorPayload.themeSettingsSchema || getThemeSettingsSchema(themeId))
            const loadedBaseConfig = asRecord(editorPayload.draftConfig || editorPayload.templateConfig)
            // Captured runtime schemas from older catalog versions advertised
            // every reusable block. The installed Liquid section's declaration
            // is the actual add-block contract; keep the picker within it.
            for (const [type, file] of Object.entries(asRecord(asRecord(loadedBaseConfig.liquidBundle).sections))) {
                const declared = asRecord(file).schema
                const blocks = asRecord(declared).blocks
                if (apiSectionSchemas[type] && Array.isArray(blocks)) {
                    const allowed = new Set(blocks.map(block => asRecord(block).type))
                    apiSectionSchemas[type] = { ...apiSectionSchemas[type], blocks_schema: Object.fromEntries(Object.entries(apiSectionSchemas[type].blocks_schema || {}).filter(([key]) => allowed.has(key))) }
                }
            }
            const nextTemplateOptions = normalizeTemplateOptions(editorPayload.templates, loadedBaseConfig)
            const nextTemplateKey = normalizeTemplateKey(editorPayload.templateKey || selectedTemplateKey)
            const nextState = normalizeEditorState(
                editorPayload.draftConfig || editorPayload.templateConfig,
                themeId,
                nextTemplateKey,
                apiSectionSchemas,
                nextSettingsSchema,
            )
            const loadedVersion = editorPayload.version
            if (!Number.isInteger(loadedVersion) || Number(loadedVersion) < 0) throw new Error('The current draft revision is missing. Retry loading the editor.')
            const loadedActorId = editorPayload.actorId
            if (typeof loadedActorId !== 'string' || !loadedActorId) throw new Error('The editor account could not be confirmed. Retry loading it.')
            if (loadedActorId !== editorActorId) {
                if (draftClientRef.current) {
                    notify({ title: 'Account changed', description: 'Reload this editor before continuing. Your draft has been kept with the original account.', variant: 'critical' })
                    return
                }
                throw new Error('Your account changed. Reload this editor before continuing.')
            }
            const loadedStoreId = editorPayload.store?.id
            if (typeof loadedStoreId !== 'string' || !loadedStoreId) throw new Error('The editor store could not be confirmed. Retry loading it.')
            const editorScope = `${loadedActorId}:${loadedStoreId}:${themeId}:${nextTemplateKey}`
            const loadedConfig = buildDraftConfig(loadedBaseConfig, themeId, nextState, nextTemplateKey)
            if (draftClientRef.current && (draftClientRef.current.actorId !== loadedActorId || draftClientRef.current.storeId !== loadedStoreId)) {
                notify({ title: 'Editor context changed', description: 'Reload this editor before continuing. Your current draft has been kept.', variant: 'critical' })
                return
            }
            draftClientRef.current?.dispose()
            draftClientRef.current = null
            const client = new ThemeDraftClient(Number(loadedVersion), async (intent) => {
                const res = await fetch(`/api/themes/${themeId}/editor/draft?store_name=${encodeURIComponent(store)}&template=${encodeURIComponent(nextTemplateKey)}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
                    body: JSON.stringify({ ...intent, templateKey: nextTemplateKey, actorId: loadedActorId, storeId: loadedStoreId }),
                })
                const result = await res.json().catch(() => ({}))
                if (res.status === 409) throw new ThemeDraftConflictError()
                if (res.status === 400) throw new ThemeDraftValidationError(stringValue(asRecord(asRecord(result).error).message, 'Correct the draft values before saving again.'))
                if (!res.ok) throw new Error(stringValue(asRecord(asRecord(result).error).message, 'Draft save was not confirmed. Retry this request.'))
                return { version: result.version, currentVersion: result.currentVersion, savedAt: result.savedAt }
            }, loadedConfig, Boolean(editorPayload.draftConfig), () => crypto.randomUUID(), loadedActorId, loadedStoreId, { scope: editorScope, storage: window.localStorage })
            draftClientRef.current = client
            draftClientScopeRef.current = `${editorScope}:${store}`
            setReplacementVersion(null)
            setHasConflict(false)
            setSectionSchemas(apiSectionSchemas)
            setTemplateOptions(nextTemplateOptions)
            setSelectedTemplateKey(nextTemplateKey)
            setAddSectionTarget(null)
            setSettingsSchema(nextSettingsSchema)
            setEditorState(nextState)
            setSavedState(nextState)
            setBaseConfig(loadedBaseConfig)
            setSelection(firstSelection(nextState, nextSettingsSchema))
            setHistory({ past: [], future: [] })
            setIsDirty(false)
            setThemeName(stringValue(editorPayload.theme?.name, labelFromKey(themeId)))
            setDraftVersion(typeof editorPayload.version === 'number' ? editorPayload.version : null)
            setSavedAt(editorPayload.draftSavedAt || null)
            setIsLiveTheme(Boolean(editorPayload.release))
            setCurrentReleaseVersion(typeof editorPayload.release?.version === 'number' ? editorPayload.release.version : null)
            void loadReleases()
        } catch (err) {
            if (!read.isCurrent() || loadRequestCounter.current !== loadId) return
            const message = err instanceof Error ? err.message : 'Failed to load theme editor'
            setLoadError(message)
            notify({
                title: 'Theme editor could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (read.isCurrent() && loadRequestCounter.current === loadId) setIsLoading(false)
        }
    }, [beginEditorRead, editorActorId, loadReleases, notify, selectedTemplateKey, store, themeId])

    useEffect(() => {
        void loadEditor()
    }, [loadEditor])

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            const modifier = event.metaKey || event.ctrlKey
            if (!modifier || event.altKey || event.isComposing || event.defaultPrevented) return

            if (event.key.toLowerCase() === 's') {
                event.preventDefault()
                void handleSave()
                return
            }
            if (isTextEditingTarget(event.target)) return
            if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
                event.preventDefault()
                undo()
            }
            if ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y') {
                event.preventDefault()
                redo()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    })

    const undo = useCallback(() => {
        setHistory((current) => {
            if (current.past.length === 0) return current
            const previous = current.past[current.past.length - 1]
            setEditorState(previous)
            // Phase R hardening: only set dirty when the restored state differs from
            // savedState. After a save (which clears history) the merchant may edit
            // once then Ctrl+Z back to the saved snapshot — isDirty must become false
            // so the SaveBar and Publish button reflect the correct clean state.
            // Reference equality is reliable: setSavedState stores the exact object
            // reference from editorState at save time, and applyChange always creates
            // new objects.
            setIsDirty(previous !== savedState)
            return {
                past: current.past.slice(0, -1),
                future: [editorState, ...current.future],
            }
        })
    }, [editorState, savedState])

    const redo = useCallback(() => {
        setHistory((current) => {
            if (current.future.length === 0) return current
            const next = current.future[0]
            setEditorState(next)
            setIsDirty(true)
            return {
                past: [...current.past, editorState],
                future: current.future.slice(1),
            }
        })
    }, [editorState])

    const saveDraft = useCallback(async (reviewedVersion?: number, ensurePreviewDraft = false) => {
        const client = draftClientRef.current
        if (!client || draftClientScopeRef.current !== `${client.actorId}:${client.storeId}:${themeId}:${selectedTemplateKey}:${store}`) throw new Error('Reload the current owned editor before saving.')
        const snapshot = editorState
        const draftConfig = buildDraftConfig(baseConfig, themeId, snapshot, selectedTemplateKey)
        try {
            const ack = await client.save(draftConfig, reviewedVersion, ensurePreviewDraft)
            if (draftClientRef.current !== client) return ack
            setBaseConfig((current) => JSON.stringify(current) === JSON.stringify(draftConfig) ? current : draftConfig)
            setSavedState(snapshot)
            setDraftVersion(ack.version)
            if (ack.savedAt) setSavedAt(ack.savedAt)
            // Autosave confirms persistence; it must not erase the merchant's
            // ability to undo and redo changes made in this editor session.
            setIsDirty(latestEditorState.current !== snapshot)
            return ack
        } catch (error) {
            if (error instanceof ThemeDraftConflictError && draftClientRef.current === client) {
                setReplacementVersion(null)
                setHasConflict(true)
                setConflictSource('manual-save')
            }
            throw error
        }
    }, [baseConfig, editorState, selectedTemplateKey, store, themeId])

    const syncPreviewDraft = useCallback(async () => {
        const client = draftClientRef.current
        if (!store || !themeId || !client || latestEditorState.current !== editorState) return
        if (client.paused) { setHasConflict(true); return }
        const requestId = ++previewRequestCounter.current
        setIsPreviewRefreshing(true)
        setPreviewError(null)
        try {
            // Publication consumes its draft. Request a canonical preview draft
            // explicitly so even unchanged published settings remain inspectable
            // while storefront access is restricted.
            await saveDraft(undefined, true)
            if (previewRequestCounter.current !== requestId || draftClientRef.current !== client) return
            if (!client.hasDraft) { setPreviewToken(null); setPreviewContext(null); return }
            const sessionRes = await fetch(`/api/themes/${themeId}/preview-session`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
                body: JSON.stringify({ store_name: store, actorId: client.actorId, storeId: client.storeId, ttl_seconds: 900, templateKey: selectedTemplateKey }),
            })
            const sessionPayload = await sessionRes.json().catch(() => ({}))
            if (!sessionRes.ok) throw new Error(stringValue(asRecord(asRecord(sessionPayload).error).message, 'Unable to refresh the storefront preview.'))
            const session = asRecord(asRecord(sessionPayload).data)
            const nextPreviewToken = stringValue(session.preview_token)
            if (!nextPreviewToken) throw new Error('Preview session did not return a token.')
            const context = EditorPreviewContextSchema.safeParse({ sessionId: session.preview_session_id, revision: session.draft_version, templateKey: session.template_key, ...(previewResourceId ? { resourceId: previewResourceId } : {}), ...(parseTemplateKey(selectedTemplateKey).baseType === 'blog' ? { page: previewBlogPage } : {}) })
            if (!context.success || context.data.templateKey !== selectedTemplateKey) throw new Error('Preview session did not match the selected template.')
            if (previewRequestCounter.current !== requestId || draftClientRef.current !== client || latestEditorState.current !== editorState) return
            setPreviewContext(context.data)
            setPreviewToken(nextPreviewToken)
        } catch (error) {
            if (previewRequestCounter.current !== requestId || draftClientRef.current !== client) return
            if (error instanceof ThemeDraftConflictError) setConflictSource('autosave')
            setPreviewError(error instanceof Error ? error.message : 'Unable to refresh the storefront preview.')
        } finally {
            if (previewRequestCounter.current === requestId) setIsPreviewRefreshing(false)
        }
    }, [editorState, saveDraft, selectedTemplateKey, previewResourceId, previewBlogPage, store, themeId])

    useEffect(() => {
        if (isLoading || loadError || !store || !themeId || hasConflict || draftClientRef.current?.paused || isPublishing) return
        const timeout = window.setTimeout(() => { void syncPreviewDraft() }, isDirty ? 900 : 0)
        return () => window.clearTimeout(timeout)
    }, [hasConflict, isDirty, isLoading, isPublishing, loadError, store, syncPreviewDraft, themeId])

    useEffect(() => {
        if (!isDirty && !isSaving) return
        const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
        window.addEventListener('beforeunload', guard)
        return () => window.removeEventListener('beforeunload', guard)
    }, [isDirty, isSaving])

    const handleSave = useCallback(async () => {
        if (!store || !themeId || isSaving) return
        setIsSaving(true)
        try {
            await saveDraft()
            notify({
                title: 'Draft saved',
                description: `${selectedTemplate.label} draft and local preview are in sync.`,
                variant: 'success',
            })
        } catch (err) {
            // Phase R: ConflictError is already surfaced via ConflictDialog; suppress the toast.
            if (err instanceof Error && err.name === 'ConflictError') return
            notify({
                title: 'Draft save failed',
                description: err instanceof Error ? err.message : 'Unable to save the draft.',
                variant: 'critical',
            })
        } finally {
            setIsSaving(false)
        }
    }, [isSaving, notify, saveDraft, selectedTemplate.label, store, themeId])

    const handlePublish = useCallback(async () => {
        const client = draftClientRef.current
        if (!store || !themeId || !client || isPublishing) return
        if (isDirty && !client.hasPendingPublication) {
            notify({ title: 'Save draft before publishing', description: 'Publishing uses the last saved draft.', variant: 'warning' })
            return
        }
        const snapshot = savedState
        setIsPublishing(true)
        try {
            const ack = await client.publish(async (intent) => {
                const res = await fetch(`/api/themes/${themeId}/editor?store_name=${encodeURIComponent(store)}&template=${encodeURIComponent(selectedTemplateKey)}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
                    body: JSON.stringify({ templateKey: selectedTemplateKey, ...intent, actorId: client.actorId, storeId: client.storeId }),
                })
                const payload = await res.json().catch(() => ({}))
                if (res.status === 409) throw new ThemeDraftConflictError()
                if (res.status === 400) throw new ThemeDraftValidationError(stringValue(asRecord(asRecord(payload).error).message, 'Correct and save the draft before publishing again.'))
                if (!res.ok) throw new Error(stringValue(asRecord(asRecord(payload).error).message, 'Publication was not confirmed. Retry this request.'))
                return { version: payload.version, currentVersion: payload.currentVersion, savedAt: payload.savedAt, release: asRecord(payload.release), replayed: payload.replayed }
            })
            if (draftClientRef.current !== client) return
            const release = asRecord(ack.release)
            setDraftVersion(ack.currentVersion)
            if (ack.currentVersion > ack.version) { setReplacementVersion(null); setHasConflict(true); setConflictSource('manual-save') }
            if (ack.currentVersion === ack.version && ack.replayed !== true) setCurrentReleaseVersion(typeof release.release_version === 'number' ? release.release_version : currentReleaseVersion)
            if (ack.savedAt && ack.currentVersion === ack.version) setSavedAt(ack.savedAt)
            setPreviewToken(null)
            setPreviewContext(null)
            setIsDirty(latestEditorState.current !== snapshot)
            if (latestEditorState.current === snapshot) setHistory({ past: [], future: [] })
            void loadReleases()
            setIsLiveTheme(true)
            router.refresh()
            notify({ title: ack.replayed === true || ack.currentVersion > ack.version ? 'Theme publication recovered' : 'Theme published', description: ack.currentVersion > ack.version ? 'The saved version was published. A newer draft revision exists; review it before editing further.' : ack.replayed === true ? 'The earlier publication is confirmed. Review the latest live version and saved draft.' : latestEditorState.current === snapshot ? `${selectedTemplate.label} is now included in the live storefront version.` : 'The previously saved version is live. Your newer edits remain a draft.', variant: 'success' })
        } catch (error) {
            if (draftClientRef.current !== client) return
            if (error instanceof ThemeDraftConflictError) { setReplacementVersion(null); setHasConflict(true); setConflictSource('manual-save') }
            notify({ title: 'Theme publish not confirmed', description: error instanceof Error ? error.message : 'Retry publication to recover its result.', variant: 'critical' })
        } finally { if (draftClientRef.current === client) setIsPublishing(false) }
    }, [currentReleaseVersion, savedState, isDirty, isPublishing, loadReleases, notify, router, selectedTemplate.label, selectedTemplateKey, store, themeId])

    const recoverConflict = useCallback(async () => {
        if (conflictRecoveryBusy.current) return
        const client = draftClientRef.current
        if (!client) return
        conflictRecoveryBusy.current = true
        setIsReviewingConflict(true)
        try {
            if (replacementVersion === null) {
                const res = await fetch(`/api/themes/${themeId}/editor?store_name=${encodeURIComponent(store)}&template=${encodeURIComponent(selectedTemplateKey)}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
                const payload = await res.json().catch(() => ({}))
                if (!res.ok || !Number.isInteger(payload.version) || payload.version < 0) throw new Error('The latest draft version could not be loaded. Your local edits are retained.')
                if (draftClientRef.current === client) setReplacementVersion(payload.version)
            } else {
                await saveDraft(replacementVersion)
                if (draftClientRef.current === client) { setHasConflict(false); setReplacementVersion(null) }
            }
        } catch (error) {
            if (draftClientRef.current !== client) return
            if (!(error instanceof ThemeDraftConflictError)) notify({ title: 'Draft recovery not confirmed', description: error instanceof Error ? error.message : 'Retry this request.', variant: 'critical' })
        } finally { conflictRecoveryBusy.current = false; if (draftClientRef.current === client) setIsReviewingConflict(false) }
    }, [notify, replacementVersion, saveDraft, selectedTemplateKey, store, themeId])

    const handleTemplateChange = useCallback((nextTemplateKey: string) => {
        const normalized = normalizeTemplateKey(nextTemplateKey)
        if (normalized === selectedTemplateKey) return
        if (isDirty) {
            notify({
                title: 'Save draft before switching',
                description: 'Template drafts are saved separately, so save or discard the current draft before changing templates.',
                variant: 'warning',
            })
            return
        }
        previewRequestCounter.current += 1
        setPreviewResourceId('')
        setPreviewBlogPage(1)
        setPreviewBlogPageInput('1')
        setPreviewContext(null)
        setPreviewToken(null)
        setSelectedTemplateKey(normalized)
    }, [isDirty, notify, selectedTemplateKey])

    const changePreviewResource = useCallback((resourceId: string) => {
        if (resourceId === previewResourceId) return
        previewRequestCounter.current += 1
        setPreviewContext(null)
        setPreviewToken(null)
        setPreviewResourceId(resourceId)
    }, [previewResourceId])

    const changePreviewBlogPage = useCallback((page: number) => {
        if (!Number.isInteger(page) || page < 1 || page > 1000 || page === previewBlogPage) return
        previewRequestCounter.current += 1
        setPreviewContext(null)
        setPreviewToken(null)
        setPreviewBlogPage(page)
    }, [previewBlogPage])

    const discardChanges = useCallback(() => {
        setEditorState(savedState)
        setSelection(firstSelection(savedState, settingsSchema))
        setHistory({ past: [], future: [] })
        setIsDirty(false)
        notify({
            title: 'Changes discarded',
            description: 'The editor returned to the last saved draft.',
            variant: 'info',
        })
    }, [notify, savedState, settingsSchema])

    const updateThemeSetting = useCallback((key: string, value: unknown) => {
        applyChange((current) => ({
            ...current,
            themeSettings: {
                ...current.themeSettings,
                [key]: coerceFieldValue(fieldByKey(settingsSchema, key), value),
            },
        }))
    }, [applyChange, settingsSchema])

    const updateSectionSetting = useCallback((sectionId: string, key: string, value: unknown) => {
        const field = sectionSchemas[getSectionById(editorState, sectionId)?.type || '']?.settings_schema?.[key]
        applyChange((current) => updateSectionById(current, sectionId, (section) => ({
            ...section,
            settings: {
                ...section.settings,
                [key]: coerceFieldValue(field, value),
            },
        })))
    }, [applyChange, editorState, sectionSchemas])

    const updateBlockSetting = useCallback((sectionId: string, blockId: string, key: string, value: unknown) => {
        const section = getSectionById(editorState, sectionId)
        const location = section ? findEditorBlock(section.blocks, blockId) : null
        const field = section && location ? editorBlockSchema(blockCatalogs[section.type], location.block.type, location.depth)?.fields[key] : undefined
        if (!field) return
        applyChange((current) => updateSectionById(current, sectionId, (targetSection) => ({
            ...targetSection,
            blocks: updateBlockInTree(targetSection.blocks, blockId, (targetBlock) => ({
                ...targetBlock,
                settings: {
                    ...targetBlock.settings,
                    [key]: coerceFieldValue(field, value),
                },
            })),
        })))
    }, [applyChange, editorState, blockCatalogs])

    const toggleSectionVisibility = useCallback((sectionId: string) => {
        applyChange((current) => updateSectionById(current, sectionId, (section) => ({
            ...section,
            visible: !section.visible,
        })))
    }, [applyChange])

    const addSection = useCallback((type: string) => {
        if (!addSectionTarget || !sectionSchemas[type]) return
        const refusal = sectionInsertionRefusal(installedBlockBundle, editorState.sections, selectedTemplateKey, addSectionTarget, type)
        if (refusal) {
            notify({ title: 'Section cannot be added', description: refusal, variant: 'critical' })
            return
        }
        const nextSection = createSectionFromSchema(type, sectionSchemas, 0)
        applyChange((current) => {
            const result = insertEditorSection(installedBlockBundle, current.sections, selectedTemplateKey, addSectionTarget, nextSection)
            return result.inserted ? { ...current, sections: result.sections } : current
        })
        setSelection({ kind: 'section', sectionId: nextSection.id })
        setPanelMode('sections')
        setAddSectionTarget(null)
    }, [addSectionTarget, applyChange, editorState.sections, installedBlockBundle, notify, sectionSchemas, selectedTemplateKey])

    const openPreviewSectionCatalog = useCallback((adjacentSectionId: string, position: 'before' | 'after') => {
        const group = (['header', 'template', 'footer'] as const).find(key => editorState.sections[key].some(section => section.id === adjacentSectionId))
        if (!group) return
        setPanelMode('sections')
        setMobilePanel('sections')
        setNavigationOpen(true)
        setAddSectionTarget({ group, templateKey: selectedTemplateKey, adjacentSectionId, position })
    }, [editorState.sections, selectedTemplateKey])

    const moveSection = useCallback((sectionId: string, direction: -1 | 1) => {
        const index = editorState.sections.template.findIndex((section) => section.id === sectionId)
        const nextIndex = index + direction
        if (index < 0 || nextIndex < 0 || nextIndex >= editorState.sections.template.length) return

        applyChange((current) => {
            const template = [...current.sections.template]
            const [section] = template.splice(index, 1)
            template.splice(nextIndex, 0, section)
            return {
                ...current,
                sections: {
                    ...current.sections,
                    template: template.map((item, itemIndex) => ({ ...item, order: (itemIndex + 1) * 10 })),
                },
            }
        })
    }, [applyChange, editorState.sections.template])

    const removeSection = useCallback(() => {
        if (!sectionPendingRemoval) return
        applyChange((current) => {
            const template = current.sections.template.filter((section) => section.id !== sectionPendingRemoval.id)
            return {
                ...current,
                sections: { ...current.sections, template },
            }
        })
        setSectionPendingRemoval(null)
        setSelection(firstSelection({
            ...editorState,
            sections: {
                ...editorState.sections,
                template: editorState.sections.template.filter((section) => section.id !== sectionPendingRemoval.id),
            },
        }, settingsSchema))
    }, [applyChange, editorState, sectionPendingRemoval, settingsSchema])

    const addBlock = useCallback((sectionId: string, blockType: string, parentBlockId = sectionId) => {
        const section = getSectionById(editorState, sectionId)
        const catalog = section && blockCatalogs[section.type]
        if (!section || !catalog || !canAddEditorBlock(section, catalog, parentBlockId, blockType)) return
        const nextBlock = createBlockFromSchema(blockType, editorBlockSchema(catalog, blockType, parentBlockId === sectionId ? 1 : 2), 0)
        applyChange(current => updateSectionById(current, sectionId, target => addEditorBlock(target, catalog, parentBlockId, nextBlock)))
        setSelection({ kind: 'block', sectionId, blockId: nextBlock.id })
    }, [applyChange, editorState, blockCatalogs])

    const addChildBlock = useCallback((sectionId: string, parentBlockId: string, blockType: string) => {
        addBlock(sectionId, blockType, parentBlockId)
    }, [addBlock])

    const moveBlock = useCallback((sectionId: string, parentBlockId: string, blockId: string, direction: -1 | 1) => {
        const section = getSectionById(editorState, sectionId)
        if (!section || moveEditorBlock(section, parentBlockId, blockId, direction) === section) return
        applyChange(current => updateSectionById(current, sectionId, target => moveEditorBlock(target, parentBlockId, blockId, direction)))
    }, [applyChange, editorState])

    const toggleBlockVisibility = useCallback((sectionId: string, blockId: string) => {
        if (!getBlockById(getSectionById(editorState, sectionId), blockId)) return
        applyChange(current => updateSectionById(current, sectionId, target => toggleEditorBlock(target, blockId)))
    }, [applyChange, editorState])

    const requestRemoveChildBlock = useCallback((sectionId: string, parentBlockId: string, blockId: string) => {
        const section = getSectionById(editorState, sectionId)
        const block = section && editorBlockSiblings(section, parentBlockId)?.find(entry => entry.id === blockId)
        if (block) setBlockPendingRemoval({ sectionId, block })
    }, [editorState])

    const removeBlock = useCallback(() => {
        if (!blockPendingRemoval) return
        applyChange((current) => updateSectionById(current, blockPendingRemoval.sectionId, (section) => ({
            ...section,
            blocks: removeBlockFromTree(section.blocks, blockPendingRemoval.block.id),
        })))
        setSelection({ kind: 'section', sectionId: blockPendingRemoval.sectionId })
        setBlockPendingRemoval(null)
    }, [applyChange, blockPendingRemoval])

    const applyAiHook = useCallback((mode: 'copy' | 'blocks' | 'layout') => {
        if (selection.kind === 'theme') {
            applyChange((current) => ({
                ...current,
                themeSettings: {
                    ...current.themeSettings,
                    enableAnimations: true,
                    enableShadows: true,
                },
            }))
            notify({ title: 'Smart defaults applied', description: 'Preset motion and depth settings were applied.', variant: 'success' })
            return
        }

        const sectionId = selection.kind === 'block' ? selection.sectionId : selection.sectionId
        const section = getSectionById(editorState, sectionId)
        if (!section) return

        if (mode === 'blocks') {
            const schema = sectionSchemas[section.type]
            const firstBlockType = Object.keys(schema?.blocks_schema || {})[0]
            if (!firstBlockType) {
                notify({ title: 'No block defaults available', description: 'This section has no block schema.', variant: 'warning' })
                return
            }
            addBlock(section.id, firstBlockType)
            notify({ title: 'Smart defaults applied', description: 'A default content block was inserted from the section schema.', variant: 'success' })
            return
        }

        applyChange((current) => updateSectionById(current, section.id, (targetSection) => {
            const nextSettings = { ...targetSection.settings }
            if (mode === 'copy') {
                if ('heading' in nextSettings) nextSettings.heading = 'New season essentials'
                if ('title' in nextSettings) nextSettings.title = `${labelFromKey(targetSection.type)} for launch`
                if ('subheading' in nextSettings) nextSettings.subheading = 'Sharper storefront copy generated from this section schema.'
                if ('subtitle' in nextSettings) nextSettings.subtitle = 'A tighter edit that keeps shoppers moving through the page.'
                if ('text' in nextSettings) nextSettings.text = 'Fresh drops are live now.'
            }
            if (mode === 'layout') {
                if ('columns' in nextSettings) nextSettings.columns = Math.min(4, Math.max(2, numberValue(nextSettings.columns, 3)))
                if ('height' in nextSettings) nextSettings.height = 'large'
                if ('textAlign' in nextSettings) nextSettings.textAlign = 'left'
            }
            return { ...targetSection, settings: nextSettings }
        }))
        notify({ title: 'Smart defaults applied', description: 'Preset values were applied to the selected section.', variant: 'success' })
    }, [addBlock, applyChange, editorState, notify, sectionSchemas, selection])

    if (isLoading) return <EditorLoading />

    if (loadError) {
        return (
            <main className="theme-os theme-os--centered">
                <section className="theme-os-state" role="alert" aria-labelledby="theme-editor-error-title" aria-describedby="theme-editor-error-description">
                    <span className="theme-os-state__icon"><CircleAlert size={26} strokeWidth={1.75} aria-hidden="true" /></span>
                    <div className="theme-os-state__copy">
                        <span className="theme-os-state__eyebrow">Theme workspace</span>
                        <h1 id="theme-editor-error-title">Theme editor could not load</h1>
                        <p id="theme-editor-error-description">{loadError}</p>
                    </div>
                    <div className="theme-os-state__actions">
                        <Button type="button" onClick={() => void loadEditor()}>
                            <RefreshCw size={16} aria-hidden="true" />
                            Try again
                        </Button>
                        <Button asChild variant="secondary">
                            <Link href={`/${store}/online-store/themes`}>Back to themes</Link>
                        </Button>
                    </div>
                </section>
            </main>
        )
    }

    return (
        <main className={`theme-os ${editorStyles.editor}`} data-panel={mobilePanel} data-navigation={navigationOpen ? 'open' : 'closed'}>
            <header className="theme-os-topbar">
                <div className="theme-os-topbar__left">
                    <Link href={`/${store}/online-store/themes`} className="theme-os-icon-btn" aria-label="Back to themes" onClick={event => { if (isDirty || isSaving) { event.preventDefault(); setLeaveRequested(true) } }}>
                        <ArrowLeft size={17} aria-hidden="true" />
                    </Link>
                    <Button unstyled className="theme-os-icon-btn" aria-label="Toggle navigation panel" aria-pressed={navigationOpen} onClick={() => { setNavigationOpen(value => !value); setMobilePanel('sections') }}><PanelLeft size={17} aria-hidden="true" /></Button>
                    <Button unstyled
                        className={`theme-os-icon-btn ${panelMode === 'sections' ? 'theme-os-icon-btn--active' : ''}`}
                        type="button"
                        aria-label="Sections"
                        onClick={() => { setPanelMode('sections'); setNavigationOpen(true); setMobilePanel('sections') }}
                    >
                        <Layers3 size={17} aria-hidden="true" />
                    </Button>
                    <Button unstyled
                        className={`theme-os-icon-btn ${panelMode === 'settings' ? 'theme-os-icon-btn--active' : ''}`}
                        type="button"
                        aria-label="Theme settings"
                        onClick={() => { setPanelMode('settings'); setNavigationOpen(true); setMobilePanel('sections') }}
                    >
                        <Settings size={17} aria-hidden="true" />
                    </Button>
                    <Button unstyled
                        className={`theme-os-icon-btn ${panelMode === 'experiences' ? 'theme-os-icon-btn--active' : ''}`}
                        type="button"
                        aria-label="Theme styles"
                        onClick={() => { setPanelMode('experiences'); setMobilePanel('sections') }}
                    >
                        <Sparkles size={17} aria-hidden="true" />
                    </Button>
                    <Button unstyled
                        className={`theme-os-icon-btn ${panelMode === 'versions' ? 'theme-os-icon-btn--active' : ''}`}
                        type="button"
                        aria-label="Versions"
                        onClick={() => { setPanelMode('versions'); setMobilePanel('sections') }}
                    >
                        <FileJson size={17} aria-hidden="true" />
                    </Button>
                </div>

                <div className="theme-os-topbar__center">
                    <div className="theme-os-theme-pill">
                        <Blocks size={15} aria-hidden="true" />
                        <span>{themeName}</span>
                        <Badge label={isLiveTheme ? 'Active' : 'Draft theme'} variant={isLiveTheme ? 'success' : 'default'} />
                        <span aria-live="polite" title="Draft changes save automatically. Publishing updates the storefront.">{isSaving ? 'Saving…' : isDirty ? 'Unsaved' : 'Saved'}</span>
                    </div>
                    <label className="theme-os-page-pill" aria-label="Template">
                        <Laptop size={15} aria-hidden="true" />
                        <Select unstyled aria-label="Template"
                            value={selectedTemplateKey}
                            onChange={(event) => handleTemplateChange(event.target.value)}
                            disabled={isLoading || isSaving || isPublishing}
                            options={templateOptions.map(template => ({value:template.key,label:template.label}))}
                        />
                        <ChevronDown size={14} aria-hidden="true" />
                    </label>
                </div>

                <div className="theme-os-topbar__right">
                    <Button unstyled className="theme-os-icon-btn" type="button" aria-label="Undo" disabled={!canUndo} onClick={undo}>
                        <Undo2 size={17} aria-hidden="true" />
                    </Button>
                    <Button unstyled className="theme-os-icon-btn" type="button" aria-label="Redo" disabled={!canRedo} onClick={redo}>
                        <Redo2 size={17} aria-hidden="true" />
                    </Button>
                    <Button unstyled className="theme-os-btn" type="button" onClick={() => void handleSave()} disabled={isSaving || isPublishing || !isDirty}>
                        {isSaving ? <Loader2 className="theme-os-spin" size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
                        Save
                    </Button>
                    <Button unstyled className="theme-os-btn theme-os-btn--primary" type="button" onClick={() => void handlePublish()} disabled={isSaving || isPublishing || (isDirty && !draftClientRef.current?.hasPendingPublication)}>
                        {isPublishing ? <Loader2 className="theme-os-spin" size={15} aria-hidden="true" /> : <Rocket size={15} aria-hidden="true" />}
                        {draftClientRef.current?.hasPendingPublication ? 'Recover publish' : 'Publish'}
                    </Button>
                </div>
            </header>

            <div className="theme-os-workspace">
                <aside className="theme-os-sidebar" aria-label="Theme editor navigation" data-preview-resource={panelMode === 'sections' && Boolean(previewResourceType || templateBase === 'blog')}>
                    <div className="theme-os-sidebar__header">
                        <div>
                            <h2>{panelMode === 'sections' ? selectedTemplate.label : panelMode === 'settings' ? 'Theme settings' : panelMode === 'versions' ? 'Version history' : 'Theme styles'}</h2>
                        </div>
                        <Badge label={draftVersion ? `v${draftVersion}` : 'Draft'} variant="info" />
                    </div>

                    {panelMode === 'sections' && previewResourceType ? <div className={editorStyles.previewResource}>
                        <ResourcePickerControl key={`${store}:${themeId}:${selectedTemplateKey}`} storeName={store}
                            field={{ type: previewResourceType, label: templateBase === 'article' ? 'Preview blog post' : `Preview ${previewResourceType}`, info: 'Choose content to preview this template.' }}
                            value={previewResourceId} onChange={changePreviewResource} />
                    </div> : null}

                    {panelMode === 'sections' && templateBase === 'blog' ? <div className={editorStyles.previewResource}>
                        <form onSubmit={event => { event.preventDefault(); if (previewBlogPageValid) changePreviewBlogPage(Number(previewBlogPageInput)) }}>
                            <Input id="theme-editor-blog-page" type="number" min={1} max={1000} step={1} label="Preview blog page" value={previewBlogPageInput} onChange={event => setPreviewBlogPageInput(event.target.value)} error={!previewBlogPageValid ? 'Enter a page from 1 to 1000.' : undefined} />
                            <Button type="submit" variant="secondary" size="sm" disabled={!previewBlogPageValid || Number(previewBlogPageInput) === previewBlogPage}>Preview page</Button>
                        </form>
                    </div> : null}

                    {panelMode === 'sections' ? (
                        <SectionTreePanel
                            state={editorState}
                            sectionSchemas={sectionSchemas}
                            blockCatalogs={blockCatalogs}
                            selection={selection}
                            templateKey={selectedTemplateKey}
                            catalogTarget={addSectionTarget}
                            sectionCandidates={sectionCandidates}
                            onSelect={value => { setSelection(value); if (window.matchMedia('(max-width: 760px)').matches) setMobilePanel('properties') }}
                            onOpenCatalog={setAddSectionTarget}
                            onCloseCatalog={() => setAddSectionTarget(null)}
                            onInsertSection={addSection}
                            onMoveSection={moveSection}
                            onToggleSection={toggleSectionVisibility}
                            onRemoveSection={setSectionPendingRemoval}
                            onAddChildBlock={addChildBlock}
                            onRemoveChildBlock={requestRemoveChildBlock}
                            onMoveChildBlock={moveBlock}
                            onToggleBlock={toggleBlockVisibility}
                        />
                    ) : null}

                    {panelMode === 'settings' ? (
                        <ThemeSettingsTree
                            groups={themeGroups}
                            selection={selection}
                            onSelect={(groupKey) => { setSelection({ kind: 'theme', groupKey }); setMobilePanel('properties') }}
                        />
                    ) : null}

                    {panelMode === 'experiences' ? (
                        <>
                        <ExperiencePicker
                            presets={presetItems}
                            activeExperienceId={editorState.experienceId}
                            onApply={applyExperience}
                        />
                        {asRecord(asRecord(baseConfig.liquidBundle).package).slug === 'letbuyy-sense' && String(asRecord(asRecord(baseConfig.liquidBundle).package).version).startsWith('2.') && ['index', 'product', 'collection'].includes(selectedTemplateKey) ? <div className="te-form">
                            <p>Apply Threadline’s layout to this page. Existing copy and product bindings are preserved in matching sections.</p>
                            <Button variant="secondary" onClick={() => reviewThreadlinePage('COMPOSE_ADDITIVE')}>Review additive layout</Button>
                            <Button variant="secondary" onClick={() => reviewThreadlinePage('COMPLETE_DESIGN')}>Review full page layout</Button>
                        </div> : null}
                        </>
                    ) : null}

                    {panelMode === 'versions' ? (
                        <VersionTree
                            releases={releases}
                            currentReleaseVersion={currentReleaseVersion}
                            savedAt={savedAt}
                            draftVersion={draftVersion}
                            recoveryHref={isLiveTheme ? `/${store}/online-store/themes/update?themeSlug=${encodeURIComponent(themeId)}` : undefined}
                        />
                    ) : null}
                </aside>

                <section className="theme-os-preview-panel" aria-label="Live theme preview">
                    <div className="theme-os-preview-panel__header">
                        <div>
                            <strong>Live preview</strong>
                            <span>{store}.{getStorefrontRootDomain()} - {activeDevice.width}px</span>
                        </div>
                        <div className="theme-os-device-toggle" role="group" aria-label="Preview device">
                            {PREVIEW_DEVICES.map((device) => {
                                const Icon = device.icon
                                return (
                                    <Button unstyled
                                        key={device.value}
                                        className={previewDevice === device.value ? 'theme-os-device-toggle__btn theme-os-device-toggle__btn--active' : 'theme-os-device-toggle__btn'}
                                        type="button"
                                        aria-pressed={previewDevice === device.value}
                                        onClick={() => setPreviewDevice(device.value)}
                                    >
                                        <Icon size={14} aria-hidden="true" />
                                        {device.label}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="theme-os-preview-panel__canvas">
                        <CenterPanel
                            storeName={store}
                            viewport={previewDevice}
                            previewToken={previewToken}
                            previewError={previewError}
                            isPreviewRefreshing={isPreviewRefreshing}
                            selectedSectionId={selectedPreviewSectionId}
                            selectedBlockId={selection.kind === 'block' ? selection.blockId : null}
                            previewContext={previewContext}
                            identities={previewIdentities}
                            onRetryPreview={() => { void syncPreviewDraft() }}
                            retryDisabled={hasConflict || isPublishing}
                            onSelectSection={(sectionId) => { setSelection({ kind: 'section', sectionId }); if (window.matchMedia('(max-width: 760px)').matches) setMobilePanel('properties') }}
                            onSelectBlock={(sectionId, blockId) => { setSelection({ kind: 'block', sectionId, blockId }); if (window.matchMedia('(max-width: 760px)').matches) setMobilePanel('properties') }}
                            onAddSectionIntent={openPreviewSectionCatalog}
                        />
                    </div>
                </section>

                <PropertyPanel
                    store={store}
                    selection={selection}
                    selectedSection={selectedSection}
                    selectedBlock={selectedBlock}
                    selectedSectionSchema={selectedSectionSchema}
                    selectedBlockSchema={selectedBlockSchema}
                    selectedThemeGroup={selectedThemeGroup}
                    selectedThemeGroupKey={selectedThemeGroupKey}
                    themeSettings={editorState.themeSettings}
                    onSectionSettingChange={updateSectionSetting}
                    onBlockSettingChange={updateBlockSetting}
                    onThemeSettingChange={updateThemeSetting}
                    onSelectSection={(sectionId) => setSelection({ kind: 'section', sectionId })}
                    onAddBlock={addBlock}
                    canAddBlock={(sectionId, type) => { const section = getSectionById(editorState, sectionId); const catalog = section && blockCatalogs[section.type]; return Boolean(section && catalog && canAddEditorBlock(section, catalog, section.id, type)) }}
                    onRemoveBlock={(sectionId, block) => setBlockPendingRemoval({ sectionId, block })}
                    onAiHook={applyAiHook}
                />
            </div>

            <nav className={editorStyles.mobileTabs} aria-label="Editor panels">
                <Button variant={mobilePanel === 'sections' ? 'primary' : 'secondary'} aria-pressed={mobilePanel === 'sections'} onClick={() => setMobilePanel('sections')}><Layers3 size={16} />Sections</Button>
                <Button variant={mobilePanel === 'preview' ? 'primary' : 'secondary'} aria-pressed={mobilePanel === 'preview'} onClick={() => setMobilePanel('preview')}><Eye size={16} />Preview</Button>
                <Button variant={mobilePanel === 'properties' ? 'primary' : 'secondary'} aria-pressed={mobilePanel === 'properties'} onClick={() => setMobilePanel('properties')}><Settings size={16} />Settings</Button>
            </nav>
            <ConfirmDialog open={leaveRequested} title="Leave the editor?" description="Recent changes may still be saving. Stay in the editor to confirm they are saved before leaving." confirmLabel="Leave editor" cancelLabel="Stay in editor" onClose={() => setLeaveRequested(false)} onConfirm={() => { window.location.href = `/${store}/online-store/themes` }}><p>Saved drafts will be available when you return. Your live storefront changes only when you publish.</p></ConfirmDialog>
            <ConfirmDialog open={Boolean(designReview)} title={designReview?.mode === 'COMPLETE_DESIGN' ? 'Replace this page layout?' : 'Add Threadline’s page layout?'} description="This changes the current page’s draft. The live store changes only when you publish." confirmLabel="Apply reviewed layout" destructive={designReview?.atRisk} onClose={() => setDesignReview(null)} onConfirm={() => { if (designReview) applyChange(() => designReview.state); setDesignReview(null) }}>
                {designReview?.atRisk ? <p>Some sections with saved content or product bindings will be removed. Save your draft and duplicate it from the theme library first if you need to keep a separate copy. Undo remains available in this editor.</p> : <p>Matching content and bindings are kept. Additive application keeps extra sections.</p>}
                <ul>{designReview?.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>
            </ConfirmDialog>
            {(isSaving || isDirty) && <SaveBar
                state={isSaving ? 'saving' : isDirty ? 'unsaved' : 'saved'}
                saveLabel="Save draft"
                discardLabel="Discard"
                onSave={() => void handleSave()}
                onDiscard={discardChanges}
            />}

            <ConfirmDialog
                open={Boolean(sectionPendingRemoval)}
                title="Remove section?"
                description={sectionPendingRemoval ? `Remove ${sectionSchemas[sectionPendingRemoval.type]?.name || sectionPendingRemoval.type} from this draft.` : 'Remove the selected section.'}
                confirmLabel="Remove"
                destructive
                onClose={() => setSectionPendingRemoval(null)}
                onConfirm={removeSection}
            />

            <ConfirmDialog
                open={Boolean(blockPendingRemoval)}
                title="Remove block?"
                description={blockPendingRemoval ? `Remove ${blockPendingRemoval.block.type} from this section.` : 'Remove the selected block.'}
                confirmLabel="Remove"
                destructive
                onClose={() => setBlockPendingRemoval(null)}
                onConfirm={removeBlock}
            />

            {/* Phase R — ConflictDialog: shown when draft CAS returns HTTP 409 (CONFLICT). */}
            <ConflictDialog
                open={hasConflict}
                source={conflictSource}
                onReload={() => {
                    setHasConflict(false)
                    void loadEditor()
                }}
                replacementVersion={replacementVersion}
                busy={isReviewingConflict}
                onForce={() => { void recoverConflict() }}
                onDismiss={() => setHasConflict(false)}
            />
        </main>
    )
}

// Phase R: SectionTree / TreeGroup / TreeSection moved to SectionTreePanel.tsx.
// TreeGroup is re-imported via { TreeGroup } from that file so the panels below still work.

function ThemeSettingsTree({
    groups,
    selection,
    onSelect,
}: {
    groups: Array<[string, ThemeSettingsGroup]>
    selection: EditorSelection
    onSelect: (groupKey: string) => void
}) {
    return (
        <div className="theme-os-tree">
            <TreeGroup label="Theme settings">
                {groups.map(([groupKey, group]) => (
                    <Button unstyled
                        key={groupKey}
                        className={`theme-os-settings-link ${selection.kind === 'theme' && selection.groupKey === groupKey ? 'theme-os-settings-link--active' : ''}`}
                        type="button"
                        onClick={() => onSelect(groupKey)}
                    >
                        <Palette size={15} aria-hidden="true" />
                        <span>{group.label}</span>
                    </Button>
                ))}
            </TreeGroup>
        </div>
    )
}

function VersionTree({
    releases,
    currentReleaseVersion,
    savedAt,
    draftVersion,
    recoveryHref,
}: {
    releases: ReleaseEntry[]
    currentReleaseVersion: number | null
    savedAt: string | null
    draftVersion: number | null
    recoveryHref?: string
}) {
    return (
        <div className="theme-os-tree">
            <section className="theme-os-version-card">
                <span>Draft</span>
                <strong>{draftVersion ? `Version ${draftVersion}` : 'Local draft'}</strong>
                <small>{savedAt ? new Date(savedAt).toLocaleString() : 'Not saved yet'}</small>
            </section>
            <TreeGroup label="Published versions">
                {releases.length === 0 ? (
                    <div className="flex items-center gap-2"><MerchantEmptyArtwork scene="theme-editor" compact /><p className="theme-os-muted">No release history available.</p></div>
                ) : releases.map((release) => {
                    const version = releaseVersion(release)
                    return (
                        <div className="theme-os-release-row" key={releaseId(release)}>
                            <CheckCircle2 size={15} aria-hidden="true" />
                            <div>
                                <strong>Version {version || '-'}</strong>
                                <small>{releaseDate(release)}</small>
                            </div>
                            {version && currentReleaseVersion === version ? <Badge label="Current" variant="success" /> : null}
                        </div>
                    )
                })}
            </TreeGroup>
            {recoveryHref ? <Link href={recoveryHref}>Updates and recovery</Link> : null}
        </div>
    )
}

function PropertyPanel({
    store,
    selection,
    selectedSection,
    selectedBlock,
    selectedSectionSchema,
    selectedBlockSchema,
    selectedThemeGroup,
    selectedThemeGroupKey,
    themeSettings,
    onSectionSettingChange,
    onBlockSettingChange,
    onThemeSettingChange,
    onSelectSection,
    onAddBlock,
    canAddBlock,
    onRemoveBlock,
    onAiHook,
}: {
    store: string
    selection: EditorSelection
    selectedSection: SectionEntry | null
    selectedBlock: BlockEntry | null
    selectedSectionSchema?: SectionSchema
    selectedBlockSchema?: BlockSchema
    selectedThemeGroup: ThemeSettingsGroup | null
    selectedThemeGroupKey: string
    themeSettings: JsonRecord
    onSectionSettingChange: (sectionId: string, key: string, value: unknown) => void
    onBlockSettingChange: (sectionId: string, blockId: string, key: string, value: unknown) => void
    onThemeSettingChange: (key: string, value: unknown) => void
    onSelectSection: (sectionId: string) => void
    onAddBlock: (sectionId: string, blockType: string) => void
    canAddBlock: (sectionId: string, blockType: string) => boolean
    onRemoveBlock: (sectionId: string, block: BlockEntry) => void
    onAiHook: (mode: 'copy' | 'blocks' | 'layout') => void
}) {
    const title = selection.kind === 'theme'
        ? selectedThemeGroup?.label || labelFromKey(selectedThemeGroupKey)
        : selectedBlock
            ? selectedBlockSchema?.name || labelFromKey(selectedBlock.type)
            : selectedSectionSchema?.name || selectedSection?.type || 'Properties'

    return (
        <aside className="theme-os-properties" aria-label="Theme properties">
            <div className="theme-os-properties__header">
                <div>
                    <p>{selection.kind === 'theme' ? 'Theme settings' : selectedBlock ? 'Selected block' : 'Selected section'}</p>
                    <h2>{title}</h2>
                </div>
                {selection.kind === 'block' && selectedSection ? (
                    <Button unstyled className="theme-os-icon-btn" type="button" aria-label="Back to section" onClick={() => onSelectSection(selectedSection.id)}>
                        <X size={15} aria-hidden="true" />
                    </Button>
                ) : null}
            </div>

            <div className="theme-os-properties__body">
                <details className="theme-os-ai-card" aria-label="Smart defaults" aria-describedby="theme-smart-defaults-description">
                    <summary>Smart defaults</summary>
                    <div>
                    <Button unstyled type="button" aria-label="Apply copy defaults" onClick={() => onAiHook('copy')}>
                        <WandSparkles size={14} aria-hidden="true" />
                        Copy
                    </Button>
                    <Button unstyled type="button" aria-label="Apply layout defaults" onClick={() => onAiHook('layout')}>
                        <Sparkles size={14} aria-hidden="true" />
                        Layout
                    </Button>
                    <Button unstyled type="button" aria-label="Add a default block" onClick={() => onAiHook('blocks')}>
                        <Plus size={14} aria-hidden="true" />
                        Block
                    </Button>
                    </div>
                    <p id="theme-smart-defaults-description" className="theme-os-muted col-span-full">
                        Apply fixed defaults to your theme settings or section.
                    </p>
                </details>

                {selection.kind === 'theme' && selectedThemeGroup ? (
                    <section className="theme-os-property-card">
                        <SchemaFormRenderer
                            key={`theme:${selectedThemeGroupKey}`}
                            schema={selectedThemeGroup.fields}
                            values={themeSettings}
                            onChange={onThemeSettingChange}
                            storeName={store}
                        />
                    </section>
                ) : null}

                {selection.kind === 'section' && selectedSection ? (
                    <section className="theme-os-property-card">
                        {selectedSectionSchema ? (
                            <SchemaFormRenderer
                                key={`section:${selectedSection.id}`}
                                schema={selectedSectionSchema.settings_schema}
                                values={selectedSection.settings}
                                onChange={(key, value) => onSectionSettingChange(selectedSection.id, key, value)}
                                storeName={store}
                            />
                        ) : (
                            <p className="theme-os-muted">No schema exists for this section type.</p>
                        )}
                        {selectedSectionSchema?.blocks_schema ? (
                            <div className="theme-os-block-tools">
                                <p>Blocks</p>
                                {Object.entries(selectedSectionSchema.blocks_schema).filter(([blockType]) => !isLiquidAppBlockType(blockType)).map(([blockType, blockSchema]) => (
                                    <Button unstyled key={blockType} type="button" disabled={!canAddBlock(selectedSection.id, blockType)} onClick={() => onAddBlock(selectedSection.id, blockType)}>
                                        <Plus size={14} aria-hidden="true" />
                                        Add {blockSchema.name}
                                    </Button>
                                ))}
                            </div>
                        ) : null}
                    </section>
                ) : null}

                {selection.kind === 'block' && selectedSection && selectedBlock ? (
                    <section className="theme-os-property-card">
                        {selectedBlockSchema ? (
                            <SchemaFormRenderer
                                key={`block:${selectedSection.id}:${selectedBlock.id}`}
                                schema={selectedBlockSchema.fields}
                                values={selectedBlock.settings}
                                onChange={(key, value) => onBlockSettingChange(selectedSection.id, selectedBlock.id, key, value)}
                                storeName={store}
                            />
                        ) : (
                            <p className="theme-os-muted">No schema exists for this block type.</p>
                        )}
                        <Button unstyled className="theme-os-danger-btn" type="button" onClick={() => onRemoveBlock(selectedSection.id, selectedBlock)}>
                            <Trash2 size={14} aria-hidden="true" />
                            Remove block
                        </Button>
                    </section>
                ) : null}
            </div>
        </aside>
    )
}

export default function ThemeEditorPage() {
    return (
        <Suspense fallback={<EditorLoading />}>
            <ThemeEditorInner />
        </Suspense>
    )
}

function EditorLoading() {
    return (
        <main className="theme-os theme-os--centered">
            <section className="theme-os-state" role="status" aria-labelledby="theme-editor-loading-title" aria-describedby="theme-editor-loading-description" aria-atomic="true">
                <span className="theme-os-state__icon"><Loader2 className="theme-os-spin" size={26} strokeWidth={1.75} aria-hidden="true" /></span>
                <div className="theme-os-state__copy">
                    <span className="theme-os-state__eyebrow">Theme workspace</span>
                    <h1 id="theme-editor-loading-title">Loading theme editor</h1>
                    <p id="theme-editor-loading-description">Preparing your workspace and saved draft.</p>
                </div>
            </section>
        </main>
    )
}
