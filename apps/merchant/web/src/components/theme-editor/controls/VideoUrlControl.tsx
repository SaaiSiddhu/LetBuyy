'use client'

/**
 * VideoUrlControl.tsx — Phase U: YouTube / Vimeo URL input
 *
 * Renders a URL text input validated against YouTube and Vimeo patterns.
 *
 * Validation:
 *  - Empty string is always accepted (optional field unless required=true).
 *  - Non-empty strings must match YouTube/Vimeo URL patterns.
 *  - Unsafe protocols (javascript:, vbscript:, data:text/html, data:application/xhtml)
 *    are rejected immediately on change.
 *
 * RISK-DUAL-N01: receives value + onChange; never mutates the schema object.
 */

import { useId } from 'react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'
import { validateFieldValue, isUnsafeUrl } from '@/lib/theme-schemas'
import { Input, MaterialIcon } from '@letbuyy/ui'
import styles from './controls.module.css'

interface VideoUrlControlProps {
    field: ExtendedSchemaField
    value: string
    onChange: (v: string) => void
}

export function VideoUrlControl({ field, value, onChange }: VideoUrlControlProps) {
    const id = useId()
    const error = validateFieldValue(field, value)
    const helpText = field.info || field.description

    const handleChange = (raw: string) => {
        // Block unsafe protocols at input time
        if (raw.length > 0 && isUnsafeUrl(raw)) return
        onChange(raw)
    }

    return (
        <div className="te-field">
            <label htmlFor={id} className="te-field-label">
                {field.label}
                {field.required ? (
                    <span aria-label="required" style={{ color: 'var(--error, rgb(239 68 68))', marginLeft: 2 }}>*</span>
                ) : null}
            </label>

            <Input
                unstyled
                id={id}
                type="url"
                className="te-field-input"
                value={value}
                placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
                onChange={(e) => handleChange(e.target.value)}
                aria-required={field.required ? 'true' : undefined}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={[
                    error ? `${id}-error` : null,
                    `${id}-hint`,
                    helpText ? `${id}-help` : null,
                ].filter(Boolean).join(' ') || undefined}
            />

            <span id={`${id}-hint`} className={styles.disclaimerNote}>
                <MaterialIcon name="play_circle" size={11} aria-hidden />
                {' '}
                Accepts YouTube and Vimeo URLs only
            </span>

            {error ? (
                <p id={`${id}-error`} className={styles.fieldError} role="alert">
                    <MaterialIcon name="error" size={12} aria-hidden />
                    {' '}{error}
                </p>
            ) : null}
            {helpText ? (
                <span id={`${id}-help`} className="generic-theme-editor__field-help">{helpText}</span>
            ) : null}
        </div>
    )
}
