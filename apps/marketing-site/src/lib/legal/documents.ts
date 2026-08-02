import type { LegalDocument, LegalGroup } from './types'
import { acceptableUse, apiTerms, marketplaceTerms, termsOfService } from './content/agreements'
import { billing, payouts, refunds, shipping } from './content/money'
import { cookies, dataProcessing, privacy, subprocessors } from './content/data'
import { grievance, intellectualProperty, security } from './content/trust'

/**
 * The legal library, in reading order within each group.
 *
 * Array position is the published order — the hub and the prev/next controls
 * both read from it, so reordering here reorders the site.
 */
export const LEGAL_DOCUMENTS: LegalDocument[] = [
    // Agreements
    termsOfService,
    acceptableUse,
    apiTerms,
    marketplaceTerms,
    // Money & orders
    billing,
    payouts,
    refunds,
    shipping,
    // Data & privacy
    privacy,
    cookies,
    dataProcessing,
    subprocessors,
    // Trust & safety
    security,
    grievance,
    intellectualProperty,
]

/** Group order on the hub. */
export const GROUP_ORDER: LegalGroup[] = ['agreements', 'money', 'data', 'trust']

export function getLegalDocument(slug: string): LegalDocument | undefined {
    return LEGAL_DOCUMENTS.find(doc => doc.slug === slug)
}

export function getDocumentsByGroup(group: LegalGroup): LegalDocument[] {
    return LEGAL_DOCUMENTS.filter(doc => doc.group === group)
}

/**
 * Neighbours in published order, for the prev/next control at the end of a
 * document. Deliberately crosses group boundaries so the library reads as one
 * continuous sequence rather than four dead ends.
 */
export function getAdjacentDocuments(slug: string): {
    previous: LegalDocument | null
    next: LegalDocument | null
} {
    const index = LEGAL_DOCUMENTS.findIndex(doc => doc.slug === slug)
    if (index === -1) return { previous: null, next: null }
    return {
        previous: LEGAL_DOCUMENTS[index - 1] ?? null,
        next: LEGAL_DOCUMENTS[index + 1] ?? null,
    }
}

/**
 * Rough reading time. Legal text is read more slowly than prose, so this uses
 * 180 wpm rather than the 230 the article pages assume — overstating how fast
 * a contract can be read is exactly the wrong error to make here.
 */
export function readingMinutes(doc: LegalDocument): number {
    const words = doc.clauses.reduce((total, clause) => {
        const clauseWords =
            clause.heading.split(/\s+/).length +
            clause.body.join(' ').split(/\s+/).length +
            (clause.list?.join(' ').split(/\s+/).length ?? 0) +
            (clause.note?.split(/\s+/).length ?? 0)
        return total + clauseWords
    }, 0)
    return Math.max(1, Math.round(words / 180))
}
