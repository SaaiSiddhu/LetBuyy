/**
 * Legally operative facts about the LetBuyy entity.
 *
 * Everything here is a statement that binds a real company to a real
 * obligation — the registered name a contract is formed with, the address
 * notice is served at, the officer a consumer complaint escalates to. None of
 * it can be inferred from the codebase, so none of it is invented.
 *
 * Values marked `HUMAN-REQUIRED` ship empty on purpose. Every consumer below
 * filters empty strings, so the legal pages render an honest "not yet
 * published" line instead of a fabricated registration number. Fill these in
 * once the entity is incorporated and counsel has signed off; no code change
 * is needed anywhere else.
 *
 * This mirrors the convention in `@letbuyy/shared-types` `brand.ts`
 * (SKIP-BRAND-LEGAL-FACTS) — same reasoning, different blast radius.
 */

/**
 * Whether the policies are in force.
 *
 * `draft` — written and reviewable, but LetBuyy has not opened to merchants,
 * so no contract has been formed with anyone. The pages say so.
 * `in-force` — flip this on launch day, after counsel review, once
 * `LEGAL_ENTITY.registeredName` and the grievance officer are filled in.
 */
export const LEGAL_STATUS: 'draft' | 'in-force' = 'draft'

/**
 * The date the current text was last edited. Distinct from the effective date:
 * a draft has a revision date but no effective date, because nothing is yet in
 * effect.
 */
export const LEGAL_REVISION_DATE = '2026-08-03'

/**
 * The date the policies begin to bind, set when `LEGAL_STATUS` flips.
 * HUMAN-REQUIRED — leave empty until launch.
 */
export const LEGAL_EFFECTIVE_DATE = ''

export interface LegalEntityFacts {
    /** HUMAN-REQUIRED — registered company name, e.g. "LetBuyy Technologies Private Limited". */
    registeredName: string
    /** HUMAN-REQUIRED — Corporate Identity Number from the MCA. */
    cin: string
    /** HUMAN-REQUIRED — GSTIN under which LetBuyy raises its own invoices. */
    gstin: string
    /** HUMAN-REQUIRED — registered office, as filed. Notice is served here. */
    registeredAddress: string[]
    /** HUMAN-REQUIRED — state whose courts have jurisdiction, e.g. "Tamil Nadu". */
    jurisdictionState: string
}

export const LEGAL_ENTITY: LegalEntityFacts = {
    registeredName: '', // HUMAN-REQUIRED
    cin: '', // HUMAN-REQUIRED
    gstin: '', // HUMAN-REQUIRED
    registeredAddress: [], // HUMAN-REQUIRED
    jurisdictionState: '', // HUMAN-REQUIRED
}

/**
 * The Grievance Officer required by Rule 4(5) of the Consumer Protection
 * (E-Commerce) Rules, 2020 and Rule 3(2) of the IT (Intermediary Guidelines)
 * Rules, 2021. Both require a *named* individual with published contact
 * details — a role mailbox alone does not satisfy either rule.
 */
export interface GrievanceOfficerFacts {
    /** HUMAN-REQUIRED — the individual's name, published as required. */
    name: string
    /** HUMAN-REQUIRED — their designation. */
    designation: string
    /** Role mailbox. Safe to default: it routes regardless of who holds the role. */
    email: string
    /** HUMAN-REQUIRED — published contact number. */
    phone: string
}

export const GRIEVANCE_OFFICER: GrievanceOfficerFacts = {
    name: '', // HUMAN-REQUIRED
    designation: '', // HUMAN-REQUIRED
    email: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL?.trim() || 'grievance@letbuyy.com',
    phone: '', // HUMAN-REQUIRED
}

/** True once the entity facts are complete enough to present as binding. */
export function isEntityPublished(): boolean {
    return Boolean(LEGAL_ENTITY.registeredName && LEGAL_ENTITY.registeredAddress.length)
}

/** True once a named officer is published, as the two rules above require. */
export function isGrievanceOfficerPublished(): boolean {
    return Boolean(GRIEVANCE_OFFICER.name && GRIEVANCE_OFFICER.designation)
}

/**
 * How to refer to the company in body text. Falls back to the brand name while
 * the registered name is unset — "LetBuyy" is true either way.
 */
export function entityName(): string {
    return LEGAL_ENTITY.registeredName || 'LetBuyy'
}
