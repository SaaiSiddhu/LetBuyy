/**
 * Content model for the legal library.
 *
 * Documents are structured data, not MDX, for three reasons: the hub needs to
 * read metadata (audience, group, clause count) without parsing prose; clause
 * numbering has to be derived rather than hand-maintained; and a clause id is
 * the anchor a support conversation cites ("see 4.2"), so it must be stable
 * against edits above it.
 */

/** Who a document actually binds. Drives the audience filter on the hub. */
export type LegalAudience = 'merchants' | 'shoppers' | 'developers' | 'everyone'

/** Shelf on the hub. Ordering within a group is the array order in `documents.ts`. */
export type LegalGroup = 'agreements' | 'money' | 'data' | 'trust'

export interface LegalClause {
    /** Stable anchor. Never renumber — the visible number is derived from position. */
    id: string
    heading: string
    /** Each string is a paragraph. */
    body: string[]
    /** Rendered as a bordered list beneath the body. */
    list?: string[]
    /** Set apart as a callout — used for the thing a reader must not miss. */
    note?: string
}

export interface LegalDocument {
    slug: string
    title: string
    /** Compact form for nav, cards, and breadcrumbs. */
    shortTitle: string
    /** One line, plain language: what this document is for. */
    purpose: string
    audience: LegalAudience
    group: LegalGroup
    /**
     * Three-to-five sentence plain-language digest shown above the clauses.
     * Not a substitute for the text and labelled as such in the UI.
     */
    summary: string[]
    clauses: LegalClause[]
}

export const GROUP_META: Record<LegalGroup, { label: string; blurb: string }> = {
    agreements: {
        label: 'Agreements',
        blurb: 'The contracts that govern using LetBuyy — as a merchant, a partner, or a developer.',
    },
    money: {
        label: 'Money & orders',
        blurb: 'How payments, settlements, refunds, and delivery obligations work.',
    },
    data: {
        label: 'Data & privacy',
        blurb: 'What we collect, why, who processes it, and the rights you hold over it.',
    },
    trust: {
        label: 'Trust & safety',
        blurb: 'Security practice, complaint escalation, and intellectual-property enforcement.',
    },
}

export const AUDIENCE_LABEL: Record<LegalAudience, string> = {
    merchants: 'Merchants',
    shoppers: 'Shoppers',
    developers: 'Developers',
    everyone: 'Everyone',
}
