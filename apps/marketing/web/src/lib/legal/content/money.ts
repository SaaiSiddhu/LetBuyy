import type { LegalDocument } from '../types'

/**
 * Payment aggregators require a merchant's site to carry refund, shipping,
 * pricing, and contact policies before onboarding. These four documents cover
 * that surface for LetBuyy itself, and double as the reference a merchant
 * copies when writing their own store policies.
 *
 * The recurring caveat throughout: LetBuyy sets the mechanism, the merchant
 * sets the terms. A shopper's refund window is the merchant's decision; what
 * we describe is how the money actually moves once that decision is made.
 */

export const billing: LegalDocument = {
    slug: 'billing',
    title: 'Billing, Plans & Taxes',
    shortTitle: 'Billing',
    purpose: 'What LetBuyy charges you, when, and how tax is handled.',
    audience: 'merchants',
    group: 'money',
    summary: [
        'LetBuyy takes no commission on your sales and charges no per-transaction platform fee.',
        'Where a plan carries a subscription price, it is shown on the pricing page before you subscribe and billed in advance.',
        'Payment providers, shipping partners, and paid apps bill you separately. Those fees are theirs, not ours.',
    ],
    clauses: [
        {
            id: 'commission',
            heading: 'No commission',
            body: [
                'We do not take a percentage of your sales, and we do not add a platform fee to your transactions. Your revenue arrives from your payment provider without a deduction by us.',
                'This is a pricing commitment, not an introductory offer. If it ever changes, existing merchants get notice before the change applies to them.',
            ],
        },
        {
            id: 'third-party',
            heading: 'Fees we do not control',
            body: [
                'Your payment provider charges a processing fee on each transaction, set by them and visible in their dashboard. Shipping partners charge for shipments. Paid apps charge their own subscription.',
                'None of these flow through us and we receive no share of them. We cannot waive, refund, or negotiate them on your behalf.',
            ],
        },
        {
            id: 'subscription',
            heading: 'Subscription billing',
            body: [
                'Paid plans are billed in advance for the period you select. The price, currency, and period are shown before you confirm.',
                'Plan changes take effect from the next billing period unless the change is an upgrade, which takes effect immediately with a pro-rated charge.',
                'If a subscription payment fails, we retry and notify you. Extended non-payment moves the store to a restricted state rather than deleting it — see the Data Processing Addendum for retention.',
            ],
        },
        {
            id: 'gst-ours',
            heading: 'GST on what we charge you',
            body: [
                'Where LetBuyy charges you and GST applies, it is stated separately on our invoice along with our GSTIN.',
                'Provide your GSTIN in your account settings if you want it on our invoices. We cannot reissue a past invoice to add a GSTIN that was not on file when it was raised.',
            ],
        },
        {
            id: 'gst-yours',
            heading: 'GST on what you sell',
            body: [
                'Tax on your sales is yours to charge, collect, and remit. The platform computes GST server-side from the rates and place-of-supply rules configured for your store, and issues an invoice against each order.',
                'Invoices are immutable once issued. A correction is made by a credit note against the original, never by editing it — this is both a legal requirement and how the ledger is built.',
                'Configuring the wrong HSN code or rate produces a wrong invoice. The computation is ours; the configuration is yours.',
            ],
            note: 'We provide tax computation, not tax advice. Whether you must register for GST, and at what rate you must charge, is a question for your accountant.',
        },
        {
            id: 'records',
            heading: 'Records',
            body: [
                'Invoices, orders, and the payment ledger are retained for the period Indian tax and company law requires, which is longer than the retention period for ordinary account data.',
                'You can export your own records at any time from the dashboard.',
            ],
        },
    ],
}

export const payouts: LegalDocument = {
    slug: 'payouts',
    title: 'Payouts & Settlements',
    shortTitle: 'Payouts',
    purpose: 'How money from your sales reaches your bank account.',
    audience: 'merchants',
    group: 'money',
    summary: [
        'Money from card, UPI, and netbanking orders is collected by your payment provider and settled to your bank account on their schedule.',
        'LetBuyy does not hold your money. We record what is owed; the provider moves it.',
        'Cash-on-delivery money reaches you through your courier, not through the payment provider or us.',
    ],
    clauses: [
        {
            id: 'flow',
            heading: 'Where the money actually sits',
            body: [
                'For online payments, funds move from the shopper to your payment provider, and from the provider to your bank account. They do not pass through a LetBuyy account.',
                'We maintain the ledger — what was charged, captured, refunded, and owed — and reconcile it against the provider. The ledger is the record; the provider is the custodian.',
                'This matters if something goes wrong: a settlement that has not arrived is a question for your provider, and we can show you exactly what the ledger says to support that conversation.',
            ],
        },
        {
            id: 'schedule',
            heading: 'Settlement timing',
            body: [
                'Your settlement cycle is set by your payment provider and shown in their dashboard. Typical cycles for Indian merchants run from same-day to T+3 business days, and new accounts often start on a longer cycle.',
                'Bank holidays and weekends shift settlement. A payment captured on a Friday evening commonly settles the following week.',
            ],
        },
        {
            id: 'cod',
            heading: 'Cash on delivery',
            body: [
                'For COD orders, your courier collects cash from the shopper and remits it to you under your agreement with them, on their own cycle. No payment provider is involved.',
                'The platform records a COD order as pending until you confirm collection, so your ledger reflects money actually received rather than money expected.',
                'COD remittance disputes are between you and your courier. We can evidence what was ordered and marked delivered.',
            ],
        },
        {
            id: 'holds',
            heading: 'Holds and reserves',
            body: [
                'Payment providers may hold a rolling reserve against a merchant account, or hold specific funds pending a chargeback. That decision is theirs and is governed by your agreement with them.',
                'Where we are told funds are held, we reflect it in your dashboard so the number you see matches the number you will receive.',
            ],
        },
        {
            id: 'chargebacks',
            heading: 'Chargebacks and disputes',
            body: [
                'When a shopper disputes a card payment, the provider debits the amount pending resolution and asks for evidence. The window is short — often seven days.',
                'You respond to the dispute; we supply the order, delivery, and communication records to help you do it. We cannot represent you to the network.',
                'Repeated chargebacks put your payment account at risk with the provider, independently of anything we do.',
            ],
        },
        {
            id: 'changes',
            heading: 'Changing your payout destination',
            body: [
                'Changing the bank account money settles to requires step-up verification beyond your password. This cannot be turned off.',
                'This is the single most attractive target on any commerce account. The friction is intentional.',
            ],
            note: 'We will never email or call you asking to confirm bank details. If someone does, it is not us — report it through the grievance process.',
        },
        {
            id: 'closure',
            heading: 'If you close your store',
            body: [
                'Closing a LetBuyy store does not close your payment provider account, and does not stop settlements already in flight.',
                'Settle open orders and let the dispute window pass before closing either. Money owed to you does not disappear because the storefront is gone.',
            ],
        },
    ],
}

export const refunds: LegalDocument = {
    slug: 'refunds',
    title: 'Refunds & Cancellations',
    shortTitle: 'Refunds',
    purpose: 'How refunds work on LetBuyy — and who decides them.',
    audience: 'everyone',
    group: 'money',
    summary: [
        'If you bought something from a store built on LetBuyy, your refund is decided by that store under its own policy — not by us.',
        'Once a merchant issues a refund, the money returns by the route it was paid, and the timing is set by your bank.',
        'This page also covers refunds of what LetBuyy charges merchants directly.',
    ],
    clauses: [
        {
            id: 'shoppers',
            heading: 'If you bought from a store on LetBuyy',
            body: [
                'Your purchase contract is with the store, not with LetBuyy. The store sets its return window, its condition requirements, and who pays return shipping, and publishes them in its own refund policy.',
                'Contact the store first — its contact details are in the storefront footer and on your order confirmation. It can see your order and act on it; we cannot act on it for them.',
                'If a store will not respond or refuses to honour its own published policy, escalate to us through the grievance process. We can reach the merchant and, where a store is behaving badly, act against it.',
            ],
            note: 'We cannot force a merchant to refund you, and we cannot refund you from our own funds. What we can do is escalate, evidence, and enforce our policies against a store that misbehaves.',
        },
        {
            id: 'mechanism',
            heading: 'How a refund travels',
            body: [
                'Refunds return by the original payment route. A card payment goes back to that card; UPI goes back to the paying account. We cannot redirect a refund to a different destination.',
                'Once the merchant issues it, the payment provider processes it and the shopper\'s bank credits it. Typical end-to-end time for Indian banks is five to seven business days, sometimes longer for credit cards where it appears on the next statement.',
                'The delay after the merchant acts is bank-side. A merchant showing "refunded" and a bank not yet showing the credit is the normal state for several days.',
            ],
        },
        {
            id: 'cod-refunds',
            heading: 'Refunds on cash-on-delivery orders',
            body: [
                'There is no original payment route to reverse, so a COD refund is paid out separately — usually by bank transfer or UPI to details the shopper provides.',
                'That makes COD refunds slower and more manual than online-payment refunds, and it makes them a common target for impersonation. A shopper should only ever give refund details to the store they actually bought from.',
            ],
        },
        {
            id: 'partial',
            heading: 'Partial refunds and gift cards',
            body: [
                'A merchant can refund part of an order — a single item, or an amount. The ledger records each movement against the original order, so a partially refunded order stays reconcilable.',
                'Where an order was paid partly with a gift card, the gift-card portion is restored to the gift card and the remainder returns to the payment method. The balance is rebuilt from the ledger rather than adjusted directly, so it cannot drift.',
            ],
        },
        {
            id: 'merchants',
            heading: 'For merchants: your obligations',
            body: [
                'You must publish a refund policy on your storefront. Payment providers require it before they will onboard you, and consumer law requires you to honour what you publish.',
                'State the return window, the condition goods must be in, who pays return shipping, and how long a refund takes. Vague policies generate disputes you will lose.',
                'You may not charge a cancellation fee that you do not also bear when you are the one cancelling.',
            ],
        },
        {
            id: 'step-up',
            heading: 'For merchants: refund controls',
            body: [
                'Issuing a refund requires step-up verification. Refunds are irreversible once processed and are an obvious target if an account is compromised.',
                'Every refund is recorded against the order with the account that authorised it. This is your audit trail in a dispute.',
            ],
        },
        {
            id: 'platform-fees',
            heading: 'Refunds of LetBuyy subscription fees',
            body: [
                'Subscription fees are charged in advance. If you cancel mid-period, your plan runs to the end of the period you paid for and does not renew; we do not pro-rate the unused part.',
                'If we charged you in error, tell us and we will correct it — that is a mistake, not a cancellation.',
            ],
        },
    ],
}

export const shipping: LegalDocument = {
    slug: 'shipping',
    title: 'Shipping & Delivery',
    shortTitle: 'Shipping',
    purpose: 'How delivery works, and where responsibility for it sits.',
    audience: 'everyone',
    group: 'money',
    summary: [
        'Every store on LetBuyy sets its own shipping rates, zones, and delivery timelines. There is no platform-wide shipping policy that overrides them.',
        'Shopper-facing delivery obligations belong to the store you bought from.',
        'This page explains the mechanism the platform provides and what each side is responsible for.',
    ],
    clauses: [
        {
            id: 'who',
            heading: 'Who ships your order',
            body: [
                'The merchant does. LetBuyy provides the software that calculates a rate at checkout and records fulfilment; it does not warehouse goods, pack them, or hand them to a courier.',
                'The courier is chosen by the merchant. Delivery performance is a matter between the merchant and that courier.',
            ],
        },
        {
            id: 'rates',
            heading: 'How shipping is calculated',
            body: [
                'Merchants configure shipping rates by zone — commonly by pincode range, state, or weight band. At checkout, the platform resolves the applicable rate for the delivery address and adds it to the order total server-side.',
                'The total a shopper is charged is computed on our servers from the merchant\'s configuration, never from values the browser sends. This is why a shipping amount cannot be altered by tampering with the checkout page.',
                'If no rate matches an address, the store cannot deliver there and checkout will say so rather than guessing.',
            ],
        },
        {
            id: 'timelines',
            heading: 'Delivery timelines',
            body: [
                'Timelines shown at checkout are the merchant\'s estimates for their courier and zone. They are estimates, not guarantees, and are affected by weather, festivals, strikes, and regional restrictions.',
                'Consumer law requires a seller to deliver within the time stated, or within a reasonable time where none is stated. That obligation is the merchant\'s.',
            ],
        },
        {
            id: 'tracking',
            heading: 'Tracking and delivery confirmation',
            body: [
                'Where the merchant supplies a tracking reference, it appears on the order and in the shopper\'s confirmation email. Tracking data comes from the courier and is only as current as they make it.',
                'A courier marking an order delivered is the courier\'s record. Where a shopper disputes it, the merchant investigates with the courier.',
            ],
        },
        {
            id: 'cod-shipping',
            heading: 'Cash on delivery',
            body: [
                'Not every courier serves every pincode for COD, and many impose an order-value ceiling. A store may therefore offer COD in some places and not others.',
                'Where a COD order is refused at the door, the goods return to the merchant and the merchant bears the return freight under their courier agreement.',
            ],
        },
        {
            id: 'damage',
            heading: 'Lost, damaged, and undelivered',
            body: [
                'Risk in the goods passes on delivery. Until then, a lost or damaged parcel is the merchant\'s problem to resolve with the shopper, whatever they later recover from the courier.',
                'Shoppers should raise a damaged delivery with the store promptly and keep the packaging — courier claims usually require it.',
            ],
        },
        {
            id: 'merchant-duties',
            heading: 'For merchants: what you must publish',
            body: [
                'Publish your delivery timelines, serviceable areas, shipping charges, and what happens when a delivery fails. Payment providers require a shipping policy for physical goods before onboarding, and consumer law requires the information before purchase.',
                'Keep serviceability current. A store that accepts orders it cannot deliver generates refunds, disputes, and eventually payment-provider scrutiny.',
            ],
        },
    ],
}
