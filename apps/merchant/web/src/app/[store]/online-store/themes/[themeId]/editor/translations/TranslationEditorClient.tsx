'use client'

/**
 * TranslationEditorClient — Phase Z client-side orchestrator for theme translations.
 *
 * Orchestrates: LocaleSwitcher → TranslationKeyList → TranslationValueEditor.
 *
 * India-first (non-negotiable): en-IN is the default selected locale. The
 * translation list always compares against en-IN to find missing keys.
 * Switching to another locale is additive — the en-IN content is never
 * removed or replaced.
 *
 * RISK-DUAL-N01: all writes go to storefront_translations rows via the
 * /api/stores/:store/localization/translations proxy route. This client
 * never writes to section_definitions, LiquidThemeSectionSchema, or any
 * bundle schema field.
 *
 * Multi-currency DISPLAY NOTE: this editor handles text translation only.
 * Currency/price fields shown here are display strings from translation rows —
 * not the canonical INR ledger amounts. The canonical money ledger is untouched.
 *
 * A11y: all interactive elements have aria-label; error states use role="alert";
 * Escape key closes the inline editor. Mobile-first (~360px).
 *
 * Design: @letbuyy/ui + --lb-* tokens; no raw rounded-[Npx]; global stylesheet not imported.
 */

import { useState, useCallback } from 'react'
import { Spinner } from '@letbuyy/ui'
import type { StoreLocalizationSummary } from '@letbuyy/shared-types'
import LocaleSwitcher, { DEFAULT_ADMIN_LOCALE, type AdminLocaleCode } from '@/components/theme-locale/LocaleSwitcher'
import TranslationKeyList, { type TranslationEntry } from '@/components/theme-locale/TranslationKeyList'
import TranslationValueEditor from '@/components/theme-locale/TranslationValueEditor'
import styles from '@/components/theme-locale/theme-locale.module.css'

export interface TranslationEditorClientProps {
    /** Store handle/slug from the URL segment. */
    storeName: string
    /** The active theme ID (used to scope translations to resource_id = themeId). */
    themeId: string
    /**
     * Localization summary fetched server-side.
     * null = fetch failed (error state rendered).
     */
    localization: StoreLocalizationSummary | null
    /** Error message from the server-side fetch, if any. */
    fetchError?: string | null
}

export default function TranslationEditorClient({
    storeName,
    themeId,
    localization,
    fetchError = null,
}: TranslationEditorClientProps) {
    // India-first: always start on en-IN.
    const [selectedLocale, setSelectedLocale] = useState<AdminLocaleCode>(DEFAULT_ADMIN_LOCALE)
    const [activeEntry, setActiveEntry] = useState<TranslationEntry | null>(null)
    // Local copy of translations so saves are reflected immediately without a full page reload.
    const [translations, setTranslations] = useState(
        localization?.translations ?? [],
    )

    const handleLocaleChange = useCallback((locale: AdminLocaleCode) => {
        // Close any open editor when switching locales.
        setActiveEntry(null)
        setSelectedLocale(locale)
    }, [])

    const handleEdit = useCallback((entry: TranslationEntry) => {
        setActiveEntry(entry)
    }, [])

    const handleCancel = useCallback(() => {
        setActiveEntry(null)
    }, [])

    const handleSaved = useCallback(
        (updated: TranslationEntry & { id: string }) => {
            setActiveEntry(null)
            // Optimistically update the local translations list.
            // RISK-DUAL-N01: only touches the translations array (instance data),
            // never section_definitions.
            setTranslations((prev) => {
                const idx = prev.findIndex(
                    (t) =>
                        t.id === updated.id ||
                        (t.locale === updated.locale &&
                            t.resource_type === 'theme' &&
                            t.resource_id === updated.resource_id &&
                            t.field === updated.key),
                )
                const newRow = {
                    ...(prev[idx] ?? {}),
                    id: updated.id,
                    locale: updated.locale,
                    resource_type: 'theme' as const,
                    resource_id: updated.resource_id,
                    field: updated.key,
                    translated_text: updated.translated_text,
                    source_text: updated.source_text ?? null,
                    status: updated.status as 'draft' | 'published' | 'needs_review',
                }
                if (idx >= 0) {
                    const next = [...prev]
                    next[idx] = newRow as typeof prev[number]
                    return next
                }
                return [...prev, newRow as typeof prev[number]]
            })
        },
        [],
    )

    // Error state from server-side fetch.
    if (fetchError) {
        return (
            <div className={styles.translationEditorRoot}>
                <div className={styles.translationEditorPageError} role="alert">
                    {fetchError}
                </div>
            </div>
        )
    }

    // Loading state (data not yet hydrated).
    if (!localization) {
        return (
            <div className={styles.translationEditorRoot}>
                <div className={styles.translationEditorPageLoading} aria-busy="true">
                    <Spinner label="Loading translation editor" size="sm" />
                    <span>Loading translation editor…</span>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.translationEditorRoot} aria-label="Theme translation editor">
            <div className={styles.translationEditorHeader}>
                <h2 className={styles.translationEditorTitle}>Theme Translations</h2>
                <LocaleSwitcher
                    value={selectedLocale}
                    onChange={handleLocaleChange}
                />
            </div>

            <div className={styles.translationEditorBody}>
                {/* Inline editor for the active key — shown above the list when open. */}
                {activeEntry && (
                    <TranslationValueEditor
                        entry={activeEntry}
                        storeName={storeName}
                        onSaved={handleSaved}
                        onCancel={handleCancel}
                    />
                )}

                {/* Key/value list for the selected locale. */}
                <TranslationKeyList
                    translations={translations}
                    selectedLocale={selectedLocale}
                    defaultLocale={DEFAULT_ADMIN_LOCALE}
                    themeId={themeId}
                    onEdit={handleEdit}
                />
            </div>
        </div>
    )
}
