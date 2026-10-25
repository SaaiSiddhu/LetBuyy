import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import type { Locale } from '@/lib/i18n/locales'

/**
 * Says, in the reader's own language, that the body below is in English.
 *
 * Two variants because the reason differs and the reader needs the real one:
 *
 *   legal   — the English text is the version that legally applies. That is
 *             not a translation backlog, it is a statement about which text
 *             governs, and it stays true even after translations exist.
 *   article — simply not translated yet.
 *
 * Renders nothing in English locales; there is nothing to warn about.
 */
export default function UntranslatedNotice({
    locale,
    dict,
    variant,
}: {
    locale: Locale
    dict: Dictionary
    variant: 'legal' | 'article' | 'page'
}) {
    if (locale.language.code === 'en') return null

    const title = variant === 'legal' ? dict.contentFallback.legalTitle : variant === 'page' ? dict.contentFallback.pageTitle : dict.contentFallback.articleTitle
    const body = variant === 'legal' ? dict.contentFallback.legalBody : variant === 'page' ? dict.contentFallback.pageBody : dict.contentFallback.articleBody

    return (
        <aside className="i18n-notice" role="note">
            <span className="i18n-notice-mark" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8h.01M11 12h1v4h1" />
                </svg>
            </span>
            <div className="i18n-notice-text">
                <strong>{title}</strong>
                <p>{body}</p>
            </div>
        </aside>
    )
}
