'use client'

/**
 * HtmlControl.tsx — Phase U: Sanitised HTML textarea
 *
 * Renders a plain <textarea> for HTML content fields.
 *
 * SANITIZE LAW (RISK-4):
 *  - This control is a TEXTAREA ONLY. It does NOT inject raw HTML into the DOM.
 *    No unsafe DOM injection path (innerHTML/outerHTML/srcdoc/etc.) is used here.
 *  - Sanitisation of the stored HTML value is the renderer's responsibility
 *    (LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG in theme-renderer.ts).
 *  - A visible disclaimer is shown to the merchant confirming this.
 *
 * RISK-DUAL-N01: receives value + onChange; never mutates the schema object.
 */

import { useId } from 'react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'
import { validateFieldValue } from '@/lib/theme-schemas'
import { MaterialIcon } from '@letbuyy/ui'
import styles from './controls.module.css'

interface HtmlControlProps {
    field: ExtendedSchemaField
    value: string
    onChange: (v: string) => void
}

export function HtmlControl({ field, value, onChange }: HtmlControlProps) {
    const id = useId()
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

            {/*
              * IMPORTANT: This is a plain <textarea>. The raw HTML value is
              * NOT injected into the DOM here. Sanitisation runs in the
              * storefront renderer (DOMPurify FORBID config).
              */}
            <textarea
                id={id}
                className="te-field-textarea"
                value={value}
                maxLength={field.maxLength}
                rows={5}
                onChange={(e) => onChange(e.target.value)}
                placeholder="<p>Enter HTML content…</p>"
                aria-required={field.required ? 'true' : undefined}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={[
                    error ? `${id}-error` : null,
                    `${id}-sanitize-note`,
                    helpText ? `${id}-help` : null,
                ].filter(Boolean).join(' ') || undefined}
                spellCheck={false}
            />

            {/* Sanitize disclaimer — always visible for HTML fields */}
            <span id={`${id}-sanitize-note`} className={styles.disclaimerNote}>
                <MaterialIcon name="shield" size={11} aria-hidden />
                {' '}
                Output is sanitised at render time. Scripts and unsafe attributes are removed.
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
