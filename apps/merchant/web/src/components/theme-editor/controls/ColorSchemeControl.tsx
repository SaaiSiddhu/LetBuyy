'use client'

/**
 * ColorSchemeControl.tsx — Phase U: Named experience color scheme selector
 *
 * Renders a <select> that lets the merchant pick a named colour scheme.
 * Scheme options are taken from `field.options` when provided; otherwise
 * a default set of standard scheme names is used.
 *
 * RISK-DUAL-N01: receives value + onChange; never mutates the schema object.
 */

import { useId } from 'react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'
import { validateFieldValue } from '@/lib/theme-schemas'
import { MaterialIcon } from '@letbuyy/ui'
import styles from './controls.module.css'

// Default scheme names (used when field.options is absent).
// These mirror the standard LetBuyy experience color scheme names.
const DEFAULT_COLOR_SCHEMES = ['default', 'primary', 'accent', 'soft', 'dark', 'light']

interface ColorSchemeControlProps {
    field: ExtendedSchemaField
    value: string
    onChange: (v: string) => void
}

function schemeLabel(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ')
}

export function ColorSchemeControl({ field, value, onChange }: ColorSchemeControlProps) {
    const id = useId()
    const options = field.options && field.options.length > 0 ? field.options : DEFAULT_COLOR_SCHEMES
    const error = validateFieldValue(field, value)
    const helpText = field.info || field.description

    return (
        <div className="te-field">
            <label htmlFor={id} className="te-field-label">
                {field.label}
                {field.required ? (
                    <span aria-label="required" style={{ color: 'var(--error, rgb(239 68 68))', marginLeft: 2 }}>*</span>
                ) : null}
            </label>

            <div className={styles.colorSchemeWrapper}>
                <select
                    id={id}
                    className="te-field-select"
                    value={value || options[0]}
                    onChange={(e) => onChange(e.target.value)}
                    aria-required={field.required ? 'true' : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? `${id}-error` : helpText ? `${id}-help` : undefined}
                >
                    {options.map((opt) => (
                        <option key={opt} value={opt}>
                            {schemeLabel(opt)}
                        </option>
                    ))}
                </select>
            </div>

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
