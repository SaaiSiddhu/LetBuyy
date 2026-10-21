'use client'

import { getStorefrontRootDomain } from '@/lib/public-urls'
import { useReadRequest } from '@/lib/api/use-read-request'
import { isUnchangedCoreDemoCategoryBlocks } from '@letbuyy/theme-engine'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
    ArrowLeft,
    Blocks,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Eye,
    FileJson,
    GripVertical,
    Laptop,
    Layers3,
    Loader2,
    Monitor,
    Palette,
    PanelLeft,
    Plus,
    Redo2,
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
import { Button, Badge, ConfirmDialog, SaveBar, Select, letbuyyPrimitiveTokens, useToast } from '@letbuyy/ui'
import {
    getDefaultStorefrontThemeTemplate,
    getSectionSchemas,
    getThemeSettingsSchema,
    hasRenderableThemeTemplate,
    resolveExperiencePresetItems,
    type ExperiencePresetItem,
} from '@letbuyy/theme-engine'
import SchemaFormRenderer from '@/components/theme-editor/SchemaFormRenderer'
import CenterPanel from '@/components/theme-editor/CenterPanel'
import { PREVIEW_VIEWPORT_WIDTHS } from '@/components/theme-editor/preview-viewport'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import ExperiencePicker from '@/components/theme-editor/ExperiencePicker'
import ConflictDialog from '@/components/theme-editor/ConflictDialog'
import { ThemeDraftClient, ThemeDraftConflictError, ThemeDraftValidationError } from '@/lib/theme-draft-client'
import SectionTreePanel, { TreeGroup } from '@/components/theme-editor/SectionTreePanel'
import type { BlockSchema, SchemaField, SectionSchema, ThemeSettingsGroup, ThemeSettingsSchema } from '@/lib/theme-schemas'

type JsonRecord = Record<string, unknown>
type PreviewDevice = 'desktop' | 'tablet' | 'mobile'
type PanelMode = 'sections' | 'settings' | 'experiences' | 'versions'

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
    experienceId?: string
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

type AvailableSection = {
    type: string
    name: string
    description: string
    hasBlocks: boolean
    settingsCount: number
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
    { key: 'blog', label: 'Blog post', type: 'blog' },
]

const EMPTY_SETTINGS_SCHEMA: ThemeSettingsSchema = {
    schema_version: '2026-05-json-contract',
    settings: {},
}

const EMPTY_STATE: EditorState = {
    themeSettings: {},
    sections: {
        header: null,
        footer: null,
        template: [],
    },
}

const PREVIEW_DEVICES: Array<{ value: PreviewDevice; label: string; icon: typeof Monitor; width: number }> = [
    { value: 'desktop', label: 'Desktop', icon: Monitor, width: PREVIEW_VIEWPORT_WIDTHS.desktop },
    { value: 'tablet', label: 'Tablet', icon: Tablet, width: PREVIEW_VIEWPORT_WIDTHS.tablet },
    { value: 'mobile', label: 'Mobile', icon: Smartphone, width: PREVIEW_VIEWPORT_WIDTHS.mobile },
]

const FIELD_TYPES = new Set([
    'text',
    'textarea',
    'richtext',
    'color',
    'image',
    'select',
    'toggle',
    'range',
    'number',
    'url',
    'radio',
])

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

function labelFromKey(key: string): string {
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeTemplateKey(value: unknown, fallback = 'index'): string {
    const normalized = typeof value === 'string' ? value.trim() : ''
    return /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(normalized) ? normalized : fallback
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
            return key ? [{
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
        if (!normalizedKey) continue
        options.set(normalizedKey, {
            key: normalizedKey,
            label: templateLabel(normalizedKey, asRecord(template)),
            type: stringValue(asRecord(template).type, normalizedKey),
        })
    }

    return Array.from(options.values())
}

function normalizeFieldType(value: unknown): SchemaField['type'] {
    const rawType = typeof value === 'string' ? value : 'text'
    if (rawType === 'checkbox') return 'toggle'
    if (rawType === 'font') return 'select'
    return FIELD_TYPES.has(rawType) ? (rawType as SchemaField['type']) : 'text'
}

function normalizeFieldOptions(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined

    const options = value.flatMap((entry) => {
        if (typeof entry === 'string') return [entry]
        const record = asRecord(entry)
        const optionValue = record.value
        if (typeof optionValue === 'string') return [optionValue]
        if (typeof optionValue === 'number' || typeof optionValue === 'boolean') return [String(optionValue)]
        return []
    })

    return options.length > 0 ? options : undefined
}

function normalizeField(key: string, value: unknown): SchemaField {
    const record = asRecord(value)
    return {
        type: normalizeFieldType(record.type),
        label: stringValue(record.label, labelFromKey(key)),
        default: record.default,
        maxLength: typeof record.maxLength === 'number' ? record.maxLength : typeof record.max_length === 'number' ? record.max_length : undefined,
        options: normalizeFieldOptions(record.options),
        min: typeof record.min === 'number' ? record.min : undefined,
        max: typeof record.max === 'number' ? record.max : undefined,
        step: typeof record.step === 'number' ? record.step : undefined,
        unit: optionalString(record.unit),
        info: optionalString(record.info) || optionalString(record.help_text),
        description: optionalString(record.description),
    }
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
    if (field.default !== undefined) return field.default
    if (field.type === 'toggle') return false
    if (field.type === 'number' || field.type === 'range') return field.min ?? 0
    if (field.type === 'color') return letbuyyPrimitiveTokens.color.black
    return ''
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
    const sections = asRecord(template.sections)
    if (Object.keys(sections).length === 0) return null

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

function normalizeBlock(value: unknown, index: number, blockSchemas?: Record<string, BlockSchema>): BlockEntry | null {
    const record = asRecord(value)
    const type = stringValue(record.type)
    if (!type) return null

    const defaults = blockSchemas?.[type]?.fields ? defaultSettingsForFields(blockSchemas[type].fields) : {}

    return {
        id: stringValue(record.id, `${type}-${index + 1}`),
        type,
        order: numberValue(record.order, index),
        visible: record.visible === false || record.isVisible === false ? false : true,
        settings: {
            ...defaults,
            ...asRecord(record.settings),
        },
    }
}

function normalizeSection(
    value: unknown,
    fallbackType: string,
    fallbackId: string,
    index: number,
    schemas: Record<string, SectionSchema>,
): SectionEntry | null {
    const record = asRecord(value)
    const type = stringValue(record.type, fallbackType)
    if (!type) return null

    const schema = schemas[type]
    const blocks = Array.isArray(record.blocks)
        ? record.blocks.flatMap((block, blockIndex) => {
            const normalized = normalizeBlock(block, blockIndex, schema?.blocks_schema)
            return normalized ? [normalized] : []
        })
        : sampleBlocksForSchema(schema)

    return {
        id: stringValue(record.id, fallbackId),
        type,
        order: numberValue(record.order, index * 10),
        visible: record.visible === false || record.isVisible === false ? false : true,
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
        id: `${type}-${Date.now().toString(36)}`,
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
        id: `${blockType}-${Date.now().toString(36)}`,
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
    const root = getSectionRoot(candidate, templateKey)
    const fallbackRoot = getSectionRoot(fallbackConfig, templateKey)
    const templateEntries = Array.isArray(root.template) ? root.template : []
    const templates = asRecord(candidate.templates)
    // Portable themes own their header/footer and setting defaults. Importing
    // another renderer's fallback fields makes the first draft fail validation.
    const headerSource = root.header || (isLiquid ? portableTemplateSectionsToArray(asRecord(templates.header))?.[0] : fallbackRoot.header)
    const footerSource = root.footer || (isLiquid ? portableTemplateSectionsToArray(asRecord(templates.footer))?.[0] : fallbackRoot.footer)
    const header = headerSource ? normalizeSection(headerSource, 'header', 'header', 0, sectionSchemas) : null
    const footer = footerSource ? normalizeSection(footerSource, 'footer', 'footer', 100, sectionSchemas) : null
    const template = templateEntries.flatMap((section, index) => {
        const normalized = normalizeSection(section, `section_${index + 1}`, `section-${index + 1}`, index + 1, sectionSchemas)
        if (normalized && asRecord(asRecord(candidate.liquidBundle).package).slug === 'letbuyy-core-liquid'
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
    return {
        type: block.type,
        visible: block.visible,
        settings: block.settings,
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
        sections: state.sections,
        templates: {
            ...templates,
            [templateKey]: nextTemplate,
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
        state.sections.header,
        ...state.sections.template,
        state.sections.footer,
    ].filter((section): section is SectionEntry => Boolean(section))
}

function getSectionById(state: EditorState, sectionId: string): SectionEntry | null {
    return getAllSections(state).find((section) => section.id === sectionId) || null
}

function getBlockById(section: SectionEntry | null, blockId: string): BlockEntry | null {
    return section?.blocks.find((block) => block.id === blockId) || null
}

function updateSectionById(state: EditorState, sectionId: string, updater: (section: SectionEntry) => SectionEntry): EditorState {
    const updateNullable = (section: SectionEntry | null) => section?.id === sectionId ? updater(section) : section

    return {
        ...state,
        sections: {
            header: updateNullable(state.sections.header),
            footer: updateNullable(state.sections.footer),
            template: state.sections.template.map((section) => section.id === sectionId ? updater(section) : section),
        },
    }
}

function coerceFieldValue(field: SchemaField | undefined, value: unknown): unknown {
    if (!field) return value
    if (field.type === 'toggle') return Boolean(value)
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
    const firstSection = state.sections.header || state.sections.template[0] || state.sections.footer
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

    const [settingsSchema, setSettingsSchema] = useState<ThemeSettingsSchema>(() => normalizeSettingsSchema(getThemeSettingsSchema(themeId || 'urban-kicks')))
    const [sectionSchemas, setSectionSchemas] = useState<Record<string, SectionSchema>>(() => getSectionSchemas(themeId || 'urban-kicks'))
    const [availableSections, setAvailableSections] = useState<AvailableSection[]>([])
    const [editorState, setEditorState] = useState<EditorState>(EMPTY_STATE)
    const [savedState, setSavedState] = useState<EditorState>(EMPTY_STATE)
    const [baseConfig, setBaseConfig] = useState<JsonRecord>({})
    const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>(DEFAULT_TEMPLATE_OPTIONS)
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('index')
    const [history, setHistory] = useState<EditorHistory>({ past: [], future: [] })
    const [selection, setSelection] = useState<EditorSelection>({ kind: 'section', sectionId: 'header' })
    const [panelMode, setPanelMode] = useState<PanelMode>('sections')
    const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop')
    const [addSectionType, setAddSectionType] = useState('')
    const [sectionPendingRemoval, setSectionPendingRemoval] = useState<SectionEntry | null>(null)
    const [blockPendingRemoval, setBlockPendingRemoval] = useState<{ sectionId: string; block: BlockEntry } | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const [themeName, setThemeName] = useState('LetBuyy Core')
    const [schemaSource, setSchemaSource] = useState('registry')
    const [draftVersion, setDraftVersion] = useState<number | null>(null)
    const [savedAt, setSavedAt] = useState<string | null>(null)
    const [currentReleaseVersion, setCurrentReleaseVersion] = useState<number | null>(null)
    const [releases, setReleases] = useState<ReleaseEntry[]>([])
    const [previewToken, setPreviewToken] = useState<string | null>(null)
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
    const selectedBlockSchema = selectedSection && selectedBlock
        ? selectedSectionSchema?.blocks_schema?.[selectedBlock.type]
        : undefined
    const addableSections = useMemo(() => {
        const existingPinned = new Set(['header', 'footer'])
        return availableSections.length > 0
            ? availableSections.filter((section) => !existingPinned.has(section.type))
            : Object.entries(sectionSchemas)
                .filter(([type]) => !existingPinned.has(type))
                .map(([type, schema]) => ({
                    type,
                    name: schema.name,
                    description: schema.description,
                    hasBlocks: Boolean(schema.blocks_schema),
                    settingsCount: Object.keys(schema.settings_schema || {}).length,
                }))
    }, [availableSections, sectionSchemas])
    const activeAddSectionType = addSectionType || addableSections[0]?.type || ''
    const activeDevice = PREVIEW_DEVICES.find((device) => device.value === previewDevice) || PREVIEW_DEVICES[0]
    const selectedTemplate = templateOptions.find((option) => option.key === selectedTemplateKey) || templateOptions[0] || DEFAULT_TEMPLATE_OPTIONS[0]
    const selectedPreviewSectionId = selection.kind === 'theme' ? null : selection.sectionId

    const applyChange = useCallback((updater: (current: EditorState) => EditorState) => {
        setEditorState((current) => {
            const next = updater(current)
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
            const nextTemplateOptions = normalizeTemplateOptions(editorPayload.templates, loadedBaseConfig)
            const nextTemplateKey = normalizeTemplateKey(editorPayload.templateKey || selectedTemplateKey)
            const nextState = normalizeEditorState(
                editorPayload.draftConfig || editorPayload.templateConfig,
                themeId,
                nextTemplateKey,
                apiSectionSchemas,
                nextSettingsSchema,
            )
            const catalogSchemas = Object.keys(asRecord(editorPayload.sectionSchemas)).length > 0
                ? editorPayload.sectionSchemas as Record<string, SectionSchema> : apiSectionSchemas
            const sectionCatalog = Object.entries(catalogSchemas).map(([type, schema]) => ({
                    type,
                    name: schema.name,
                    description: schema.description,
                    hasBlocks: Boolean(schema.blocks_schema),
                    settingsCount: Object.keys(schema.settings_schema || {}).length,
                }))

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
            setAvailableSections(sectionCatalog)
            setTemplateOptions(nextTemplateOptions)
            setSelectedTemplateKey(nextTemplateKey)
            setSettingsSchema(nextSettingsSchema)
            setEditorState(nextState)
            setSavedState(nextState)
            setBaseConfig(loadedBaseConfig)
            setSelection(firstSelection(nextState, nextSettingsSchema))
            setHistory({ past: [], future: [] })
            setIsDirty(false)
            setThemeName(stringValue(editorPayload.theme?.name, labelFromKey(themeId)))
            setSchemaSource(stringValue(editorPayload.theme?.schema_source, 'registry'))
            setDraftVersion(typeof editorPayload.version === 'number' ? editorPayload.version : null)
            setSavedAt(editorPayload.draftSavedAt || null)
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
            if (!modifier) return

            if (event.key.toLowerCase() === 's') {
                event.preventDefault()
                void handleSave()
            }
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

    const saveDraft = useCallback(async (reviewedVersion?: number) => {
        const client = draftClientRef.current
        if (!client || draftClientScopeRef.current !== `${client.actorId}:${client.storeId}:${themeId}:${selectedTemplateKey}:${store}`) throw new Error('Reload the current owned editor before saving.')
        const snapshot = editorState
        const draftConfig = buildDraftConfig(baseConfig, themeId, snapshot, selectedTemplateKey)
        try {
            const ack = await client.save(draftConfig, reviewedVersion)
            if (draftClientRef.current !== client) return ack
            setBaseConfig((current) => JSON.stringify(current) === JSON.stringify(draftConfig) ? current : draftConfig)
            setSavedState(snapshot)
            setDraftVersion(ack.version)
            if (ack.savedAt) setSavedAt(ack.savedAt)
            if (latestEditorState.current === snapshot) setHistory({ past: [], future: [] })
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
            await saveDraft()
            if (previewRequestCounter.current !== requestId || draftClientRef.current !== client) return
            if (!client.hasDraft) { setPreviewToken(null); return }
            const sessionRes = await fetch(`/api/themes/${themeId}/preview-session`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
                body: JSON.stringify({ store_name: store, actorId: client.actorId, storeId: client.storeId, ttl_seconds: 900, templateKey: selectedTemplateKey }),
            })
            const sessionPayload = await sessionRes.json().catch(() => ({}))
            if (!sessionRes.ok) throw new Error(stringValue(asRecord(asRecord(sessionPayload).error).message, 'Unable to refresh the storefront preview.'))
            const nextPreviewToken = stringValue(asRecord(asRecord(sessionPayload).data).preview_token)
            if (!nextPreviewToken) throw new Error('Preview session did not return a token.')
            if (previewRequestCounter.current !== requestId || draftClientRef.current !== client) return
            setPreviewToken(nextPreviewToken)
        } catch (error) {
            if (previewRequestCounter.current !== requestId || draftClientRef.current !== client) return
            if (error instanceof ThemeDraftConflictError) setConflictSource('autosave')
            setPreviewError(error instanceof Error ? error.message : 'Unable to refresh the storefront preview.')
        } finally {
            if (previewRequestCounter.current === requestId) setIsPreviewRefreshing(false)
        }
    }, [editorState, saveDraft, selectedTemplateKey, store, themeId])

    useEffect(() => {
        if (isLoading || loadError || !store || !themeId || hasConflict || draftClientRef.current?.paused || isPublishing) return
        const timeout = window.setTimeout(() => { void syncPreviewDraft() }, isDirty ? 900 : 0)
        return () => window.clearTimeout(timeout)
    }, [hasConflict, isDirty, isLoading, isPublishing, loadError, store, syncPreviewDraft, themeId])

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
            setIsDirty(latestEditorState.current !== snapshot)
            if (latestEditorState.current === snapshot) setHistory({ past: [], future: [] })
            void loadReleases()
            notify({ title: ack.replayed === true || ack.currentVersion > ack.version ? 'Theme publication recovered' : 'Theme published', description: ack.currentVersion > ack.version ? 'The saved version was published. A newer draft revision exists; review it before editing further.' : ack.replayed === true ? 'The earlier publication is confirmed. Review the latest live version and saved draft.' : latestEditorState.current === snapshot ? `${selectedTemplate.label} is now included in the live storefront version.` : 'The previously saved version is live. Your newer edits remain a draft.', variant: 'success' })
        } catch (error) {
            if (draftClientRef.current !== client) return
            if (error instanceof ThemeDraftConflictError) { setReplacementVersion(null); setHasConflict(true); setConflictSource('manual-save') }
            notify({ title: 'Theme publish not confirmed', description: error instanceof Error ? error.message : 'Retry publication to recover its result.', variant: 'critical' })
        } finally { if (draftClientRef.current === client) setIsPublishing(false) }
    }, [currentReleaseVersion, savedState, isDirty, isPublishing, loadReleases, notify, selectedTemplate.label, selectedTemplateKey, store, themeId])

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
        setSelectedTemplateKey(normalized)
    }, [isDirty, notify, selectedTemplateKey])

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
        const block = getBlockById(section, blockId)
        const field = section && block ? sectionSchemas[section.type]?.blocks_schema?.[block.type]?.fields?.[key] : undefined
        applyChange((current) => updateSectionById(current, sectionId, (targetSection) => ({
            ...targetSection,
            blocks: targetSection.blocks.map((targetBlock) => targetBlock.id === blockId ? {
                ...targetBlock,
                settings: {
                    ...targetBlock.settings,
                    [key]: coerceFieldValue(field, value),
                },
            } : targetBlock),
        })))
    }, [applyChange, editorState, sectionSchemas])

    const toggleSectionVisibility = useCallback((sectionId: string) => {
        applyChange((current) => updateSectionById(current, sectionId, (section) => ({
            ...section,
            visible: !section.visible,
        })))
    }, [applyChange])

    const addSection = useCallback(() => {
        if (!activeAddSectionType) return
        const order = editorState.sections.template.length
            ? Math.max(...editorState.sections.template.map((section) => section.order)) + 10
            : 10
        const nextSection = createSectionFromSchema(activeAddSectionType, sectionSchemas, order)
        applyChange((current) => ({
            ...current,
            sections: {
                ...current.sections,
                template: [...current.sections.template, nextSection],
            },
        }))
        setSelection({ kind: 'section', sectionId: nextSection.id })
        setPanelMode('sections')
    }, [activeAddSectionType, applyChange, editorState.sections.template, sectionSchemas])

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

    const addBlock = useCallback((sectionId: string, blockType: string) => {
        const section = getSectionById(editorState, sectionId)
        const blockSchema = section ? sectionSchemas[section.type]?.blocks_schema?.[blockType] : undefined
        const order = section?.blocks.length ? Math.max(...section.blocks.map((block) => block.order)) + 10 : 10
        const nextBlock = createBlockFromSchema(blockType, blockSchema, order)
        applyChange((current) => updateSectionById(current, sectionId, (targetSection) => ({
            ...targetSection,
            blocks: [...targetSection.blocks, nextBlock],
        })))
        setSelection({ kind: 'block', sectionId, blockId: nextBlock.id })
    }, [applyChange, editorState, sectionSchemas])

    const removeBlock = useCallback(() => {
        if (!blockPendingRemoval) return
        applyChange((current) => updateSectionById(current, blockPendingRemoval.sectionId, (section) => ({
            ...section,
            blocks: section.blocks.filter((block) => block.id !== blockPendingRemoval.block.id),
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
                <section className="theme-os-state" role="alert">
                    <FileJson size={32} aria-hidden="true" />
                    <h1>Theme editor could not load</h1>
                    <p>{loadError}</p>
                    <Button unstyled className="theme-os-btn theme-os-btn--primary" type="button" onClick={() => void loadEditor()}>
                        Retry
                    </Button>
                </section>
            </main>
        )
    }

    return (
        <main className="theme-os">
            <header className="theme-os-topbar">
                <div className="theme-os-topbar__left">
                    <Link href={`/${store}/online-store/themes`} className="theme-os-icon-btn" aria-label="Back to themes">
                        <ArrowLeft size={17} aria-hidden="true" />
                    </Link>
                    <Button unstyled
                        className={`theme-os-icon-btn ${panelMode === 'sections' ? 'theme-os-icon-btn--active' : ''}`}
                        type="button"
                        aria-label="Sections"
                        onClick={() => setPanelMode('sections')}
                    >
                        <Layers3 size={17} aria-hidden="true" />
                    </Button>
                    <Button unstyled
                        className={`theme-os-icon-btn ${panelMode === 'settings' ? 'theme-os-icon-btn--active' : ''}`}
                        type="button"
                        aria-label="Theme settings"
                        onClick={() => setPanelMode('settings')}
                    >
                        <Settings size={17} aria-hidden="true" />
                    </Button>
                    <Button unstyled
                        className={`theme-os-icon-btn ${panelMode === 'experiences' ? 'theme-os-icon-btn--active' : ''}`}
                        type="button"
                        aria-label="Experiences"
                        onClick={() => setPanelMode('experiences')}
                    >
                        <Sparkles size={17} aria-hidden="true" />
                    </Button>
                    <Button unstyled
                        className={`theme-os-icon-btn ${panelMode === 'versions' ? 'theme-os-icon-btn--active' : ''}`}
                        type="button"
                        aria-label="Versions"
                        onClick={() => setPanelMode('versions')}
                    >
                        <FileJson size={17} aria-hidden="true" />
                    </Button>
                </div>

                <div className="theme-os-topbar__center">
                    <div className="theme-os-theme-pill">
                        <Blocks size={15} aria-hidden="true" />
                        <span>{themeName}</span>
                        <Badge label={isDirty ? 'Draft' : 'Saved'} variant={isDirty ? 'warning' : 'success'} />
                    </div>
                    <label className="theme-os-page-pill" aria-label="Template">
                        <Laptop size={15} aria-hidden="true" />
                        <select
                            value={selectedTemplateKey}
                            onChange={(event) => handleTemplateChange(event.target.value)}
                            disabled={isLoading || isSaving || isPublishing}
                        >
                            {templateOptions.map((template) => (
                                <option key={template.key} value={template.key}>{template.label}</option>
                            ))}
                        </select>
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
                <aside className="theme-os-sidebar" aria-label="Theme editor navigation">
                    <div className="theme-os-sidebar__header">
                        <div>
                            <p>{schemaSource} schema</p>
                            <h2>Theme OS</h2>
                        </div>
                        <Badge label={draftVersion ? `v${draftVersion}` : 'Draft'} variant="info" />
                    </div>

                    {panelMode === 'sections' ? (
                        <SectionTreePanel
                            state={editorState}
                            sectionSchemas={sectionSchemas}
                            selection={selection}
                            addableSections={addableSections}
                            addSectionType={activeAddSectionType}
                            onSelect={setSelection}
                            onAddSectionTypeChange={setAddSectionType}
                            onAddSection={addSection}
                            onMoveSection={moveSection}
                            onToggleSection={toggleSectionVisibility}
                            onRemoveSection={setSectionPendingRemoval}
                        />
                    ) : null}

                    {panelMode === 'settings' ? (
                        <ThemeSettingsTree
                            groups={themeGroups}
                            selection={selection}
                            onSelect={(groupKey) => setSelection({ kind: 'theme', groupKey })}
                        />
                    ) : null}

                    {panelMode === 'experiences' ? (
                        <ExperiencePicker
                            presets={presetItems}
                            activeExperienceId={editorState.experienceId}
                            onApply={applyExperience}
                        />
                    ) : null}

                    {panelMode === 'versions' ? (
                        <VersionTree
                            releases={releases}
                            currentReleaseVersion={currentReleaseVersion}
                            savedAt={savedAt}
                            draftVersion={draftVersion}
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
                            onSelectSection={(sectionId) => setSelection({ kind: 'section', sectionId })}
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
                    onRemoveBlock={(sectionId, block) => setBlockPendingRemoval({ sectionId, block })}
                    onAiHook={applyAiHook}
                />
            </div>

            <SaveBar
                state={isSaving ? 'saving' : isDirty ? 'unsaved' : 'saved'}
                saveLabel="Save draft"
                discardLabel="Discard"
                onSave={() => void handleSave()}
                onDiscard={discardChanges}
            />

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
}: {
    releases: ReleaseEntry[]
    currentReleaseVersion: number | null
    savedAt: string | null
    draftVersion: number | null
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
                    <p className="theme-os-muted">No release history available.</p>
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
                <section className="theme-os-ai-card" aria-label="Smart defaults" aria-describedby="theme-smart-defaults-description">
                    <div>
                        <Settings size={16} aria-hidden="true" />
                        <strong>Smart defaults</strong>
                    </div>
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
                    <p id="theme-smart-defaults-description" className="theme-os-muted col-span-full">
                        Apply fixed defaults to your theme settings or section.
                    </p>
                </section>

                {selection.kind === 'theme' && selectedThemeGroup ? (
                    <section className="theme-os-property-card">
                        <SchemaFormRenderer
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
                                {Object.entries(selectedSectionSchema.blocks_schema).map(([blockType, blockSchema]) => (
                                    <Button unstyled key={blockType} type="button" onClick={() => onAddBlock(selectedSection.id, blockType)}>
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
            <section className="theme-os-state" role="status">
                <Loader2 className="theme-os-spin" size={32} aria-hidden="true" />
                <h1>Loading theme editor</h1>
            </section>
        </main>
    )
}
