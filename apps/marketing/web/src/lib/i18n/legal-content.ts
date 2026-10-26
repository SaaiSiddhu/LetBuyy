import { createHash } from 'node:crypto'
import type { LegalDocument } from '@/lib/legal/types'
import hi_terms from './content/hi/legal/terms.json'
import hi_acceptable_use from './content/hi/legal/acceptable-use.json'
import hi_api_terms from './content/hi/legal/api-terms.json'
import hi_marketplace from './content/hi/legal/marketplace.json'
import hi_billing from './content/hi/legal/billing.json'
import hi_payouts from './content/hi/legal/payouts.json'
import hi_refunds from './content/hi/legal/refunds.json'
import hi_shipping from './content/hi/legal/shipping.json'
import hi_privacy from './content/hi/legal/privacy.json'
import hi_cookies from './content/hi/legal/cookies.json'
import hi_data_processing from './content/hi/legal/data-processing.json'
import hi_subprocessors from './content/hi/legal/subprocessors.json'
import hi_security from './content/hi/legal/security.json'
import hi_grievance from './content/hi/legal/grievance.json'
import hi_intellectual_property from './content/hi/legal/intellectual-property.json'
import ta_terms from './content/ta/legal/terms.json'
import ta_acceptable_use from './content/ta/legal/acceptable-use.json'
import ta_api_terms from './content/ta/legal/api-terms.json'
import ta_marketplace from './content/ta/legal/marketplace.json'
import ta_billing from './content/ta/legal/billing.json'
import ta_payouts from './content/ta/legal/payouts.json'
import ta_refunds from './content/ta/legal/refunds.json'
import ta_shipping from './content/ta/legal/shipping.json'
import ta_privacy from './content/ta/legal/privacy.json'
import ta_cookies from './content/ta/legal/cookies.json'
import ta_data_processing from './content/ta/legal/data-processing.json'
import ta_subprocessors from './content/ta/legal/subprocessors.json'
import ta_security from './content/ta/legal/security.json'
import ta_grievance from './content/ta/legal/grievance.json'
import ta_intellectual_property from './content/ta/legal/intellectual-property.json'

interface ContentTranslation { sourceHash: string; values: string[] }
const CONTENT: Record<string, Record<string, ContentTranslation>> = {
    hi: { 'terms': hi_terms, 'acceptable-use': hi_acceptable_use, 'api-terms': hi_api_terms, 'marketplace': hi_marketplace, 'billing': hi_billing, 'payouts': hi_payouts, 'refunds': hi_refunds, 'shipping': hi_shipping, 'privacy': hi_privacy, 'cookies': hi_cookies, 'data-processing': hi_data_processing, 'subprocessors': hi_subprocessors, 'security': hi_security, 'grievance': hi_grievance, 'intellectual-property': hi_intellectual_property },
    ta: { 'terms': ta_terms, 'acceptable-use': ta_acceptable_use, 'api-terms': ta_api_terms, 'marketplace': ta_marketplace, 'billing': ta_billing, 'payouts': ta_payouts, 'refunds': ta_refunds, 'shipping': ta_shipping, 'privacy': ta_privacy, 'cookies': ta_cookies, 'data-processing': ta_data_processing, 'subprocessors': ta_subprocessors, 'security': ta_security, 'grievance': ta_grievance, 'intellectual-property': ta_intellectual_property },
}

/** Only reader-facing fields are translated. Stable IDs, routes and policy authority stay intact. */
export function legalSourceText(doc: LegalDocument): string[] {
    return [doc.title, doc.shortTitle, doc.purpose, ...doc.summary, ...doc.clauses.flatMap(c => [c.heading, ...c.body, ...(c.list ?? []), ...(c.note ? [c.note] : [])])]
}

export function legalSourceHash(doc: LegalDocument): string {
    return createHash('sha256').update(JSON.stringify(legalSourceText(doc))).digest('hex')
}

export function localizeLegalContent(source: LegalDocument, language: string): { document: LegalDocument; translated: boolean } {
    const entry = CONTENT[language]?.[source.slug]
    if (!entry) return { document: source, translated: false }
    // A changed source cannot silently acquire an outdated or shifted translation.
    if (entry.sourceHash !== legalSourceHash(source) || entry.values.length !== legalSourceText(source).length || entry.values.some(value => !value.trim())) {
        throw new Error(`Outdated or incomplete legal translation: ${language}/${source.slug}`)
    }
    let cursor = 0
    const next = () => entry.values[cursor++]
    const document: LegalDocument = {
        ...source, title: next(), shortTitle: next(), purpose: next(), summary: source.summary.map(next),
        clauses: source.clauses.map(c => ({ ...c, heading: next(), body: c.body.map(next), ...(c.list ? { list: c.list.map(next) } : {}), ...(c.note ? { note: next() } : {}) })),
    }
    return { document, translated: true }
}
