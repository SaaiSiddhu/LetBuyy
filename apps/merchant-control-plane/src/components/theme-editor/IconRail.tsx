'use client'

import { MaterialIcon } from '@letbuyy/ui'

interface IconRailProps {
    activePanel: 'sections' | 'themeSettings'
    viewport: 'desktop' | 'tablet' | 'mobile'
    onPanelChange: (panel: 'sections' | 'themeSettings') => void
    onViewportChange: (viewport: 'desktop' | 'tablet' | 'mobile') => void
}

export default function IconRail({ activePanel, viewport, onPanelChange, onViewportChange }: IconRailProps) {
    const viewportCycle = () => {
        const order: ('desktop' | 'tablet' | 'mobile')[] = ['desktop', 'tablet', 'mobile']
        const idx = order.indexOf(viewport)
        onViewportChange(order[(idx + 1) % 3])
    }

    const viewportIcon = viewport === 'desktop' ? 'desktop_windows' : viewport === 'tablet' ? 'tablet_mac' : 'phone_iphone'

    return (
        <nav className="te-icon-rail">
            <button
                className={`te-icon-rail-btn ${activePanel === 'sections' ? 'te-icon-rail-btn--active' : ''}`}
                onClick={() => onPanelChange('sections')}
                title="Sections"
            >
                <MaterialIcon name="view_agenda" />
                <span className="te-icon-rail-label">Sections</span>
            </button>

            <button
                className={`te-icon-rail-btn ${activePanel === 'themeSettings' ? 'te-icon-rail-btn--active' : ''}`}
                onClick={() => onPanelChange('themeSettings')}
                title="Theme settings"
            >
                <MaterialIcon name="palette" />
                <span className="te-icon-rail-label">Theme</span>
            </button>

            <div className="te-icon-rail-divider" />

            <button
                className="te-icon-rail-btn"
                onClick={viewportCycle}
                title={`Switch viewport (${viewport})`}
            >
                <MaterialIcon name={viewportIcon} />
                <span className="te-icon-rail-label">{viewport.charAt(0).toUpperCase() + viewport.slice(1)}</span>
            </button>
        </nav>
    )
}
