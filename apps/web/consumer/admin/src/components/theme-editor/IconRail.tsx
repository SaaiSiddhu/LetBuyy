'use client'

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
                <span className="material-symbols-outlined">view_agenda</span>
                <span className="te-icon-rail-label">Sections</span>
            </button>

            <button
                className={`te-icon-rail-btn ${activePanel === 'themeSettings' ? 'te-icon-rail-btn--active' : ''}`}
                onClick={() => onPanelChange('themeSettings')}
                title="Theme settings"
            >
                <span className="material-symbols-outlined">palette</span>
                <span className="te-icon-rail-label">Theme</span>
            </button>

            <div className="te-icon-rail-divider" />

            <button
                className="te-icon-rail-btn"
                onClick={viewportCycle}
                title={`Switch viewport (${viewport})`}
            >
                <span className="material-symbols-outlined">{viewportIcon}</span>
                <span className="te-icon-rail-label">{viewport.charAt(0).toUpperCase() + viewport.slice(1)}</span>
            </button>
        </nav>
    )
}
