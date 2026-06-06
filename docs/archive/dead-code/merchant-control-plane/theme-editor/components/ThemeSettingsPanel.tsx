'use client'

import { useState } from 'react'
import SchemaFormRenderer from './SchemaFormRenderer'
import type { ThemeSettingsGroup, ThemeSettingsSchema } from '@/lib/theme-schemas'
import { MaterialIcon } from '@letbuyy/ui'

interface ThemeSettingsPanelProps {
    themeSettings: Record<string, unknown>
    settingsSchema: ThemeSettingsSchema
    onSettingChange: (key: string, value: unknown) => void
}

export default function ThemeSettingsPanel({ themeSettings, settingsSchema, onSettingChange }: ThemeSettingsPanelProps) {
    const [expandedGroup, setExpandedGroup] = useState<string | null>('colors')

    const groups = settingsSchema.settings as Record<string, ThemeSettingsGroup>

    return (
        <aside className="te-left-sidebar">
            <div className="te-left-sidebar-header">
                <h3 className="te-left-sidebar-title">Theme settings</h3>
            </div>

            <div className="te-theme-settings-list">
                {Object.entries(groups).map(([groupKey, group]) => {
                    const isExpanded = expandedGroup === groupKey
                    return (
                        <div key={groupKey} className="te-theme-group">
                            <button
                                className={`te-theme-group-toggle ${isExpanded ? 'te-theme-group-toggle--open' : ''}`}
                                onClick={() => setExpandedGroup(isExpanded ? null : groupKey)}
                            >
                                <MaterialIcon name={groupKey === 'colors' ? 'palette' : groupKey === 'typography' ? 'text_fields' : groupKey === 'layout' ? 'dashboard' : groupKey === 'header' ? 'web_asset' : 'view_stream'} size={18} />
                                <span className="te-theme-group-label">{group.label}</span>
                                <MaterialIcon name={isExpanded ? 'expand_less' : 'expand_more'} className="te-theme-group-arrow" size={16} />
                            </button>

                            {isExpanded && (
                                <div className="te-theme-group-body">
                                    <p className="te-theme-group-desc">{group.description}</p>
                                    <SchemaFormRenderer
                                        schema={group.fields}
                                        values={themeSettings}
                                        onChange={onSettingChange}
                                    />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </aside>
    )
}
