import type { LegalDocument } from '../types'

/**
 * The platform-vs-seller distinction runs through every document here and is
 * the load-bearing idea in all of them: LetBuyy provides the software, the
 * merchant is the seller of record. It is not a drafting convenience — it is
 * what the architecture already does (each store is a tenant that sets its own
 * catalogue, shipping rates, and refund decisions), so the terms describe
 * reality rather than reshaping it.
 */

export const termsOfService: LegalDocument = {
    slug: 'terms',
    title: 'Terms of Service',
    shortTitle: 'Terms',
    purpose: 'The agreement between you and LetBuyy for using the platform.',
    audience: 'merchants',
    group: 'agreements',
    summary: [
        'LetBuyy gives you software to run an online store. You remain the seller — your customers buy from you, not from us.',
        'You keep ownership of your products, content, customer list, and data. We do not sell your catalogue or compete with you.',
        'We charge no commission on your sales. Payment providers charge their own fees, which we do not control or receive.',
        'You are responsible for what you sell, what you tell customers, and the taxes you owe. We are responsible for the platform working.',
    ],
    clauses: [
        {
            id: 'scope',
            heading: 'What this agreement covers',
            body: [
                'These terms apply when you create a LetBuyy account, open a store, or use any part of the platform — the merchant dashboard, storefronts on a letbuyy.com subdomain or your own domain, the mobile merchant app, themes, apps, and the APIs.',
                'If you use LetBuyy on behalf of a company, you confirm you are authorised to bind that company, and "you" means the company.',
            ],
            note: 'Separate documents govern payouts, refunds, data processing, and marketplace publishing. Where a specialised document conflicts with these terms, the specialised one governs that subject.',
        },
        {
            id: 'roles',
            heading: 'Who sells to your customers',
            body: [
                'LetBuyy is a technology provider. When a shopper buys from a store built on LetBuyy, the contract of sale is between that shopper and you. We are not a party to it, do not take title to your goods, and do not act as your agent.',
                'This means the obligations that attach to a seller attach to you: describing goods accurately, honouring the delivery timelines you publish, processing returns under your stated policy, issuing tax invoices, and answering your customers.',
                'We may display your store name, logo, or storefront in examples of platform capability. Tell us to stop and we will.',
            ],
        },
        {
            id: 'account',
            heading: 'Your account',
            body: [
                'You need an account to open a store. Keep your credentials confidential — activity under your account is treated as yours. Tell us immediately if you believe someone else has access.',
                'Sensitive actions such as issuing refunds and changing payout destinations require additional verification beyond your password. This is deliberate and cannot be disabled.',
                'One person or company may operate multiple stores. Each store is isolated: its data is not readable from another store, including your own.',
            ],
        },
        {
            id: 'your-content',
            heading: 'Your content and data',
            body: [
                'You own your product catalogue, media, storefront content, customer records, and order history. Using LetBuyy does not transfer any of it to us.',
                'You grant us the limited licence needed to actually run the service — to store your content, serve it to shoppers, back it up, index it for search within your own store, and transmit it to the providers listed in our sub-processor register.',
                'We do not sell your data, do not use your customer list to market to your customers, and do not use your catalogue to build a competing product.',
            ],
        },
        {
            id: 'what-you-sell',
            heading: 'What you may sell',
            body: [
                'You are responsible for the legality of everything you list. Some categories are prohibited outright and some are restricted; both are set out in the Acceptable Use Policy, which forms part of this agreement.',
                'Payment providers and card networks impose their own category restrictions. A listing that we permit may still be refused by a payment provider, and we cannot override that.',
            ],
        },
        {
            id: 'fees',
            heading: 'Fees',
            body: [
                'LetBuyy charges no commission and no per-transaction platform fee on your sales. Subscription pricing, where it applies, is shown on the pricing page before you subscribe.',
                'Payment providers, shipping partners, and any paid apps you install charge their own fees directly. Those are not ours, we do not receive a share of them, and we cannot waive them.',
                'Where we owe GST on amounts we charge you, it is stated separately on our invoice.',
            ],
        },
        {
            id: 'availability',
            heading: 'Availability and changes',
            body: [
                'We work to keep the platform available and will give reasonable notice of planned maintenance that affects storefronts. We do not promise uninterrupted service.',
                'We may add, change, or remove features. Where a change removes something you depend on, we will give notice proportionate to the disruption and, where practical, a migration path.',
                'Some surfaces — the app marketplace, the theme marketplace, and the developer portal — are not open for new publishing. Their status is stated on the relevant pages and in the Marketplace Partner Terms.',
            ],
        },
        {
            id: 'suspension',
            heading: 'Suspension and termination',
            body: [
                'You may close your account at any time. Before you do, export what you need — see the Data Processing Addendum for what happens to your data afterwards.',
                'We may suspend a store immediately where it is being used for fraud, where it is causing harm to shoppers or to the platform, or where we are legally required to. Otherwise we will raise the problem with you and give you a reasonable chance to fix it first.',
                'Suspension does not extinguish money already owed to you. Funds already settled remain yours; funds held against open disputes are handled under the Payouts and Settlements policy.',
            ],
        },
        {
            id: 'liability',
            heading: 'Liability',
            body: [
                'The platform is provided as-is beyond the warranties we cannot exclude by law. We are not liable for your lost profits, lost sales, or lost data, or for the acts of your customers, suppliers, or the payment and shipping providers you choose.',
                'Where liability cannot be excluded, our total liability across all claims in any twelve-month period is limited to the fees you paid us in that period.',
                'Nothing in this clause limits liability for fraud, wilful misconduct, or anything else that cannot be limited under Indian law.',
            ],
            note: 'Because we charge no commission, the fee cap above may be zero for merchants on a free plan. That is the honest consequence of the pricing model and you should weigh it.',
        },
        {
            id: 'law',
            heading: 'Governing law and disputes',
            body: [
                'This agreement is governed by the laws of India.',
                'Talk to us first — most disputes resolve faster through the grievance process than through a court, and the Grievance Redressal policy sets out the timelines we hold ourselves to.',
            ],
        },
        {
            id: 'changes',
            heading: 'Changes to these terms',
            body: [
                'We will post a revised version here and update the revision date. For changes that materially reduce your rights or increase your obligations, we will notify account holders by email before the change takes effect.',
                'Continuing to use LetBuyy after a change takes effect means you accept the revised terms. If you do not, close your account before that date.',
            ],
        },
    ],
}

export const acceptableUse: LegalDocument = {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    shortTitle: 'Acceptable use',
    purpose: 'What may and may not be sold or done on LetBuyy.',
    audience: 'merchants',
    group: 'agreements',
    summary: [
        'Some things cannot be sold on LetBuyy at all. Others need a licence or extra checks before you can list them.',
        'These limits come from three places: Indian law, payment provider rules, and our own judgement about shopper harm.',
        'If you are unsure whether your category is allowed, ask before you build. We would rather answer early than suspend a working store.',
    ],
    clauses: [
        {
            id: 'prohibited',
            heading: 'Prohibited — never permitted',
            body: [
                'Listing any of the following will result in removal, and repeated or deliberate listing in account termination.',
            ],
            list: [
                'Narcotics, psychotropic substances, and drug paraphernalia',
                'Weapons, ammunition, explosives, and their components',
                'Wildlife products, protected species, and items banned under the Wildlife Protection Act',
                'Human organs, tissue, and bodily fluids',
                'Counterfeit goods and anything infringing another party\'s trademark or copyright',
                'Sexually explicit material and any material involving minors',
                'Stolen goods, and tools whose primary purpose is theft or unauthorised access',
                'Forged documents, identity documents, and government credentials',
                'Prescription medicines sold without the prescription and licence the law requires',
                'Multi-level marketing schemes, chain schemes, and money-circulation schemes',
                'Unlicensed financial products, lending, or investment schemes',
                'Betting, gambling, and lottery services without the applicable state licence',
                'Cryptocurrency exchange or custody services',
            ],
        },
        {
            id: 'restricted',
            heading: 'Restricted — permitted with the right licence',
            body: [
                'These categories are legitimate but regulated. You may sell them once you hold the licence the law requires and have told us, and a payment provider may still decline the category independently.',
            ],
            list: [
                'Food, beverages, and supplements — FSSAI registration or licence',
                'Cosmetics and personal care — CDSCO registration where applicable',
                'Alcohol — the applicable state excise licence, where online sale is permitted at all',
                'Tobacco and nicotine products, subject to COTPA restrictions',
                'Medical devices and diagnostic products',
                'Ayurvedic, Siddha, Unani, and homoeopathic preparations — AYUSH licensing',
                'Precious metals, gemstones, and jewellery — hallmarking obligations',
                'Pesticides, agricultural chemicals, and seeds',
                'Second-hand and refurbished electronics, which must be described as such',
                'Digital goods and subscriptions, which must state renewal terms before purchase',
            ],
        },
        {
            id: 'conduct',
            heading: 'How you must behave',
            body: [
                'Beyond what you sell, how you operate matters. You must not:',
            ],
            list: [
                'Describe goods inaccurately, or hide charges until checkout',
                'Publish fake reviews, fake scarcity, or fake discount reference prices',
                'Collect payment for goods you have no intention or ability to deliver',
                'Use a storefront primarily to test stolen payment credentials',
                'Send unsolicited marketing to people who did not consent',
                'Impersonate another business, or imply a LetBuyy endorsement you do not have',
                'Publish content that harasses, defames, or incites violence against any person or group',
            ],
        },
        {
            id: 'technical',
            heading: 'Technical limits',
            body: [
                'The platform is shared infrastructure. You must not attempt to reach another store\'s data, probe for vulnerabilities outside a disclosure programme, run automated traffic that degrades service for others, or circumvent rate limits and bot protection.',
                'Themes and apps must not exfiltrate shopper data, inject undisclosed tracking, or load code that changes behaviour after review.',
            ],
        },
        {
            id: 'enforcement',
            heading: 'How we enforce this',
            body: [
                'Most breaches get a notice and a window to fix. Fraud, shopper harm, and legal compulsion get immediate action, because waiting causes more damage than acting.',
                'Where we remove a listing or suspend a store, we tell you what triggered it and what would resolve it, unless a law forbids us from saying.',
                'You can escalate any enforcement decision through the grievance process.',
            ],
        },
    ],
}

export const apiTerms: LegalDocument = {
    slug: 'api-terms',
    title: 'Developer & API Terms',
    shortTitle: 'API terms',
    purpose: 'Rules for building against the LetBuyy APIs, webhooks, and themes.',
    audience: 'developers',
    group: 'agreements',
    summary: [
        'You may build integrations against LetBuyy for a merchant who has authorised you.',
        'API credentials are tied to a specific store. Using one to reach a different store is a breach, not a bug to exploit.',
        'Webhooks are signed. Verify the signature before you trust the payload — an unverified webhook endpoint is an open door.',
    ],
    clauses: [
        {
            id: 'access',
            heading: 'Getting access',
            body: [
                'API access is granted per store, by the merchant who owns that store. Credentials carry the scopes the merchant approved and nothing more.',
                'The developer portal is currently closed to new public app registrations. Existing integrations continue to work; new ones are onboarded case by case.',
            ],
        },
        {
            id: 'credentials',
            heading: 'Credentials',
            body: [
                'Treat API keys and secrets as you would a password. Do not commit them, do not ship them in client-side code, and do not share them between merchants.',
                'If a credential leaks, rotate it immediately and tell us. We would rather hear it from you.',
                'We may revoke a credential without notice if we see it being used from an unexpected pattern that suggests compromise.',
            ],
        },
        {
            id: 'tenancy',
            heading: 'Store isolation',
            body: [
                'Every record on LetBuyy belongs to exactly one store, and that boundary is enforced in the database, not just in application code.',
                'Deliberately probing for cross-store access is a breach of these terms and, depending on what you reach, an offence under the Information Technology Act.',
                'If you find a way across that boundary, report it rather than using it. We will not pursue a good-faith reporter who stops at proof and tells us promptly.',
            ],
        },
        {
            id: 'webhooks',
            heading: 'Webhooks',
            body: [
                'Webhook payloads are signed with a shared secret. Verify the signature on every delivery using a constant-time comparison before acting on the contents.',
                'Deliveries may arrive more than once. Make your handler idempotent — key on the event id, not on the fact that a request arrived.',
                'Endpoints that fail repeatedly are backed off and eventually disabled. Delivery records are retained for 90 days, which is your window to reconcile a gap.',
            ],
            note: 'An endpoint that skips signature verification will accept anything anyone sends it. This is the single most common integration vulnerability we see.',
        },
        {
            id: 'rate-limits',
            heading: 'Rate limits and fair use',
            body: [
                'The APIs are rate limited. Handle a 429 by backing off, not by retrying immediately from more workers.',
                'Do not poll for changes you could receive as a webhook. Polling at high frequency across many stores is the fastest way to get throttled.',
            ],
        },
        {
            id: 'data',
            heading: 'Merchant and shopper data',
            body: [
                'Data you reach through the API belongs to the merchant, and often describes their customers. You may use it only to provide the function the merchant installed you for.',
                'You may not build a profile of shoppers across merchants, sell derived data, or retain data after the merchant uninstalls you beyond what law requires.',
                'If you process personal data on a merchant\'s behalf, you are their processor and the obligations in the Data Processing Addendum apply to you too.',
            ],
        },
        {
            id: 'themes',
            heading: 'Themes',
            body: [
                'Theme templates are rendered through a sanitiser that escapes output and blocks a fixed list of dangerous constructs. Do not attempt to defeat it.',
                'A theme must not load third-party scripts that were not disclosed at review, collect shopper input beyond what the storefront needs, or alter checkout behaviour.',
            ],
        },
    ],
}

export const marketplaceTerms: LegalDocument = {
    slug: 'marketplace',
    title: 'Marketplace Partner Terms',
    shortTitle: 'Marketplace',
    purpose: 'Terms for publishing apps and themes to LetBuyy merchants.',
    audience: 'developers',
    group: 'agreements',
    summary: [
        'These terms apply if you publish an app or theme that other merchants install.',
        'The app and theme marketplaces are currently closed to new public submissions. Existing listings remain governed by this document.',
        'You are responsible for your listing working, for supporting it, and for what it does with merchant and shopper data.',
    ],
    clauses: [
        {
            id: 'status',
            heading: 'Current marketplace status',
            body: [
                'The app marketplace, theme marketplace, and developer portal are frozen for new public submissions while the platform completes its launch scope.',
                'This is a product state, not a permanent decision. Listings already published continue to operate and are governed by these terms.',
            ],
        },
        {
            id: 'review',
            heading: 'Review and approval',
            body: [
                'Submissions are reviewed before they reach merchants. Review covers functionality, the permissions requested, data handling, and whether the listing describes what it actually does.',
                'Approval is not an endorsement and does not transfer responsibility for your code to us.',
                'We may re-review a listing at any time, particularly after an update, and may unlist it if it no longer matches what was approved.',
            ],
        },
        {
            id: 'permissions',
            heading: 'Permissions',
            body: [
                'Request the narrowest scopes your listing actually needs. A listing that requests broad access without a stated reason will not pass review.',
                'If an update needs a wider scope, the merchant must be asked again. Silently widening access is grounds for removal.',
            ],
        },
        {
            id: 'support',
            heading: 'Support and lifecycle',
            body: [
                'You support your own listing. Publish a working contact route and respond to merchants within a reasonable time.',
                'If you discontinue a listing, give installed merchants notice and a way to export any data your listing holds. Vanishing without notice is a breach.',
            ],
        },
        {
            id: 'commercial',
            heading: 'Commercial terms',
            body: [
                'Where a listing is paid, the revenue share and settlement schedule are set out in your partner agreement rather than here, because they vary by listing type.',
                'You are responsible for the tax treatment of your own earnings, including GST registration where your turnover requires it.',
            ],
        },
        {
            id: 'removal',
            heading: 'Removal',
            body: [
                'We may remove a listing that breaks, that misrepresents itself, that mishandles data, or that breaches the Acceptable Use Policy.',
                'Where removal is not urgent, we will tell you first and give you a chance to fix the problem. Where shopper data is at risk, we act first and explain after.',
            ],
        },
    ],
}
