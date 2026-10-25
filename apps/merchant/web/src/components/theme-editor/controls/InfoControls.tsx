'use client'

/**
 * InfoControls.tsx — Phase U: Display-only sidebar controls
 *
 * FieldHeader  — section heading in the sidebar (no value, no onChange)
 * FieldParagraph — descriptive text block (no value, no onChange)
 *
 * These controls are display-only. They carry no field value and call no onChange.
 * RISK-DUAL-N01: no schema/definition mutation.
 */

import { Info } from 'lucide-react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'

import styles from './controls.module.css'

interface InfoHeaderProps {
    field: ExtendedSchemaField
}

/**
 * Renders a bold section-heading divider in the settings sidebar.
 * Used for schema fields with type='header'.
 */
export function FieldHeader({ field }: InfoHeaderProps) {
    return (
        <div
            className={styles.infoHeader}
            role="heading"
            aria-level={3}
        >
            {field.label}
        </div>
    )
}

interface InfoParagraphProps {
    field: ExtendedSchemaField
}

/**
 * Renders a descriptive paragraph in the settings sidebar.
 * Used for schema fields with type='paragraph'.
 */
export function FieldParagraph({ field }: InfoParagraphProps) {
    const text = field.info || field.description || field.label
    return (
        <p className={styles.infoParagraph}>
            <Info size={12} aria-hidden />
            {' '}
            {text}
        </p>
    )
}
