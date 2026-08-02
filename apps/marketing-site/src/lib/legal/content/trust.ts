import type { LegalDocument } from '../types'

/**
 * The grievance document is legally load-bearing in India: Rule 4(5) of the
 * Consumer Protection (E-Commerce) Rules 2020 and Rule 3(2) of the IT
 * (Intermediary Guidelines) Rules 2021 both require a *named* officer with
 * published contact details and fixed response windows — 48 hours to
 * acknowledge, one month to resolve.
 *
 * The officer's identity lives in `entity.ts` and is rendered by the page, not
 * written into the clause text, so publishing a name is a config change rather
 * than a content edit.
 */

export const security: LegalDocument = {
    slug: 'security',
    title: 'Security Practices',
    shortTitle: 'Security',
    purpose: 'How LetBuyy protects merchant and shopper data.',
    audience: 'everyone',
    group: 'trust',
    summary: [
        'Store isolation is enforced in the database, not just in application code — an application bug does not expose another merchant.',
        'Money movements go through controlled server-side operations with idempotency keys and locks, so a retry cannot double-charge or double-refund.',
        'We would rather hear about a vulnerability from you than from an attacker. Reporting one in good faith will not get you sued.',
    ],
    clauses: [
        {
            id: 'isolation',
            heading: 'Store isolation',
            body: [
                'Every record belongs to exactly one store. That boundary is enforced by row-level security in the database, so a query that forgets to filter by store returns nothing rather than everything.',
                'This is deliberately belt-and-braces. Application code also checks ownership, but the database is the layer that has to be right, because it is the one an application bug cannot bypass.',
            ],
        },
        {
            id: 'money',
            heading: 'Money handling',
            body: [
                'Order totals, tax, and shipping are computed on the server from stored configuration. Amounts sent by a browser are never trusted.',
                'Every money movement runs through a controlled database operation that takes a lock and requires an idempotency key, so a retried request cannot charge twice or refund twice.',
                'Gift-card balances are derived from a ledger of entries rather than stored as a mutable number, so a balance cannot silently drift and cannot go negative.',
                'Payment confirmations from the provider are verified by signature on our servers before any order is marked paid.',
            ],
        },
        {
            id: 'auth',
            heading: 'Authentication',
            body: [
                'Merchant sessions and shopper sessions are issued by separate systems with separate signing keys, so a token from one can never be accepted by the other.',
                'Passwords are stored hashed. Registration and login are protected by bot challenges and rate limiting.',
                'Refunds and payout-destination changes require step-up verification beyond the session — the two operations most worth attacking are the two that ask again.',
            ],
        },
        {
            id: 'transit',
            heading: 'Data in transit and at rest',
            body: [
                'All traffic is served over TLS, including custom domains, for which certificates are provisioned and renewed automatically.',
                'Data at rest is encrypted by the storage layer. Credentials for third-party services are held as secrets in the deployment platform and are not present in the codebase.',
            ],
        },
        {
            id: 'integrations',
            heading: 'Webhooks and background jobs',
            body: [
                'Inbound webhooks are verified by signature using constant-time comparison before the payload is acted on, and replayed deliveries are rejected.',
                'Messages passed to background workers carry a signed tenant envelope, so a job cannot be forged to act against a store it does not belong to.',
            ],
        },
        {
            id: 'access',
            heading: 'Internal access',
            body: [
                'Access to production data is individually authenticated, limited to those who need it, and logged.',
                'Automated checks run on every change to catch a class of mistakes before they merge — including direct writes to money tables, which are structurally forbidden rather than merely discouraged.',
            ],
        },
        {
            id: 'reporting',
            heading: 'Reporting a vulnerability',
            body: [
                'Email the security address below with enough detail to reproduce. You will get an acknowledgement, and we will tell you when it is fixed.',
                'Please give us reasonable time to fix an issue before disclosing it publicly, do not access or modify data belonging to anyone other than yourself, and stop at proof rather than pivoting further.',
                'We will not pursue legal action against a researcher who follows those three things in good faith.',
            ],
            note: 'Do not test against a live merchant\'s store. If you need an environment to test in, ask us for one.',
        },
        {
            id: 'incidents',
            heading: 'If something goes wrong',
            body: [
                'If a breach affects merchant or shopper data, we will notify affected merchants without undue delay with what happened, what data is involved, and what we are doing about it.',
                'Where a merchant must in turn notify their shoppers or the Data Protection Board, we will give them what they need to do that within their own deadline.',
            ],
        },
    ],
}

export const grievance: LegalDocument = {
    slug: 'grievance',
    title: 'Grievance Redressal',
    shortTitle: 'Grievance',
    purpose: 'How to escalate a complaint, and the timelines we hold ourselves to.',
    audience: 'everyone',
    group: 'trust',
    summary: [
        'If a store on LetBuyy will not resolve your problem, you can escalate it to us.',
        'We acknowledge complaints within 48 hours and work to resolve them within one month, as Indian law requires.',
        'Start with the store — it can act on your order directly, which is almost always faster.',
    ],
    clauses: [
        {
            id: 'first',
            heading: 'Start with the store',
            body: [
                'If your complaint is about an order — it has not arrived, it arrived damaged, a refund has not been issued — contact the store you bought from first. Its contact details are in the storefront footer and on your order confirmation email.',
                'The store can see your order, refund it, and reship it. We cannot do those things on their behalf, so going to them first genuinely is faster.',
            ],
        },
        {
            id: 'escalate',
            heading: 'When to escalate to us',
            body: [
                'Escalate to LetBuyy when a store has not responded within a reasonable time, refuses to honour its own published policy, appears to be operating fraudulently, or is selling something the Acceptable Use Policy prohibits.',
                'Also escalate anything about the platform itself: your account, your data, your payouts, or a security concern.',
            ],
        },
        {
            id: 'how',
            heading: 'How to raise it',
            body: [
                'Write to the grievance officer at the address published on this page. Include the store name, your order number, what you have already tried, and what outcome you are looking for.',
                'Attach evidence where you have it — screenshots, tracking references, and the messages you exchanged with the store. A complaint with evidence gets resolved considerably faster than one without.',
            ],
        },
        {
            id: 'timelines',
            heading: 'What happens next',
            body: [
                'We acknowledge receipt within 48 hours, and give you a reference to quote.',
                'We work to resolve complaints within one month of receipt. If it will take longer, we will tell you why and when to expect an answer.',
                'These are the timelines set by the Consumer Protection (E-Commerce) Rules 2020 and the IT Rules 2021. We treat them as deadlines, not targets.',
            ],
        },
        {
            id: 'outcomes',
            heading: 'What we can and cannot do',
            body: [
                'We can reach a merchant, require them to answer, act against a store that breaks our policies including suspending it, correct anything on the platform side, and give you a clear record of what happened.',
                'We cannot compel a merchant to refund you, refund you from our own funds, or reverse a payment your bank has already settled.',
                'That boundary follows from the fact that the sale was between you and the merchant. Where it leaves you without a remedy, the consumer forums below can order what we cannot.',
            ],
        },
        {
            id: 'further',
            heading: 'If you are still not satisfied',
            body: [
                'You can approach the National Consumer Helpline on 1915 or at consumerhelpline.gov.in, or file a complaint with the District, State, or National Consumer Disputes Redressal Commission depending on the value of your claim.',
                'For a payment dispute your bank or payment provider has not resolved, the RBI Ombudsman scheme is available after you have given the provider 30 days to respond.',
                'For a data-protection complaint, you may approach the Data Protection Board of India after raising it with us first.',
            ],
        },
    ],
}

export const intellectualProperty: LegalDocument = {
    slug: 'intellectual-property',
    title: 'Intellectual Property & Takedown',
    shortTitle: 'IP & takedown',
    purpose: 'Reporting infringement, and what happens when someone reports you.',
    audience: 'everyone',
    group: 'trust',
    summary: [
        'If a store on LetBuyy is infringing your trademark or copyright, tell us and we will act.',
        'We act on specific, evidenced reports. A report that cannot identify the listing or the right being infringed cannot be acted on.',
        'If your listing is removed, you will be told why and can respond.',
    ],
    clauses: [
        {
            id: 'ours',
            heading: 'LetBuyy\'s own marks',
            body: [
                'The LetBuyy name, logo, and product names are ours. You may refer to LetBuyy accurately — "built on LetBuyy" is fine — but may not use our marks in a way that suggests we endorse, sponsor, or operate your business.',
                'You may not use our marks in your domain name, app name, or logo without written permission.',
            ],
        },
        {
            id: 'yours',
            heading: 'Your content stays yours',
            body: [
                'Your catalogue, photography, copy, and brand remain yours. Publishing them through LetBuyy grants us only the licence needed to host and serve them, which ends when you remove them.',
            ],
        },
        {
            id: 'report',
            heading: 'Reporting infringement',
            body: [
                'Send a report to the contact route below containing all of the following. A report missing any of it will be sent back rather than actioned, because we cannot act on an unidentifiable claim.',
            ],
            list: [
                'The specific right you hold, with a registration number where one exists',
                'Evidence you own it or are authorised to act for the owner',
                'The exact URL of each infringing listing or page',
                'An explanation of why it infringes',
                'A statement that you believe in good faith that the use is not authorised',
                'Your name, address, and a working contact route',
            ],
        },
        {
            id: 'process',
            heading: 'What we do with a report',
            body: [
                'We review it, and where it is complete and appears well-founded we remove or disable the listing and tell the merchant what was removed and who reported it.',
                'We do not adjudicate ownership. Where two parties both claim a right, we may keep content down until they resolve it between themselves or a court decides.',
                'Merchants who receive repeated substantiated reports lose access.',
            ],
        },
        {
            id: 'counter',
            heading: 'If your listing was removed',
            body: [
                'You will be told what was removed and on what basis. If you believe the report was wrong, reply with your evidence — a licence, your own registration, or an explanation of why the use is permitted.',
                'Where a counter-notice is credible we may restore the listing and tell the original reporter, who can then take it up directly with you.',
            ],
            note: 'Knowingly filing a false infringement report to damage a competitor is itself actionable. We keep records of who reported what.',
        },
    ],
}
