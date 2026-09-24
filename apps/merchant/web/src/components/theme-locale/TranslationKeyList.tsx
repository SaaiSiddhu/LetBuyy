'use client'

/**
 * TranslationKeyList — Phase Z key/value list for theme translation editing.
 *
 * Renders storefront_translations rows filtered to:
 *   - resource_type = 'theme'
 *   - resource_id  = themeId (the active theme)
 *   - locale       = selectedLocale
 *
 * Missing-key indicator: when a key exists in the default locale (en-IN) but
 * is absent in the selected locale, the row shows a "Missing" warning badge.
 * This is the authoritative indicator for untranslated keys.
 *
 * India-first: en-IN is the reference/default locale. Missing-key detection
 * always compares the selected locale against en-IN. The en-IN row set is
 * never modified by this component.
 *
 * RISK-DUAL-N01: this component reads translation instance data only (rows
 * from storefront_translations). It never reads, writes, or modifies
 * section_definitions or any bundle schema field.
 *
 * A11y: list uses role="list" + aria-label; each edit button has aria-label.
 * Design: @letbuyy/ui + --lb-* tokens; mobile-first; no raw rounded-[Npx].
 */

import { Badge, Button, Spinner } from '@letbuyy/ui'
import type { StorefrontTranslation } from '@letbuyy/shared-types'
import { DEFAULT_ADMIN_LOCALE, type AdminLocaleCode } from '@/lib/i18n/admin-locales'
import styles from './theme-locale.module.css'

/**
 * A flattened translation entry passed to the onEdit callback so the editor
 * knows which key + locale + existing ID to work with.
 *
 * RISK-DUAL-N01: resource_type is always 'theme'; the editor never writes to
 * section_definitions.
 */
export interface TranslationEntry {
    /** The translation field key (e.g. 'general.title'). */
    key: string
    locale: string
    source_text: string | null
    /** Current translated value, or '' for missing-key rows. */
    translated_text: string
    /** storefront_translations.id — undefined when the row does not exist yet. */
    id: string | undefined
    status: string
    resource_type: 'theme'
    resource_id: string
}

export interface TranslationKeyListProps {
    translations: StorefrontTranslation[]
    selectedLocale: AdminLocaleCode
    /** The reference default locale (en-IN by convention). */
    defaultLocale?: AdminLocaleCode
    /** The active theme's ID — used to scope translations to resource_id. */
    themeId: string
    loading?: boolean
    error?: string | null
    /** Called when the merchant clicks Edit / Add on a key row. */
    onEdit: (entry: TranslationEntry) => void
}

/** Build a Map<field, StorefrontTranslation> for (locale, themeId). */
function buildLocaleMap(
    rows: StorefrontTranslation[],
    locale: string,
    themeId: string,
): Map<string, StorefrontTranslation> {
    const map = new Map<string, StorefrontTranslation>()
    for (const t of rows) {
        if (
            t.locale === locale &&
            t.resource_type === 'theme' &&
            t.resource_id === themeId
        ) {
            map.set(t.field, t)
        }
    }
    return map
}

export default function TranslationKeyList({
    translations,
    selectedLocale,
    defaultLocale = DEFAULT_ADMIN_LOCALE,
    themeId,
    loading = false,
    error = null,
    onEdit,
}: TranslationKeyListProps) {
    if (loading) {
        return (
            <div className={styles.translationLoading} aria-busy="true">
                <Spinner label="Loading translations" size="sm" />
                <span>Loading translations…</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className={styles.translationError} role="alert">
                {error}
            </div>
        )
    }

    const defaultMap = buildLocaleMap(translations, defaultLocale, themeId)
    const selectedMap = buildLocaleMap(translations, selectedLocale, themeId)
    const isDefaultLocale = selectedLocale === defaultLocale

    // Union of keys: all default-locale keys; plus any extra keys in selected locale.
    const allKeys = isDefaultLocale
        ? Array.from(defaultMap.keys())
        : Array.from(new Set([...defaultMap.keys(), ...selectedMap.keys()]))

    if (allKeys.length === 0) {
        return (
            <div className={styles.translationEmpty} aria-label="No theme translation keys">
                No theme translation keys found. Add a translation to get started.
            </div>
        )
    }

    return (
        <ul
            role="list"
            aria-label="Theme translation keys"
            className={styles.translationKeyList}
        >
            {allKeys.map((key) => {
                const inDefault = defaultMap.has(key)
                const inSelected = selectedMap.has(key)
                // isMissing: key exists in default locale but is absent in the selected locale.
                const isMissing = !isDefaultLocale && inDefault && !inSelected
                // Show the selected-locale row when it exists; fall back to default for display.
                const displayRow = selectedMap.get(key) ?? defaultMap.get(key)
                if (!displayRow) return null

                return (
                    <TranslationKeyRow
                        key={key}
                        fieldKey={key}
                        displayRow={displayRow}
                        isMissing={isMissing}
                        selectedLocale={selectedLocale}
                        themeId={themeId}
                        selectedRow={selectedMap.get(key)}
                        onEdit={onEdit}
                    />
                )
            })}
        </ul>
    )
}

interface TranslationKeyRowProps {
    fieldKey: string
    displayRow: StorefrontTranslation
    selectedRow: StorefrontTranslation | undefined
    isMissing: boolean
    selectedLocale: AdminLocaleCode
    themeId: string
    onEdit: (entry: TranslationEntry) => void
}

function TranslationKeyRow({
    fieldKey,
    displayRow,
    selectedRow,
    isMissing,
    selectedLocale,
    themeId,
    onEdit,
}: TranslationKeyRowProps) {
    function handleEdit() {
        // RISK-DUAL-N01: passes resource_type: 'theme' always — never section_definitions.
        onEdit({
            key: fieldKey,
            locale: selectedLocale,
            source_text: displayRow.source_text ?? null,
            translated_text: isMissing ? '' : (selectedRow?.translated_text ?? ''),
            id: isMissing ? undefined : selectedRow?.id,
            status: selectedRow?.status ?? 'draft',
            resource_type: 'theme',
            resource_id: themeId,
        })
    }

    return (
        <li className={styles.translationKeyRow}>
            <div className={styles.translationKeyMeta}>
                <div className={styles.translationKeyHeader}>
                    <code className={styles.translationKeyCode}>{fieldKey}</code>
                    {isMissing && (
                        <Badge
                            label="Missing"
                            variant="warning"
                            aria-label={`Missing translation for key ${fieldKey}`}
                        />
                    )}
                </div>
                <p
                    className={
                        isMissing
                            ? `${styles.translationKeyValue} ${styles.translationKeyValueMissing}`
                            : styles.translationKeyValue
                    }
                    aria-label={`Translation value for ${fieldKey}`}
                >
                    {isMissing ? <em>Not translated</em> : (selectedRow?.translated_text ?? displayRow.translated_text)}
                </p>
            </div>
            <Button
                unstyled
                type="button"
                onClick={handleEdit}
                aria-label={isMissing ? `Add missing translation for ${fieldKey}` : `Edit translation for ${fieldKey}`}
                className={styles.translationKeyEditBtn}
            >
                {isMissing ? 'Add' : 'Edit'}
            </Button>
        </li>
    )
}
