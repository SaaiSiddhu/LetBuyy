'use client'

/**
 * FontPickerControl.tsx — Phase U: Font family picker
 *
 * Renders a <select> constrained to the 6 known families in EXPERIENCE_FONT_REGISTRY.
 * Prevents arbitrary font injection: only values present in the registry are accepted.
 *
 * RISK-5 (Phase U): onChange only emits values from EXPERIENCE_FONT_REGISTRY.
 * An unknown stored value falls back to the first registered family on select.
 *
 * RISK-DUAL-N01: receives value + onChange; never mutates the schema object.
 */

import { useId } from 'react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'
import { validateFieldValue } from '@/lib/theme-schemas'
import { MaterialIcon } from '@letbuyy/ui'
import { EXPERIENCE_FONT_REGISTRY } from '@letbuyy/theme-engine'
import styles from './controls.module.css'

interface FontPickerControlProps {
    field: ExtendedSchemaField
    value: string
    onChange: (v: string) => void
}

const FONT_FAMILIES = Object.keys(EXPERIENCE_FONT_REGISTRY)

export function FontPickerControl({ field, value, onChange }: FontPickerControlProps) {
    const id = useId()
    // Resolve display value: if stored value is unknown, show first family
    const displayValue = FONT_FAMILIES.includes(value) ? value : (FONT_FAMILIES[0] ?? '')
    const error = validateFieldValue(field, value)
    const helpText = field.info || field.description
    const previewFont = FONT_FAMILIES.includes(value) ? value : undefined

    const handleChange = (newFamily: string) => {
        // Guard: only emit known font families (RISK-5)
        if (FONT_FAMILIES.includes(newFamily)) {
            onChange(newFamily)
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

            <select
                id={id}
                className="te-field-select"
                value={displayValue}
                onChange={(e) => handleChange(e.target.value)}
                aria-required={field.required ? 'true' : undefined}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? `${id}-error` : helpText ? `${id}-help` : undefined}
            >
                {FONT_FAMILIES.map((family) => (
                    <option key={family} value={family}>
                        {family}
                    </option>
                ))}
            </select>

            {/* Font preview — shows the selected family as a live preview */}
            {previewFont ? (
                <div
                    className={styles.fontPreview}
                    style={{ fontFamily: `"${previewFont}", system-ui, sans-serif` }}
                    aria-label={`Preview of ${previewFont}`}
                >
                    {previewFont} — The quick brown fox
                </div>
            ) : null}

            {error ? (
                <p id={`${id}-error`} className={styles.fieldError} role="alert">
                    <MaterialIcon name="error" size={12} aria-hidden />
                    {' '}{error}
                </p>
            ) : null}
            {helpText && !error ? (
                <span id={`${id}-help`} className="generic-theme-editor__field-help">{helpText}</span>
            ) : null}
        </div>
    )
}
