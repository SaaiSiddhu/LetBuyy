import { LEGAL_STATUS, LEGAL_REVISION_DATE } from '@/lib/legal/entity'
import { formatLegalDate } from '@/lib/legal/format'
import { en, type Dictionary } from '@/lib/i18n/dictionaries/en'

/**
 * Says out loud whether these policies actually bind anyone yet.
 *
 * A pre-launch platform publishing terms as though contracts already exist is
 * both misleading and legally awkward. While `LEGAL_STATUS` is `draft` this
 * states the position plainly; flipping the constant removes the banner
 * everywhere at once.
 */
export default function LegalStatusBanner({ dict = en, locale = 'en-IN' }: { dict?: Dictionary; locale?: string }) {
    if (LEGAL_STATUS === 'in-force') return null

    return (
        <div className="lgl-status" role="note">
            <div className="container">
                {/* Inner panel rather than a full-bleed band: the band needed a
                    rule top and bottom to read as one, and the rules are gone. */}
                <div className="lgl-status-panel">
                    <span className="lgl-status-dot" aria-hidden="true" />
                    <p className="lgl-status-text">
                        <strong>{dict.legal.statusTitle}</strong>{' '}
                        {dict.legal.statusBody.replace('{date}', formatLegalDate(LEGAL_REVISION_DATE, locale))}
                    </p>
                </div>
            </div>
        </div>
    )
}
