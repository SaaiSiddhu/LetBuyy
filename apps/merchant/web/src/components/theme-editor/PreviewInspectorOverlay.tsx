'use client'

import { MousePointer2 } from 'lucide-react'


/**
 * PreviewInspectorOverlay — Phase S live preview inspector
 *
 * A pointer-enhancement overlay rendered inside the preview browser chrome.
 * It shows a small label chip identifying the section the editor currently
 * considers hovered. This is purely visual — it contains NO postMessage logic
 * and does NOT participate in the bridge protocol; CenterPanel owns messaging.
 *
 * Keyboard accessibility is not the concern of this overlay: the section tree
 * already provides full keyboard selection. This overlay is a non-interactive
 * annotation that disappears when the pointer leaves the preview.
 */



interface HoveredSection {
    sectionId: string
    sectionType: string
}

interface PreviewInspectorOverlayProps {
    /** The section currently hovered in the preview, or null when no hover is active. */
    hoveredSection: HoveredSection | null
}

/**
 * Formats a section type key into a readable label.
 * e.g. "hero_banner" → "Hero Banner", "richtext" → "Richtext"
 */
function formatSectionLabel(sectionType: string): string {
    return sectionType
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function PreviewInspectorOverlay({ hoveredSection }: PreviewInspectorOverlayProps) {
    if (!hoveredSection) return null

    return (
        <div
            className="te-inspector-overlay"
            aria-hidden="true"
            // Non-interactive: pointer-events:none is enforced in CSS so the chip
            // never interferes with clicks on the iframe below.
        >
            <span className="te-inspector-hover-chip">
                <MousePointer2 size={12} aria-hidden="true" />
                <span className="te-inspector-hover-chip__label">
                    {formatSectionLabel(hoveredSection.sectionType)}
                </span>
            </span>
        </div>
    )
}
