import type { LegalDocument } from '../types'

/**
 * Drafted against the DPDP Act 2023 and the DPDP Rules 2025. Under that Act
 * LetBuyy is a Data Fiduciary for its own merchant accounts and a Data
 * Processor for the shopper data merchants hold — the same split GDPR calls
 * controller/processor. Getting that split right is what makes the rest
 * coherent, so it is stated plainly rather than buried.
 *
 * Enforcement of the substantive obligations begins 13 May 2027, with the
 * consent-manager framework live from 13 November 2026. The text below is
 * written to that standard now rather than being retrofitted later.
 *
 * The sub-processor list is derived from provider credentials actually present
 * in the codebase — it is not aspirational, and it is the one document here
 * that must be re-checked whenever a provider is added or dropped.
 */

export const privacy: LegalDocument = {
    slug: 'privacy',
    title: 'Privacy Policy',
    shortTitle: 'Privacy',
    purpose: 'What personal data LetBuyy handles, why, and what rights you have.',
    audience: 'everyone',
    group: 'data',
    summary: [
        'For merchant accounts, LetBuyy decides what data is collected and why — so we answer to you directly for it.',
        'For shopper data inside a store, the merchant decides and we process on their instruction. Ask the store first; we will help them answer.',
        'We do not sell personal data. We do not use a merchant\'s customer list for our own marketing.',
    ],
    clauses: [
        {
            id: 'roles',
            heading: 'Two different relationships',
            body: [
                'LetBuyy handles personal data in two distinct roles, and your rights differ depending on which one applies.',
                'When you hold a LetBuyy merchant account, we are the Data Fiduciary — we decide what is collected and why, and you exercise your rights against us.',
                'When you shop at a store built on LetBuyy, that merchant is the Data Fiduciary. We are their Data Processor: we hold the data and act on their instruction. Your rights are exercised against the store, and we support them in answering you.',
            ],
            note: 'If you are not sure which applies: did you sign up at letbuyy.com, or buy something from a store? The first is us; the second is the store.',
        },
        {
            id: 'merchant-data',
            heading: 'What we collect from merchants',
            body: [
                'To create and operate your account we collect your name, email address, phone number, and password credentials. Passwords are stored hashed and are never recoverable in readable form.',
                'To operate your store we hold your business details, GSTIN where you provide one, store configuration, catalogue, and the orders your store receives.',
                'To keep the platform working and secure we log requests, errors, and device and network information such as IP address and browser type.',
                'Payment credentials are collected by your payment provider, not by us. We hold references and status, not card numbers.',
            ],
        },
        {
            id: 'shopper-data',
            heading: 'What stores collect from shoppers',
            body: [
                'A store typically holds the shopper\'s name, email, phone, delivery address, order history, and any account credentials created on that storefront.',
                'Card details are never held by the store or by us — the payment provider collects them directly and returns only a reference.',
                'Each store\'s data is isolated from every other store at the database level. One merchant cannot read another merchant\'s customers, and a shopper account on one storefront is not an account on another.',
            ],
        },
        {
            id: 'why',
            heading: 'Why we process it',
            body: [
                'To provide the service you asked for: running your store, processing orders, computing tax, sending order emails.',
                'To keep it secure: detecting fraud, rate-limiting abuse, distinguishing humans from bots at sign-up and login, and investigating incidents.',
                'To meet legal obligations: tax records, invoices, and responses to lawful requests.',
                'To improve the product, using aggregated and de-identified usage patterns rather than individual records.',
            ],
        },
        {
            id: 'consent',
            heading: 'Consent',
            body: [
                'Where we rely on your consent — optional analytics and marketing communications — it is asked for separately, in plain language, and can be withdrawn as easily as it was given.',
                'Withdrawing consent for optional processing does not affect processing we do to deliver the service you are paying for or to meet a legal duty.',
                'Cookie choices are managed from the control in the site footer and are covered in detail in the Cookie Policy.',
            ],
        },
        {
            id: 'sharing',
            heading: 'Who else sees it',
            body: [
                'Service providers that run parts of the platform — hosting, database, payments, email, shipping, error monitoring. Each is listed in the Sub-processor Register with what it does and where it runs.',
                'A merchant\'s courier and payment provider, to the extent an order requires it.',
                'Authorities, where we are legally compelled. We check that a request is valid before responding, and tell the affected person unless the law forbids it.',
                'An acquirer, if the business is sold. Notice would be given, and the successor would be bound by this policy until it is properly replaced.',
            ],
            note: 'We do not sell personal data, and we do not share it with advertisers or data brokers.',
        },
        {
            id: 'retention',
            heading: 'How long we keep it',
            body: [
                'Account and store data is kept while the account is open, and for a limited wind-down period after closure so an accidental closure can be reversed.',
                'Orders, invoices, and payment ledger entries are kept for the longer period Indian tax and company law requires, and survive account closure for that reason.',
                'Operational telemetry is retained for 90 days. Webhook delivery records are retained for 90 days after reaching a terminal state.',
                'When a retention period ends, data is deleted or irreversibly de-identified.',
            ],
        },
        {
            id: 'rights',
            heading: 'Your rights',
            body: [
                'You have the right to know what personal data is held about you and how it is processed; to have inaccurate data corrected; to have data erased where no legal duty requires us to keep it; to withdraw consent for optional processing; and to nominate someone to exercise these rights if you die or become incapacitated.',
                'Merchants: exercise these against us at the contact route below, or from your account settings where the action is self-service.',
                'Shoppers: exercise these against the store you bought from. If a store will not respond, escalate through our grievance process and we will act.',
                'We respond within the time the DPDP Rules require, and will tell you if a legal obligation prevents us from acting on part of a request.',
            ],
        },
        {
            id: 'security',
            heading: 'How it is protected',
            body: [
                'Data is encrypted in transit and at rest. Tenant isolation is enforced in the database itself, so an application-layer mistake does not expose another store.',
                'Actions that move money or change payout destinations require verification beyond a password.',
                'The Security Practices page describes the controls in more detail.',
            ],
        },
        {
            id: 'children',
            heading: 'Children',
            body: [
                'LetBuyy is not intended for children. Merchant accounts require you to be old enough to enter a contract.',
                'The DPDP Act requires verifiable parental consent before processing a child\'s data and prohibits behavioural advertising directed at children. Merchants selling to children are responsible for meeting that standard in their own store.',
            ],
        },
        {
            id: 'changes',
            heading: 'Changes',
            body: [
                'Material changes are notified to account holders by email before they take effect. The revision date at the top of this page always reflects the current text.',
            ],
        },
    ],
}

export const cookies: LegalDocument = {
    slug: 'cookies',
    title: 'Cookie Policy',
    shortTitle: 'Cookies',
    purpose: 'What we store in your browser and what you can turn off.',
    audience: 'everyone',
    group: 'data',
    summary: [
        'Some cookies are required for the site to work at all — signing in, keeping a cart, blocking bots.',
        'Analytics and personalisation are optional and off until you turn them on.',
        'You can change your choices at any time from the control in the footer.',
    ],
    clauses: [
        {
            id: 'essential',
            heading: 'Essential — always on',
            body: [
                'These cannot be turned off because without them the service does not function.',
            ],
            list: [
                'Session cookies that keep you signed in to a merchant account or a storefront',
                'Cart state, so a shopper does not lose their basket between pages',
                'Security tokens that prevent cross-site request forgery',
                'Bot-protection tokens set when you register or sign in',
                'Load-balancing and routing values that send your request to the right store',
            ],
        },
        {
            id: 'optional',
            heading: 'Optional — off until you allow them',
            body: [
                'Analytics tells us which pages are used and where people get stuck, so we can fix the parts that do not work. Personalisation remembers non-sensitive preferences between visits.',
                'Neither is set before you consent, and neither is required to use the site.',
            ],
        },
        {
            id: 'stores',
            heading: 'Cookies on merchant storefronts',
            body: [
                'A storefront may set additional cookies through apps or analytics the merchant has installed. Those are the merchant\'s choice and are covered by that store\'s own privacy notice.',
                'Merchants are responsible for disclosing what they add. We provide the mechanism, not the decision.',
            ],
        },
        {
            id: 'control',
            heading: 'Changing your choices',
            body: [
                'Use the privacy control in the footer of any LetBuyy page. Changes apply immediately.',
                'Your browser can also block or clear cookies. Blocking essential cookies will break sign-in and checkout — that is a consequence of blocking them, not a fault.',
            ],
        },
    ],
}

export const dataProcessing: LegalDocument = {
    slug: 'data-processing',
    title: 'Data Processing Addendum',
    shortTitle: 'DPA',
    purpose: 'The terms under which LetBuyy processes your shoppers\' data for you.',
    audience: 'merchants',
    group: 'data',
    summary: [
        'When your store holds customer data, you are the Data Fiduciary and LetBuyy is your Processor.',
        'We act on your instruction, do not use your customer data for our own purposes, and hold our sub-processors to the same terms.',
        'This addendum forms part of your agreement with us and applies automatically — there is nothing to sign.',
    ],
    clauses: [
        {
            id: 'roles',
            heading: 'Roles',
            body: [
                'You determine what personal data your store collects from shoppers and why. That makes you the Data Fiduciary under the DPDP Act, and the equivalent of a controller under other regimes.',
                'We process that data solely to provide the platform to you. That makes us your Processor. We do not decide the purposes and we do not process for our own.',
            ],
        },
        {
            id: 'instructions',
            heading: 'Our instructions',
            body: [
                'We process shopper data only as needed to deliver the service, to keep it secure, and where a law compels us. Your configuration of the platform is your instruction.',
                'If a legal requirement forces us to process beyond your instruction, we will tell you before doing so unless the law forbids notice.',
            ],
        },
        {
            id: 'confidentiality',
            heading: 'Confidentiality and access',
            body: [
                'Access to production data is limited to personnel who need it, is authenticated individually, and is logged.',
                'Everyone with such access is bound by confidentiality obligations that survive the end of their engagement.',
            ],
        },
        {
            id: 'subprocessors',
            heading: 'Sub-processors',
            body: [
                'We use the sub-processors listed in the Sub-processor Register, each bound to obligations no weaker than these.',
                'We will give notice before adding a sub-processor that handles shopper personal data, so you have a chance to object. Objecting may mean you cannot continue using the affected feature.',
                'We remain responsible to you for our sub-processors\' performance.',
            ],
        },
        {
            id: 'security',
            heading: 'Security measures',
            body: [
                'Encryption in transit and at rest; per-tenant isolation enforced at the database layer; least-privilege access; step-up authentication on money-moving operations; signed webhooks and queue messages; and monitoring of access to production systems.',
                'The Security Practices page describes these in more detail. We may improve a measure but will not materially weaken the overall level of protection.',
            ],
        },
        {
            id: 'breach',
            heading: 'Personal data breach',
            body: [
                'If we become aware of a breach affecting your shoppers\' data, we will notify you without undue delay with what we know: what happened, what data and how many people are affected, what we are doing, and what you should do.',
                'The DPDP Rules require the Data Fiduciary to notify affected individuals and the Board. Since that is you, we will give you what you need to meet that duty on time.',
            ],
        },
        {
            id: 'assistance',
            heading: 'Helping you answer your shoppers',
            body: [
                'When a shopper exercises a right against you, we make the underlying data available to you through the dashboard and the APIs so you can answer without needing us in the loop.',
                'For anything the tooling does not cover, ask and we will help within the time your legal deadline allows.',
            ],
        },
        {
            id: 'deletion',
            heading: 'Return and deletion',
            body: [
                'Export your data at any time while your account is open. Do it before you close the account — that is the point at which it becomes hard.',
                'After closure, data is deleted at the end of the wind-down period, except records we are legally required to retain — principally invoices, orders, and ledger entries under tax and company law.',
                'Backups age out on their own cycle rather than being individually edited, so deletion from backups completes when the backup expires.',
            ],
        },
        {
            id: 'location',
            heading: 'Where data is processed',
            body: [
                'We prefer Indian regions for primary data storage. Some sub-processors operate globally distributed infrastructure, and the register states where each one runs.',
                'The DPDP Act permits transfer outside India except to countries the government restricts. We will comply with any such restriction if one is notified.',
            ],
        },
        {
            id: 'audit',
            heading: 'Demonstrating compliance',
            body: [
                'We will provide the information reasonably needed to show we meet this addendum. Where an audit right applies, it is exercised on reasonable notice, no more than once a year absent a breach, and without compromising other merchants\' data.',
            ],
        },
    ],
}

export const subprocessors: LegalDocument = {
    slug: 'subprocessors',
    title: 'Sub-processor Register',
    shortTitle: 'Sub-processors',
    purpose: 'Every third party that touches data on LetBuyy, and what for.',
    audience: 'merchants',
    group: 'data',
    summary: [
        'This is the complete list of providers that process data as part of running LetBuyy.',
        'Each entry states what it does and whether it can reach personal data.',
        'We give notice before adding a sub-processor that handles shopper personal data.',
    ],
    clauses: [
        {
            id: 'infrastructure',
            heading: 'Infrastructure and hosting',
            body: [
                'These run the platform itself and necessarily hold the data stored in it.',
            ],
            list: [
                'Supabase — primary database, authentication storage, and file storage. Holds merchant and shopper personal data.',
                'Cloudflare — edge network, DNS, custom-domain routing, bot protection, and the workers that run the API gateway and background jobs. Sees request metadata and traffic in transit.',
                'Vercel — hosting for the web applications. Sees request metadata and server logs.',
            ],
        },
        {
            id: 'payments',
            heading: 'Payments',
            body: [
                'Razorpay — payment processing, settlement to merchant bank accounts, and refunds. Collects payment credentials directly from shoppers; we hold references, not card numbers. Razorpay is a Reserve Bank of India authorised payment aggregator and is a Data Fiduciary in its own right for the payment data it collects.',
            ],
        },
        {
            id: 'communications',
            heading: 'Communications',
            body: [
                'Resend — transactional email delivery: order confirmations, account notices, password resets. Processes recipient email addresses and message content.',
            ],
        },
        {
            id: 'logistics',
            heading: 'Shipping and logistics',
            body: [
                'Where a merchant connects a courier, that courier receives the delivery address and contact details needed to complete the shipment. Integrations currently available include Shiprocket and Delhivery.',
                'These are connected per store by the merchant. A store that does not connect one does not send data to it.',
            ],
        },
        {
            id: 'operations',
            heading: 'Monitoring and operations',
            body: [
                'Sentry — error monitoring. Receives stack traces and request context; configured to scrub credentials and personal data from payloads.',
                'Cloudflare Turnstile — bot protection at registration and login. Receives a challenge token and IP address, not account contents.',
                'Cloudflare Analytics Engine — aggregated operational metrics. Designed for counts and timings rather than individual records.',
            ],
        },
        {
            id: 'notice',
            heading: 'Changes to this register',
            body: [
                'We will update this page and notify merchant account holders before a new sub-processor that handles shopper personal data begins processing.',
                'Removing a sub-processor does not require notice.',
            ],
            note: 'Apps a merchant installs from the marketplace are not our sub-processors. They are separate processors the merchant engages directly, and their data handling is disclosed in their own listing.',
        },
    ],
}
