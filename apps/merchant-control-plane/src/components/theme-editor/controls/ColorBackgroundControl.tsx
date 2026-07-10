'use client'

/**
 * ColorBackgroundControl.tsx — Phase U: Solid color OR CSS gradient string
 *
 * Supports both:
 *  - Solid colour: renders a colour picker + hex input (same as ColorInput)
 *  - CSS gradient: renders a text input for the gradient string
 *
 * The merchant toggles between "solid" and "gradient" mode via a toggle.
 * In gradient mode, they enter a CSS linear-gradient() string directly.
 *
 * SANITIZE LAW: the VALUE stored here is a plain CSS string. It is NOT rendered
 * via dangerouslySetInnerHTML in the editor. The renderer applies it as a style
 * property at render time (not in this component).
 *
 * RISK-DUAL-N01: receives value + onChange; never mutates the schema object.
 */

import { useState, useId } from 'react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'
import { validateFieldValue } from '@/lib/theme-schemas'
import { Input, MaterialIcon } from '@letbuyy/ui'
import styles from './controls.module.css'

interface ColorBackgroundControlProps {
    field: ExtendedSchemaField
    value: string
    onChange: (v: string) => void
}

function looksLikeGradient(v: string): boolean {
    const t = v.trim().toLowerCase()
    return t.startsWith('linear-gradient') || t.startsWith('radial-gradient') || t.startsWith('conic-gradient')
}

export function ColorBackgroundControl({ field, value, onChange }: ColorBackgroundControlProps) {
    const id = useId()
    const [gradientMode, setGradientMode] = useState(() => looksLikeGradient(value))
    const error = validateFieldValue(field, value)
    const helpText = field.info || field.description

    const handleModeToggle = () => {
        const next = !gradientMode
        setGradientMode(next)
        if (!next && looksLikeGradient(value)) {
            // switching back to solid colour — reset to white
            onChange('#ffffff')
        }
    }

    return (
        <div className="te-field">
            <label htmlFor={id} className="te-field-label">
                {field.label}
                {field.required ? (
                    <span aria-label="required" style={{ color: 'var(--error, rgb(239 68 68))', marginLeft: 2 }}>*</span>
                ) : null}
            </label>

            <div className={styles.colorBgWrapper}>
                {/* Mode toggle */}
                <div className={styles.gradientToggleRow}>
                    <input
                        type="checkbox"
                        id={`${id}-gradient-mode`}
                        checked={gradientMode}
                        onChange={handleModeToggle}
                        className={styles.checkboxInput}
                        aria-label="Use gradient"
                    />
                    <label htmlFor={`${id}-gradient-mode`} style={{ cursor: 'pointer' }}>
                        Gradient
                    </label>
                </div>

                {gradientMode ? (
                    /* Gradient mode: plain CSS string entry */
                    <Input
                        unstyled
                        id={id}
                        type="text"
                        className="te-field-input"
                        value={value}
                        placeholder="linear-gradient(135deg, #ff6b6b, #845ef7)"
                        onChange={(e) => onChange(e.target.value)}
                        aria-invalid={error ? 'true' : undefined}
                        aria-describedby={error ? `${id}-error` : undefined}
                    />
                ) : (
                    /* Solid colour mode: colour picker + hex */
                    <div className="te-field-color-wrapper">
                        <Input
                            unstyled
                            type="color"
                            className="te-field-color"
                            value={value.startsWith('#') ? value : '#ffffff'}
                            onChange={(e) => onChange(e.target.value)}
                            aria-label={`${field.label} colour picker`}
                        />
                        <Input
                            unstyled
                            id={id}
                            type="text"
                            className="te-field-input te-field-color-text"
                            value={value}
                            maxLength={9}
                            onChange={(e) => onChange(e.target.value)}
                            aria-invalid={error ? 'true' : undefined}
                            aria-describedby={error ? `${id}-error` : undefined}
                        />
                    </div>
                )}
            </div>

            {error ? (
                <p id={`${id}-error`} className={styles.fieldError} role="alert">
                    <MaterialIcon name="error" size={12} aria-hidden />
                    {' '}{error}
                </p>
            ) : null}
            {helpText && !error ? (
                <span className="generic-theme-editor__field-help">{helpText}</span>
            ) : null}
        </div>
    )
}
