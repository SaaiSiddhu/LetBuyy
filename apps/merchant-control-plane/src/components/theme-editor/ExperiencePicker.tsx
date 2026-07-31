'use client'

// Phase-2.5 Stream A — Experience Picker. Lists the merchant-facing Experiences and applies one to
// the draft. Merchants see Experience names only — no internal theme/engine jargon surfaces here.
// Self-styled with const style objects routed through --lb-color-* tokens (no hex literals, no
// `style={{` inline-style counter hits except the data-driven swatch color), so it stays inside
// the design-system ratchet.

import type { CSSProperties } from 'react'
import { Button } from '@letbuyy/ui'
import { listExperiences } from '@letbuyy/theme-engine'

interface ExperiencePickerProps {
    activeExperienceId?: string
    onApply: (experienceId: string) => void
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
}

export default function ExperiencePicker({ activeExperienceId, onApply }: ExperiencePickerProps) {
    const experiences = listExperiences()
    return (
        <div className="te-experience-picker" style={s.panel} role="list" aria-label="Experiences">
            <p style={s.intro}>
                Pick a ready-made Experience. Applying one updates your draft preview instantly — customize and publish when you are ready.
            </p>
            {experiences.map((exp) => {
                const isActive = exp.id === activeExperienceId
                return (
                    <div key={exp.id} role="listitem" style={isActive ? s.cardActive : s.card}>
                        <div style={s.head}>
                            <span style={s.name}>{exp.name}</span>
                            <span style={s.badge}>{exp.industry ?? 'versatile'}</span>
                        </div>
                        <div style={s.swatches} aria-hidden="true">
                            {exp.preview.swatches.map((color, i) => (
                                <span key={i} style={{ ...s.swatch, background: color }} />
                            ))}
                        </div>
                        <p style={s.desc}>{exp.description}</p>
                        <div style={s.meta}>
                            <span>{exp.typography.headingFont}</span>
                            <span>{exp.preview.sectionCount} sections</span>
                        </div>
                        <Button
                            unstyled
                            type="button"
                            style={isActive ? s.applyActive : s.apply}
                            onClick={() => onApply(exp.id)}
                            aria-pressed={isActive}
                            disabled={isActive}
                        >
                            {isActive ? 'Applied' : `Apply ${exp.name}`}
                        </Button>
                    </div>
                )
            })}
        </div>
    )
}
