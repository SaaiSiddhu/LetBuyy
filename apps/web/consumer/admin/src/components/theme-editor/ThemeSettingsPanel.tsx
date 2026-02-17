'use client'

import { useState } from 'react'
import SchemaFormRenderer from './SchemaFormRenderer'
import { THEME_SETTINGS_SCHEMA } from '@/lib/theme-schemas'

interface ThemeSettingsPanelProps {
    themeSettings: Record<string, unknown>
    onSettingChange: (key: string, value: unknown) => void
}

export default function ThemeSettingsPanel({ themeSettings, onSettingChange }: ThemeSettingsPanelProps) {
    const [expandedGroup, setExpandedGroup] = useState<string | null>('colors')

    const groups = THEME_SETTINGS_SCHEMA.settings

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
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                    {groupKey === 'colors' ? 'palette' : groupKey === 'typography' ? 'text_fields' : groupKey === 'layout' ? 'dashboard' : groupKey === 'header' ? 'web_asset' : 'view_stream'}
                                </span>
                                <span className="te-theme-group-label">{group.label}</span>
                                <span className="material-symbols-outlined te-theme-group-arrow" style={{ fontSize: '16px' }}>
                                    {isExpanded ? 'expand_less' : 'expand_more'}
                                </span>
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
