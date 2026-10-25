import {
    GRIEVANCE_OFFICER,
    LEGAL_ENTITY,
    isEntityPublished,
    isGrievanceOfficerPublished,
} from '@/lib/legal/entity'
import { en, type Dictionary } from '@/lib/i18n/dictionaries/en'

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
export default function GrievanceOfficerCard({ dict = en }: { dict?: Dictionary }) {
    const copy = dict.legal.officer
    const officerPublished = isGrievanceOfficerPublished()
    const entityPublished = isEntityPublished()

    return (
        <section className="lgl-officer" aria-labelledby="lgl-officer-title">
            <header className="lgl-officer-head">
                <h2 id="lgl-officer-title" className="lgl-officer-title">
                    {copy.title}
                </h2>
                <p className="lgl-officer-req">
                    {copy.requirement}
                </p>
            </header>

            <dl className="lgl-officer-grid">
                <div className="lgl-officer-cell">
                    <dt>{copy.name}</dt>
                    <dd className={officerPublished ? undefined : 'is-pending'}>
                        {officerPublished ? GRIEVANCE_OFFICER.name : copy.pending}
                    </dd>
                </div>
                <div className="lgl-officer-cell">
                    <dt>{copy.designation}</dt>
                    <dd className={officerPublished ? undefined : 'is-pending'}>
                        {officerPublished ? GRIEVANCE_OFFICER.designation : copy.pending}
                    </dd>
                </div>
                <div className="lgl-officer-cell">
                    <dt>{copy.email}</dt>
                    <dd>
                        <a href={`mailto:${GRIEVANCE_OFFICER.email}`}>{GRIEVANCE_OFFICER.email}</a>
                    </dd>
                </div>
                <div className="lgl-officer-cell">
                    <dt>{copy.phone}</dt>
                    <dd className={GRIEVANCE_OFFICER.phone ? undefined : 'is-pending'}>
                        {GRIEVANCE_OFFICER.phone || copy.pending}
                    </dd>
                </div>
                <div className="lgl-officer-cell lgl-officer-cell-wide">
                    <dt>{copy.entity}</dt>
                    <dd className={entityPublished ? undefined : 'is-pending'}>
                        {entityPublished ? LEGAL_ENTITY.registeredName : copy.pending}
                    </dd>
                </div>
                {entityPublished && (
                    <div className="lgl-officer-cell lgl-officer-cell-wide">
                        <dt>{copy.address}</dt>
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
                    {copy.gap}
                </p>
            )}

            <ul className="lgl-officer-slas">
                <li>
                    <strong>{copy.acknowledgeTime}</strong>
                    <span>{copy.acknowledge}</span>
                </li>
                <li>
                    <strong>{copy.resolveTime}</strong>
                    <span>{copy.resolve}</span>
                </li>
            </ul>
        </section>
    )
}
