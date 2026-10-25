'use client'

/**
 * CheckboxControl.tsx — Phase U: Native checkbox distinct from Toggle
 *
 * Renders a native input[type=checkbox] for boolean fields.
 * This is intentionally separate from ToggleInput (the slide-switch control).
 *
 * A11y: uses a <label> wrapping both the checkbox and the label text, ensuring
 * the entire row is keyboard-accessible and screen-reader-labelled.
 *
 * RISK-DUAL-N01: receives value + onChange; never mutates the schema object.
 */

import { CircleAlert } from 'lucide-react'
import { useId } from 'react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'
import { validateFieldValue } from '@/lib/theme-schemas'
import { Input } from '@letbuyy/ui'
import styles from './controls.module.css'

interface CheckboxControlProps {
    field: ExtendedSchemaField
    value: boolean
    onChange: (v: boolean) => void
}

export function CheckboxControl({ field, value, onChange }: CheckboxControlProps) {
    const id = useId()
    const error = validateFieldValue(field, value)
    const helpText = field.info || field.description

    return (
        <div className="te-field te-field--toggle">
            <label htmlFor={id} className="te-field-label" style={{ flex: 1 }}>
                {field.label}
                {field.required ? (
                    <span aria-label="required" style={{ color: 'var(--error, rgb(239 68 68))', marginLeft: 2 }}>*</span>
                ) : null}
            </label>
            <div className={styles.checkboxWrapper}>
                <Input
                    unstyled
                    id={id}
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    aria-required={field.required ? 'true' : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? `${id}-error` : helpText ? `${id}-help` : undefined}
                />
            </div>
            {error ? (
                <p id={`${id}-error`} className={styles.fieldError} role="alert">
                    <CircleAlert size={12} aria-hidden />
                    {' '}{error}
                </p>
            ) : null}
            {helpText && !error ? (
                <span id={`${id}-help`} className="generic-theme-editor__field-help">{helpText}</span>
            ) : null}
        </div>
    )
}
