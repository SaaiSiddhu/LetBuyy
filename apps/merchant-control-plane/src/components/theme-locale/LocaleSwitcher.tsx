'use client'

/**
 * LocaleSwitcher — Phase Z locale switcher for the theme translation editor.
 *
 * Lists SUPPORTED_ADMIN_LOCALES from admin-locales.ts; en-IN is always the
 * first entry and the default selection.
 *
 * India-first (non-negotiable): en-IN is the default. Selecting another locale
 * is additive — the en-IN default behavior is never replaced or regressed.
 *
 * A11y: uses @letbuyy/ui Select (native <select>) so keyboard navigation,
 * screen-reader announcements, and OS-level accessibility all work out of
 * the box. The wrapper carries role="region" + aria-label.
 *
 * Design: @letbuyy/ui + --lb-* tokens only; mobile-first (~360px).
 * No raw rounded-[Npx] Tailwind classes (design ratchet).
 */

import { Select } from '@letbuyy/ui'
import {
    DEFAULT_ADMIN_LOCALE,
    SUPPORTED_ADMIN_LOCALES,
    getAdminLocaleOptions,
    type AdminLocaleCode,
} from '@/lib/i18n/admin-locales'
import styles from './theme-locale.module.css'

export interface LocaleSwitcherProps {
    /** Currently selected locale code (controlled). */
    value: AdminLocaleCode
    /** Called when the merchant picks a different locale. */
    onChange: (locale: AdminLocaleCode) => void
    loading?: boolean
    disabled?: boolean
    className?: string
}

/**
 * LocaleSwitcher — renders a locale <select> with en-IN as the default/first option.
 *
 * INDIA-FIRST: en-IN is rendered first in the list and is the default locale.
 * Other locales are additive only.
 */
export default function LocaleSwitcher({
    value,
    onChange,
    loading = false,
    disabled = false,
    className,
}: LocaleSwitcherProps) {
    const options = getAdminLocaleOptions()

    return (
        <div
            className={`${styles.localeSwitcherRoot}${className ? ` ${className}` : ''}`}
            role="region"
            aria-label="Locale selector"
        >
            <span className={styles.localeSwitcherLabel} aria-hidden="true">
                {loading ? 'Loading locales…' : 'Editing locale'}
            </span>
            <Select
                id="theme-locale-switcher"
                label="Select locale to edit"
                hideLabel
                aria-label="Select locale to edit"
                value={value}
                options={options}
                onChange={(e) => {
                    const next = e.target.value as AdminLocaleCode
                    if (next !== value) onChange(next)
                }}
                disabled={disabled || loading}
            />
            {value !== DEFAULT_ADMIN_LOCALE && (
                <p className={styles.localeSwitcherHint} aria-live="polite">
                    Default locale: {DEFAULT_ADMIN_LOCALE}. Keys missing here fall back to the default locale string.
                </p>
            )}
        </div>
    )
}

// Re-export constants so consumers can import from a single path.
export { DEFAULT_ADMIN_LOCALE, SUPPORTED_ADMIN_LOCALES, type AdminLocaleCode }
