'use client'

import SchemaFormRenderer from './SchemaFormRenderer'
import type { BlockEntry, SectionEntry } from '@/hooks/useEditorHistory'
import type { BlockSchema, SectionSchema } from '@/lib/theme-schemas'
import { MaterialIcon } from '@letbuyy/ui'

interface RightSidebarProps {
    section: SectionEntry | null
    sectionSchemas: Record<string, SectionSchema>
    onSettingChange: (sectionId: string, key: string, value: unknown) => void
    onBlockSettingChange: (sectionId: string, blockId: string, key: string, value: unknown) => void
    onAddBlock: (sectionId: string, blockType: string) => void
    onDeleteBlock: (sectionId: string, blockId: string) => void
    onClose: () => void
    storeName?: string
}

export default function RightSidebar({
    section,
    sectionSchemas,
    onSettingChange,
    onBlockSettingChange,
    onAddBlock,
    onDeleteBlock,
    onClose,
    storeName,
}: RightSidebarProps) {
    if (!section) {
        return (
            <aside className="te-right-sidebar te-right-sidebar--empty">
                <div className="te-right-sidebar-placeholder">
                    <MaterialIcon name="touch_app" style={{ fontSize: '40px', color: 'var(--clr-text-tertiary)' }} />
                    <p>Select a section to edit&nbsp;its settings</p>
                </div>
            </aside>
        )
    }

    const schema = sectionSchemas[section.type]

    if (!schema) {
        return (
            <aside className="te-right-sidebar">
                <div className="te-right-sidebar-header">
                    <button className="te-right-sidebar-back" onClick={onClose}>
                        <MaterialIcon name="arrow_back" />
                    </button>
                    <h3 className="te-right-sidebar-title">{section.type}</h3>
                </div>
                <div className="te-right-sidebar-placeholder">
                    <p>No schema available for this section type.</p>
                </div>
            </aside>
        )
    }

    return (
        <aside className="te-right-sidebar">
            <div className="te-right-sidebar-header">
                <button className="te-right-sidebar-back" onClick={onClose}>
                    <MaterialIcon name="arrow_back" />
                </button>
                <div>
                    <h3 className="te-right-sidebar-title">{schema.name}</h3>
                    <p className="te-right-sidebar-subtitle">{schema.description}</p>
                </div>
            </div>

            <div className="te-right-sidebar-body">
                <SchemaFormRenderer
                    schema={schema.settings_schema}
                    values={section.settings}
                    onChange={(key, value) => onSettingChange(section.id, key, value)}
                    storeName={storeName}
                />
                {schema.blocks_schema ? (
                    <BlockEditor
                        section={section}
                        blockSchemas={schema.blocks_schema}
                        onBlockSettingChange={onBlockSettingChange}
                        onAddBlock={onAddBlock}
                        onDeleteBlock={onDeleteBlock}
                        storeName={storeName}
                    />
                ) : null}
            </div>
        </aside>
    )
}

interface BlockEditorProps {
    section: SectionEntry
    blockSchemas: Record<string, BlockSchema>
    onBlockSettingChange: (sectionId: string, blockId: string, key: string, value: unknown) => void
    onAddBlock: (sectionId: string, blockType: string) => void
    onDeleteBlock: (sectionId: string, blockId: string) => void
    storeName?: string
}

function BlockEditor({
    section,
    blockSchemas,
    onBlockSettingChange,
    onAddBlock,
    onDeleteBlock,
    storeName,
}: BlockEditorProps) {
    const blocks = section.blocks || []

    return (
        <div className="te-block-editor">
            <div className="te-block-editor-header">
                <h4 className="te-block-editor-title">Content blocks</h4>
            </div>

            {blocks.length === 0 ? (
                <p className="te-block-editor-empty">No blocks added.</p>
            ) : (
                <div className="te-block-editor-list">
                    {blocks.map((block) => (
                        <BlockCard
                            key={block.id}
                            sectionId={section.id}
                            block={block}
                            blockSchema={blockSchemas[block.type]}
                            onBlockSettingChange={onBlockSettingChange}
                            onDeleteBlock={onDeleteBlock}
                            storeName={storeName}
                        />
                    ))}
                </div>
            )}

            <div className="te-block-editor-actions">
                {Object.entries(blockSchemas).map(([blockType, blockSchema]) => (
                    <button
                        key={blockType}
                        type="button"
                        className="te-block-editor-add"
                        onClick={() => onAddBlock(section.id, blockType)}
                    >
                        <MaterialIcon name="add" style={{ fontSize: '16px' }} />
                        Add {blockSchema.name}
                    </button>
                ))}
            </div>
        </div>
    )
}

interface BlockCardProps {
    sectionId: string
    block: BlockEntry
    blockSchema?: BlockSchema
    onBlockSettingChange: (sectionId: string, blockId: string, key: string, value: unknown) => void
    onDeleteBlock: (sectionId: string, blockId: string) => void
    storeName?: string
}

function BlockCard({
    sectionId,
    block,
    blockSchema,
    onBlockSettingChange,
    onDeleteBlock,
    storeName,
}: BlockCardProps) {
    if (!blockSchema) {
        return (
            <div className="te-block-card">
                <div className="te-block-card-header">
                    <h5 className="te-block-card-title">{block.type}</h5>
                    <button
                        type="button"
                        className="te-block-card-delete"
                        onClick={() => onDeleteBlock(sectionId, block.id)}
                    >
                        <MaterialIcon name="delete" style={{ fontSize: '16px' }} />
                    </button>
                </div>
                <p className="te-block-editor-empty">Schema missing for this block type.</p>
            </div>
        )
    }

    return (
        <div className="te-block-card">
            <div className="te-block-card-header">
                <h5 className="te-block-card-title">{blockSchema.name}</h5>
                <button
                    type="button"
                    className="te-block-card-delete"
                    onClick={() => onDeleteBlock(sectionId, block.id)}
                    title="Remove block"
                >
                    <MaterialIcon name="delete" style={{ fontSize: '16px' }} />
                </button>
            </div>
            <SchemaFormRenderer
                schema={blockSchema.fields}
                values={block.settings}
                onChange={(key, value) => onBlockSettingChange(sectionId, block.id, key, value)}
                storeName={storeName}
            />
        </div>
    )
}
