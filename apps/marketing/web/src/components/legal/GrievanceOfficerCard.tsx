import {
    GRIEVANCE_OFFICER,
    LEGAL_ENTITY,
    isEntityPublished,
    isGrievanceOfficerPublished,
} from '@/lib/legal/entity'

/**
 * The published officer details required by Rule 4(5) of the Consumer
 * Protection (E-Commerce) Rules 2020 and Rule 3(2) of the IT (Intermediary
 * Guidelines) Rules 2021.
 *
 * Both rules require a named individual. While the name is unset this renders
 * an honest gap rather than a plausible-looking placeholder — a fabricated
 * officer would satisfy neither rule and would be worse than an admitted
 * omission, because it reads as compliance.
 */
export default function GrievanceOfficerCard() {
    const officerPublished = isGrievanceOfficerPublished()
    const entityPublished = isEntityPublished()

    return (
        <section className="lgl-officer" aria-labelledby="lgl-officer-title">
            <header className="lgl-officer-head">
                <h2 id="lgl-officer-title" className="lgl-officer-title">
                    Grievance Officer
                </h2>
                <p className="lgl-officer-req">
                    Published under Rule 4(5), Consumer Protection (E-Commerce) Rules 2020 and Rule 3(2),
                    IT (Intermediary Guidelines) Rules 2021.
                </p>
            </header>

            <dl className="lgl-officer-grid">
                <div className="lgl-officer-cell">
                    <dt>Name</dt>
                    <dd className={officerPublished ? undefined : 'is-pending'}>
                        {officerPublished ? GRIEVANCE_OFFICER.name : 'To be published at launch'}
                    </dd>
                </div>
                <div className="lgl-officer-cell">
                    <dt>Designation</dt>
                    <dd className={officerPublished ? undefined : 'is-pending'}>
                        {officerPublished ? GRIEVANCE_OFFICER.designation : 'To be published at launch'}
                    </dd>
                </div>
                <div className="lgl-officer-cell">
                    <dt>Email</dt>
                    <dd>
                        <a href={`mailto:${GRIEVANCE_OFFICER.email}`}>{GRIEVANCE_OFFICER.email}</a>
                    </dd>
                </div>
                <div className="lgl-officer-cell">
                    <dt>Phone</dt>
                    <dd className={GRIEVANCE_OFFICER.phone ? undefined : 'is-pending'}>
                        {GRIEVANCE_OFFICER.phone || 'To be published at launch'}
                    </dd>
                </div>
                <div className="lgl-officer-cell lgl-officer-cell-wide">
                    <dt>Registered entity</dt>
                    <dd className={entityPublished ? undefined : 'is-pending'}>
                        {entityPublished ? LEGAL_ENTITY.registeredName : 'To be published at launch'}
                    </dd>
                </div>
                {entityPublished && (
                    <div className="lgl-officer-cell lgl-officer-cell-wide">
                        <dt>Registered address</dt>
                        <dd>
                            {LEGAL_ENTITY.registeredAddress.map(line => (
                                <span key={line} className="lgl-officer-addr">
                                    {line}
                                </span>
                            ))}
                        </dd>
                    </div>
                )}
            </dl>

            {!officerPublished && (
                <p className="lgl-officer-gap">
                    LetBuyy has not opened to merchants, so no officer has been appointed yet. Until one is,
                    complaints sent to the address above reach the team directly and are handled on the same
                    timelines.
                </p>
            )}

            <ul className="lgl-officer-slas">
                <li>
                    <strong>48 hours</strong>
                    <span>to acknowledge your complaint</span>
                </li>
                <li>
                    <strong>1 month</strong>
                    <span>to resolve it, or explain the delay</span>
                </li>
            </ul>
        </section>
    )
}
