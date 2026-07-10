'use client'

/**
 * ResourcePickerControl.tsx — Phase U: Resource picker (id entry + NOT-CONNECTED badge)
 *
 * Used for field types: product, collection, blog, page, menu.
 *
 * Phase U behaviour:
 *  - Renders a plain text input for the resource ID (e.g. a product handle or UUID).
 *  - Displays a NOT-CONNECTED badge indicating live search is deferred to Phase W.
 *  - Phase W will replace this with a live searchable picker backed by dynamic sources.
 *
 * NOT-CONNECTED contract:
 *  - Live search is NOT available. No API call is made here.
 *  - The badge text must read "NOT-CONNECTED — live search available in Phase W".
 *
 * RISK-DUAL-N01: receives value + onChange; never mutates the schema object.
 */

import { useId } from 'react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'
import { validateFieldValue } from '@/lib/theme-schemas'
import { Input, MaterialIcon } from '@letbuyy/ui'
import styles from './controls.module.css'

// Resource type display labels
const RESOURCE_LABELS: Record<string, string> = {
    product: 'Product',
    collection: 'Collection',
    blog: 'Blog',
    page: 'Page',
    menu: 'Navigation menu',
}

interface ResourcePickerControlProps {
    field: ExtendedSchemaField
    /** The stored resource identifier (handle, ID, or slug). */
    value: string
    onChange: (v: string) => void
}

export function ResourcePickerControl({ field, value, onChange }: ResourcePickerControlProps) {
    const id = useId()
    const error = validateFieldValue(field, value)
    const helpText = field.info || field.description
    const resourceLabel = RESOURCE_LABELS[field.type] ?? field.type

    return (
        <div className="te-field">
            <label htmlFor={id} className="te-field-label">
                {field.label}
                {field.required ? (
                    <span aria-label="required" style={{ color: 'var(--error, rgb(239 68 68))', marginLeft: 2 }}>*</span>
                ) : null}
            </label>

            <div className={styles.resourcePickerWrapper}>
                <span className={styles.resourceTypeHint}>
                    <MaterialIcon name="category" size={11} aria-hidden />
                    {' '}{resourceLabel} ID or handle
                </span>

                <Input
                    unstyled
                    id={id}
                    type="text"
                    className="te-field-input"
                    value={value}
                    placeholder={`Enter ${resourceLabel.toLowerCase()} ID or handle…`}
                    onChange={(e) => onChange(e.target.value)}
                    aria-required={field.required ? 'true' : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={[
                        error ? `${id}-error` : null,
                        `${id}-not-connected`,
                        helpText ? `${id}-help` : null,
                    ].filter(Boolean).join(' ') || undefined}
                />

                {/* NOT-CONNECTED badge — live search deferred to Phase W */}
                <span
                    id={`${id}-not-connected`}
                    className={styles.notConnectedBadge}
                    aria-label="Live search not available — enter ID manually"
                >
                    <MaterialIcon name="cloud_off" size={12} aria-hidden />
                    NOT-CONNECTED — live search available in Phase W
                </span>
            </div>

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
