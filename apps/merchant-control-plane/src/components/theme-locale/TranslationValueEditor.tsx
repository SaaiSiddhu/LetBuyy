'use client'

/**
 * TranslationValueEditor — Phase Z inline key/value editor for theme translations.
 *
 * Writes to /api/stores/:store/localization/translations via:
 *   POST  (new key — when entry.id is undefined)
 *   PATCH (existing key — when entry.id is set)
 *
 * The write payload always sets resource_type: 'theme' — it NEVER touches
 * section_definitions, LiquidThemeSectionSchema, or any bundle schema field.
 *
 * RISK-DUAL-N01 (hard rule): this editor writes to the storefront_translations
 * table (instance locale data) only. Locale definitions are read-only schema;
 * this component does not know they exist.
 *
 * India-first: en-IN is the default locale. The source_text field shown here
 * is the en-IN fallback so the merchant can see what they're translating.
 *
 * A11y: textarea has associated label; save/cancel buttons have aria-label;
 * Escape key closes the editor. Error state uses role="alert".
 *
 * Design: @letbuyy/ui Button + Textarea + --lb-* tokens; mobile-first; no raw rounded-[Npx].
 */

import { useState, useEffect, useCallback, type KeyboardEvent } from 'react'
import { Button, Textarea, useToast } from '@letbuyy/ui'
import type { TranslationEntry } from './TranslationKeyList'
import styles from './theme-locale.module.css'

export interface TranslationValueEditorProps {
    /** The entry being edited. null means no active edit (editor is hidden). */
    entry: TranslationEntry | null
    /** The URL-segment store name (used to build the proxy URL). */
    storeName: string
    /** Called after a successful save with the updated entry. */
    onSaved: (updated: TranslationEntry & { id: string }) => void
    /** Called when the user cancels or closes the editor. */
    onCancel: () => void
}

export default function TranslationValueEditor({
    entry,
    storeName,
    onSaved,
    onCancel,
}: TranslationValueEditorProps) {
    const [value, setValue] = useState('')
    const [saving, setSaving] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    const toast = useToast()

    // Sync internal value when a new entry is selected.
    useEffect(() => {
        if (entry) {
            setValue(entry.translated_text)
            setValidationError(null)
        }
    }, [entry])

    // Auto-focus the textarea when the editor opens (autoFocus is used in JSX below).

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
            }
        },
        [onCancel],
    )

    const handleSave = useCallback(async () => {
        if (!entry) return

        // Validate: translated_text must be non-empty.
        const trimmed = value.trim()
        if (!trimmed) {
            setValidationError('Translation value cannot be empty.')
            return
        }
        setValidationError(null)
        setSaving(true)

        try {
            const isNew = !entry.id

            // RISK-DUAL-N01: resource_type is always 'theme' — never section_definitions.
            const payload = isNew
                ? {
                    locale: entry.locale,
                    resource_type: 'theme' as const,
                    resource_id: entry.resource_id,
                    field: entry.key,
                    source_text: entry.source_text ?? undefined,
                    translated_text: trimmed,
                    status: 'draft' as const,
                }
                : { translated_text: trimmed }

            const url = isNew
                ? `/api/stores/${encodeURIComponent(storeName)}/localization/translations`
                : `/api/stores/${encodeURIComponent(storeName)}/localization/translations/${entry.id}`

            const res = await fetch(url, {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as { error?: { message?: string }; message?: string }
                const message =
                    body?.error?.message ||
                    body?.message ||
                    `Failed to save translation (${res.status})`
                throw new Error(message)
            }

            const { data } = await res.json() as { data: { id: string; status: string } }
            toast.notify({ title: 'Translation saved', variant: 'success' })
            onSaved({
                key: entry.key,
                locale: entry.locale,
                source_text: entry.source_text,
                translated_text: trimmed,
                id: data.id,
                status: data.status,
                resource_type: 'theme',
                resource_id: entry.resource_id,
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to save translation'
            toast.notify({ title: message, variant: 'critical' })
        } finally {
            setSaving(false)
        }
    }, [entry, value, storeName, toast, onSaved])

    // Editor is hidden when there is no active entry.
    if (!entry) return null

    return (
        <div
            className={styles.translationValueEditorRoot}
            role="dialog"
            aria-label={`Edit translation for ${entry.key}`}
            aria-modal="false"
        >
            <p className={styles.translationValueEditorHeader}>
                Editing key:{' '}
                <code className={styles.translationValueEditorKey}>{entry.key}</code>{' '}
                ({entry.locale})
            </p>

            {entry.source_text && (
                <p
                    style={{
                        fontSize: 'var(--lb-font-size-caption, 12px)',
                        color: 'var(--lb-color-text-subdued)',
                        marginBottom: 'var(--lb-space-2, 8px)',
                    }}
                >
                    Original ({entry.locale === 'en-IN' ? 'source' : 'en-IN'}):{' '}
                    <em>{entry.source_text}</em>
                </p>
            )}

            <Textarea
                id="translation-value-input"
                label={`Translation for ${entry.key} in ${entry.locale}`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                disabled={saving}
                error={validationError ?? undefined}
                aria-required="true"
                aria-describedby={validationError ? 'translation-validation-error' : undefined}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
            />

            {validationError && (
                <p
                    id="translation-validation-error"
                    className={styles.translationValueEditorError}
                    role="alert"
                >
                    {validationError}
                </p>
            )}

            <div className={styles.translationValueEditorActions}>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    aria-label={`Save translation for ${entry.key}`}
                >
                    {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    disabled={saving}
                    aria-label="Cancel editing translation"
                >
                    Cancel
                </Button>
            </div>
        </div>
    )
}
