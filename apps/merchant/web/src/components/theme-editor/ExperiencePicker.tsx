'use client'

// Phase-2.5 Stream A — Experience Picker. Lists the merchant-facing presets and applies one to the
// draft. Merchants see preset names only — no internal theme/engine jargon surfaces here.
// Self-styled with const style objects routed through --lb-color-* tokens (no hex literals, no
// `style={{` inline-style counter hits except the data-driven swatch color), so it stays inside
// the design-system ratchet.
//
// S4-FIX/Defect 2 — this component no longer reads the Experience registry directly. The preset
// list is a prop, resolved by the editor page from the loaded theme's settings_data.presets (the
// single source of which presets a theme has) via resolveExperiencePresetItems(); the registry
// backs display copy only. See ExperiencePresetItem's doc comment in theme-presets.ts.

import type { CSSProperties } from 'react'
import { Button } from '@letbuyy/ui'
import type { ExperiencePresetItem } from '@letbuyy/theme-engine'

interface ExperiencePickerProps {
    presets: ExperiencePresetItem[]
    activeExperienceId?: string
    onApply: (presetId: string) => void
}

const s: Record<string, CSSProperties> = {
    panel: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' },
    intro: { fontSize: '12px', lineHeight: 1.5, color: 'var(--lb-color-text-subdued)', margin: 0 },
    card: {
        display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px',
        borderRadius: '12px', border: '1px solid var(--lb-color-border)', background: 'var(--lb-color-surface)',
    },
    cardActive: {
        display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px',
        borderRadius: '12px', border: '1px solid var(--lb-color-primary)', background: 'var(--lb-color-surface)',
        boxShadow: '0 0 0 1px var(--lb-color-primary)',
    },
    head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
    name: { fontWeight: 600, fontSize: '14px', color: 'var(--lb-color-text)' },
    badge: {
        fontSize: '10px', fontWeight: 600, textTransform: 'capitalize', padding: '2px 8px',
        borderRadius: '999px', color: 'var(--lb-color-text-subdued)', background: 'var(--lb-color-surface-subdued)',
    },
    swatches: { display: 'flex', gap: '4px' },
    swatch: { width: '22px', height: '22px', borderRadius: '6px', border: '1px solid var(--lb-color-border)' },
    desc: { fontSize: '12px', lineHeight: 1.5, color: 'var(--lb-color-text-subdued)', margin: 0 },
    meta: { display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--lb-color-text-subdued)' },
    apply: {
        marginTop: '4px', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
        cursor: 'pointer', color: 'var(--lb-color-on-primary, rgb(255 255 255))', background: 'var(--lb-color-primary)',
        border: '1px solid var(--lb-color-primary)',
    },
    applyActive: {
        marginTop: '4px', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
        cursor: 'default', color: 'var(--lb-color-primary)', background: 'var(--lb-color-surface-subdued)',
        border: '1px solid var(--lb-color-border)',
    },
    empty: {
        display: 'flex', flexDirection: 'column', gap: '4px', padding: '16px 12px',
        borderRadius: '12px', border: '1px dashed var(--lb-color-border)', textAlign: 'center',
    },
    emptyTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--lb-color-text)', margin: 0 },
    emptyDesc: { fontSize: '12px', lineHeight: 1.5, color: 'var(--lb-color-text-subdued)', margin: 0 },
}

export default function ExperiencePicker({ presets, activeExperienceId, onApply }: ExperiencePickerProps) {
    if (presets.length === 0) {
        return (
            <div className="te-experience-picker" style={s.panel} role="list" aria-label="Experiences">
                <p style={s.intro}>
                    Apply a color and typography style to your draft. Page content and layout stay in place.
                </p>
                <div style={s.empty} role="status">
                    <p style={s.emptyTitle}>No Experiences on this theme yet</p>
                    <p style={s.emptyDesc}>This theme&apos;s bundle does not define any presets. Adjust colors and fonts directly from the Theme settings panel.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="te-experience-picker" style={s.panel} role="list" aria-label="Experiences">
            <p style={s.intro}>
                Apply a color and typography style to your draft. Page content and layout stay in place.
            </p>
            {presets.map((preset) => {
                const isActive = preset.id === activeExperienceId
                return (
                    <div key={preset.id} role="listitem" style={isActive ? s.cardActive : s.card}>
                        <div style={s.head}>
                            <span style={s.name}>{preset.name}</span>
                            <span style={s.badge}>{preset.industry ?? 'versatile'}</span>
                        </div>
                        <div style={s.swatches} aria-hidden="true">
                            {preset.swatches.map((color, i) => (
                                <span key={i} style={{ ...s.swatch, background: color }} />
                            ))}
                        </div>
                        <p style={s.desc}>{preset.description}</p>
                        <div style={s.meta}>
                            {preset.headingFont ? <span>{preset.headingFont}</span> : null}
                        </div>
                        <Button
                            unstyled
                            type="button"
                            style={isActive ? s.applyActive : s.apply}
                            onClick={() => onApply(preset.id)}
                            aria-pressed={isActive}
                            disabled={isActive}
                        >
                            {isActive ? 'Applied style' : `Apply ${preset.name} style`}
                        </Button>
                    </div>
                )
            })}
        </div>
    )
}
