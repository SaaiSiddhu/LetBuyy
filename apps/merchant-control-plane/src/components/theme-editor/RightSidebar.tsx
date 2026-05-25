'use client'

import SchemaFormRenderer from './SchemaFormRenderer'
import type { SectionEntry } from '@/hooks/useEditorHistory'
import type { SectionSchema } from '@/lib/theme-schemas'

interface RightSidebarProps {
    section: SectionEntry | null
    sectionSchemas: Record<string, SectionSchema>
    onSettingChange: (sectionId: string, key: string, value: unknown) => void
    onClose: () => void
}

export default function RightSidebar({ section, sectionSchemas, onSettingChange, onClose }: RightSidebarProps) {
    if (!section) {
        return (
            <aside className="te-right-sidebar te-right-sidebar--empty">
                <div className="te-right-sidebar-placeholder">
                    <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--clr-text-tertiary)' }}>touch_app</span>
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
                        <span className="material-symbols-outlined">arrow_back</span>
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
                    <span className="material-symbols-outlined">arrow_back</span>
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
                />
            </div>
        </aside>
    )
}
