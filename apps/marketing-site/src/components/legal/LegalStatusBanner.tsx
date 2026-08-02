import { LEGAL_STATUS, LEGAL_REVISION_DATE } from '@/lib/legal/entity'
import { formatLegalDate } from '@/lib/legal/format'

/**
 * Says out loud whether these policies actually bind anyone yet.
 *
 * A pre-launch platform publishing terms as though contracts already exist is
 * both misleading and legally awkward. While `LEGAL_STATUS` is `draft` this
 * states the position plainly; flipping the constant removes the banner
 * everywhere at once.
 */
export default function LegalStatusBanner() {
    if (LEGAL_STATUS === 'in-force') return null

    return (
        <div className="lgl-status" role="note">
            <div className="container lgl-status-inner">
                <span className="lgl-status-dot" aria-hidden="true" />
                <p className="lgl-status-text">
                    <strong>These policies are published for review and are not yet in force.</strong>{' '}
                    LetBuyy has not opened to merchants, so no agreement has been formed with anyone.
                    They take effect on the day the platform launches, and the effective date will be
                    stated here. Last revised {formatLegalDate(LEGAL_REVISION_DATE)}.
                </p>
            </div>
        </div>
    )
}
