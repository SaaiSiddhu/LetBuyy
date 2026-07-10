'use client'

/**
 * LiquidControl.tsx — Phase U: Liquid code textarea
 *
 * Renders a plain <textarea> for Liquid template fields.
 *
 * IMPORTANT flags:
 *  - CANARY-OFF: Liquid rendering is currently disabled by default
 *    (THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false). The NOT-CONNECTED badge
 *    informs the merchant that live preview is not active.
 *  - SANITIZE LAW (RISK-4): This control does NOT inject the raw Liquid value
 *    into the DOM. The value is stored as a plain string in the textarea.
 *    Liquid → HTML compilation and DOMPurify sanitisation are the renderer's
 *    responsibility (theme-renderer.ts).
 *
 * RISK-DUAL-N01: receives value + onChange; never mutates the schema object.
 */

import { useId } from 'react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'
import { validateFieldValue } from '@/lib/theme-schemas'
import { MaterialIcon } from '@letbuyy/ui'
import styles from './controls.module.css'

interface LiquidControlProps {
    field: ExtendedSchemaField
    value: string
    onChange: (v: string) => void
}

export function LiquidControl({ field, value, onChange }: LiquidControlProps) {
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
              * IMPORTANT: This is a plain <textarea>. The raw Liquid template is
              * NOT injected into the DOM here. Liquid → HTML compilation and
              * DOMPurify sanitisation run in the storefront renderer only.
              */}
            <textarea
                id={id}
                className="te-field-textarea"
                value={value}
                maxLength={field.maxLength}
                rows={6}
                onChange={(e) => onChange(e.target.value)}
                placeholder="{% if product.available %}…{% endif %}"
                aria-required={field.required ? 'true' : undefined}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={[
                    error ? `${id}-error` : null,
                    `${id}-canary-note`,
                    helpText ? `${id}-help` : null,
                ].filter(Boolean).join(' ') || undefined}
                spellCheck={false}
                // Monospace hint for code editing
                style={{ fontFamily: '"Fira Code", "Consolas", monospace', fontSize: 12 }}
            />

            {/* NOT-CONNECTED badge — Liquid rendering is canary-OFF */}
            <span
                id={`${id}-canary-note`}
                className={styles.notConnectedBadge}
                aria-label="Liquid rendering is not active — feature flag is off"
            >
                <MaterialIcon name="warning" size={12} aria-hidden />
                NOT-CONNECTED — Liquid rendering disabled (canary flag off)
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
