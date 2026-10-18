/**
 * Canonical domain status presentation.
 *
 * ONE exhaustive, exact-match mapping per domain status, owned by the domain
 * layer rather than by app pages or by a generic string matcher.
 *
 * Why this module exists
 * ---------------------
 * Status→appearance logic had fragmented into ~126 local mappers across the
 * apps, and the shared fallback (`statusToBadgeVariant` in `@letbuyy/ui`) matched
 * by SUBSTRING — so `"unpaid".includes("paid")`, `"inactive".includes("active")`
 * and `"unverified".includes("verified")` all resolved to SUCCESS. Exact-match
 * records make that class of bug unrepresentable.
 *
 * Two hard rules
 * --------------
 * 1. NO REACT. Everything here is serializable data: a label, a tone, and
 *    optional icon/accessibility keys. The UI layer resolves a tone to a visual
 *    treatment; the domain layer never imports a component or a CSS token.
 * 2. THE DATABASE IS AUTHORITATIVE. Every union below mirrors the live CHECK
 *    constraint for its column, not the historical Zod schema — several of those
 *    schemas have drifted (see STATUS_SCHEMA_DRIFT at the end of this file).
 *
 * Exhaustiveness is enforced by the compiler: `StatusPresentationMap<T>` is a
 * `Record<T, …>`, so a missing member is a type error and an unknown member is a
 * type error. Runtime coverage against the DB vocabulary is asserted by
 * `packages/shared-types/tests/status-presentation.test.mjs`.
 */

/**
 * Canonical semantic tone.
 *
 * Deliberately NOT the UI's `StatusVariant`: the domain layer must not depend on
 * the design system. `neutral` is the domain word for "no signal"; the UI maps it
 * onto whatever it calls that (today, `default`).
 */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical';

/** How a single domain status is presented to a user. Serializable by construction. */
export interface StatusPresentation {
    /** Product-facing label, already humanised — `Pending COD`, never `pending_cod`. */
    label: string;
    /** Canonical semantic tone. */
    tone: StatusTone;
    /** Optional semantic icon key. The UI resolves this to an actual icon. */
    iconKey?: string;
    /** Optional accessible name, when the visible label alone is not sufficient. */
    a11yLabel?: string;
}

/**
 * An exhaustive presentation map.
 *
 * `Record<T, …>` is the compile-time exhaustiveness test: adding a value to the
 * union without adding it here fails the build at every call site.
 */
export type StatusPresentationMap<T extends string> = Record<T, StatusPresentation>;

/**
 * What an unrecognised status renders as.
 *
 * Loud on purpose. An unknown value must fail visibly and observably — it must
 * never inherit a neutral tone, and it must never fall through to success.
 */
export function unknownStatusPresentation(value: string | null | undefined): StatusPresentation {
    const raw = typeof value === 'string' ? value.trim() : '';
    return {
        label: raw ? `Unknown: ${raw}` : 'Unknown status',
        tone: 'critical',
        a11yLabel: raw
            ? `Unrecognised status value ${raw}`
            : 'Status is missing or unrecognised',
    };
}

/**
 * Resolve a raw status into its presentation.
 *
 * Exact match only, after trimming and lower-casing. Anything unmapped resolves
 * to `unknownStatusPresentation`, which is `critical` — never silently neutral.
 */
export function presentStatus<T extends string>(
    map: StatusPresentationMap<T>,
    value: string | null | undefined,
): StatusPresentation {
    if (typeof value !== 'string') return unknownStatusPresentation(value);
    const key = value.trim().toLowerCase();
    return (map as Record<string, StatusPresentation | undefined>)[key]
        ?? unknownStatusPresentation(value);
}

/** True when `value` is a member of the map. Narrows for exhaustive handling. */
export function isKnownStatus<T extends string>(
    map: StatusPresentationMap<T>,
    value: string | null | undefined,
): value is T {
    if (typeof value !== 'string') return false;
    return Object.prototype.hasOwnProperty.call(map, value.trim().toLowerCase());
}

/* ────────────────────────────────────────────────────────────────────────────
   STORES — sites.*
   ──────────────────────────────────────────────────────────────────────────── */

/** `sites.status` — CHECK: draft | published | unpublished | frozen | suspended. */
export const SITE_STATUS_VALUES = ['draft', 'published', 'unpublished', 'frozen', 'suspended'] as const;
export type SiteStatus = typeof SITE_STATUS_VALUES[number];

export const SITE_STATUS_PRESENTATION: StatusPresentationMap<SiteStatus> = {
    draft: { label: 'Draft', tone: 'neutral', iconKey: 'draft', a11yLabel: 'Draft — not visible to shoppers' },
    published: { label: 'Published', tone: 'success', iconKey: 'live', a11yLabel: 'Published and visible to shoppers' },
    unpublished: { label: 'Unpublished', tone: 'warning', iconKey: 'hidden', a11yLabel: 'Unpublished — was live, now hidden' },
    frozen: { label: 'Frozen', tone: 'warning', iconKey: 'frozen', a11yLabel: 'Frozen — billing action required' },
    suspended: { label: 'Suspended', tone: 'critical', iconKey: 'blocked', a11yLabel: 'Suspended by LetBuyy' },
};

/** `sites.trial_status` — CHECK: active | grace | frozen | cancelled | paid. */
export type SiteTrialStatus = 'active' | 'grace' | 'frozen' | 'cancelled' | 'paid';

export const SITE_TRIAL_STATUS_PRESENTATION: StatusPresentationMap<SiteTrialStatus> = {
    active: { label: 'Trial active', tone: 'info', iconKey: 'trial' },
    grace: { label: 'Grace period', tone: 'warning', iconKey: 'clock', a11yLabel: 'Trial ended — in grace period' },
    frozen: { label: 'Frozen', tone: 'critical', iconKey: 'frozen', a11yLabel: 'Trial expired — store frozen' },
    cancelled: { label: 'Cancelled', tone: 'critical', iconKey: 'cancelled' },
    paid: { label: 'Paid', tone: 'success', iconKey: 'paid', a11yLabel: 'On a paid plan' },
};

/** `sites.custom_domain_status` — CHECK: none | pending | review | verifying | active | error. */
export const CUSTOM_DOMAIN_STATUS_VALUES = ['none', 'pending', 'review', 'verifying', 'active', 'error'] as const;
export type CustomDomainStatus = typeof CUSTOM_DOMAIN_STATUS_VALUES[number];

export const CUSTOM_DOMAIN_STATUS_PRESENTATION: StatusPresentationMap<CustomDomainStatus> = {
    none: { label: 'Not connected', tone: 'neutral', iconKey: 'unlinked' },
    pending: { label: 'Pending', tone: 'warning', iconKey: 'clock' },
    review: { label: 'In review', tone: 'warning', iconKey: 'review' },
    verifying: { label: 'Verifying', tone: 'info', iconKey: 'progress' },
    active: { label: 'Connected', tone: 'success', iconKey: 'linked' },
    error: { label: 'Error', tone: 'critical', iconKey: 'error' },
};

/** `sites.ssl_status` — CHECK: pending | active | failed. */
export type SslStatus = 'pending' | 'active' | 'failed';

export const SSL_STATUS_PRESENTATION: StatusPresentationMap<SslStatus> = {
    pending: { label: 'SSL pending', tone: 'warning', iconKey: 'clock' },
    active: { label: 'SSL active', tone: 'success', iconKey: 'lock' },
    failed: { label: 'SSL failed', tone: 'critical', iconKey: 'error' },
};

/* ────────────────────────────────────────────────────────────────────────────
   ORDERS & COD — orders.*
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * `orders.status` — CHECK (migration 147_executable_order_state_risk):
 * pending | pending_cod | confirmed | processing | shipped | delivered
 * | cancelled | refunded | returned | rto
 *
 * NOT the 7 values in the baseline migration, and NOT `OrderStatusSchema`, which
 * is still missing `returned` and `rto`.
 */
export const ORDER_STATUS_VALUES = [
    'pending', 'pending_cod', 'confirmed', 'processing', 'shipped',
    'delivered', 'cancelled', 'refunded', 'returned', 'rto',
] as const;
export type OrderStatus = typeof ORDER_STATUS_VALUES[number];

export const ORDER_STATUS_PRESENTATION: StatusPresentationMap<OrderStatus> = {
    pending: { label: 'Pending', tone: 'warning', iconKey: 'clock' },
    // COD and RTO are read as acronyms by Indian merchants. A generic humaniser
    // renders these as "Pending Cod" and "Rto", which reads as a typo.
    pending_cod: { label: 'Pending COD', tone: 'warning', iconKey: 'cash', a11yLabel: 'Pending cash-on-delivery confirmation' },
    confirmed: { label: 'Confirmed', tone: 'info', iconKey: 'check' },
    processing: { label: 'Processing', tone: 'info', iconKey: 'progress' },
    shipped: { label: 'Shipped', tone: 'info', iconKey: 'truck' },
    delivered: { label: 'Delivered', tone: 'success', iconKey: 'delivered' },
    cancelled: { label: 'Cancelled', tone: 'critical', iconKey: 'cancelled' },
    refunded: { label: 'Refunded', tone: 'critical', iconKey: 'refund' },
    returned: { label: 'Returned', tone: 'critical', iconKey: 'return' },
    rto: { label: 'RTO', tone: 'critical', iconKey: 'return', a11yLabel: 'Return to origin' },
};

/** `orders.payment_status` — CHECK: pending | paid | failed | refunded. */
export type OrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export const ORDER_PAYMENT_STATUS_PRESENTATION: StatusPresentationMap<OrderPaymentStatus> = {
    pending: { label: 'Pending', tone: 'warning', iconKey: 'clock' },
    paid: { label: 'Paid', tone: 'success', iconKey: 'paid' },
    failed: { label: 'Failed', tone: 'critical', iconKey: 'error' },
    refunded: { label: 'Refunded', tone: 'critical', iconKey: 'refund' },
};

/** `orders.cod_confirmation_status` — CHECK: not_required | requested | confirmed | rejected | expired. */
export type CodConfirmationStatus = 'not_required' | 'requested' | 'confirmed' | 'rejected' | 'expired';

export const COD_CONFIRMATION_STATUS_PRESENTATION: StatusPresentationMap<CodConfirmationStatus> = {
    not_required: { label: 'Not required', tone: 'neutral' },
    requested: { label: 'Confirmation requested', tone: 'warning', iconKey: 'clock' },
    confirmed: { label: 'COD confirmed', tone: 'success', iconKey: 'check', a11yLabel: 'Cash on delivery confirmed by the customer' },
    rejected: { label: 'COD rejected', tone: 'critical', iconKey: 'error', a11yLabel: 'Customer rejected cash on delivery' },
    expired: { label: 'Confirmation expired', tone: 'critical', iconKey: 'expired' },
};

/** `orders.fulfillment_state` — CHECK: unfulfilled | hold | partial | fulfilled | delivered | returned | rto | cancelled. */
export type OrderFulfillmentState =
    | 'unfulfilled' | 'hold' | 'partial' | 'fulfilled' | 'delivered' | 'returned' | 'rto' | 'cancelled';

export const ORDER_FULFILLMENT_STATE_PRESENTATION: StatusPresentationMap<OrderFulfillmentState> = {
    unfulfilled: { label: 'Unfulfilled', tone: 'warning', iconKey: 'clock' },
    hold: { label: 'On hold', tone: 'warning', iconKey: 'pause' },
    partial: { label: 'Partially fulfilled', tone: 'warning', iconKey: 'partial' },
    fulfilled: { label: 'Fulfilled', tone: 'success', iconKey: 'check' },
    delivered: { label: 'Delivered', tone: 'success', iconKey: 'delivered' },
    returned: { label: 'Returned', tone: 'critical', iconKey: 'return' },
    rto: { label: 'RTO', tone: 'critical', iconKey: 'return', a11yLabel: 'Return to origin' },
    cancelled: { label: 'Cancelled', tone: 'critical', iconKey: 'cancelled' },
};

/** `orders.refund_status` — CHECK: none | pending | processing | partially_refunded | refunded | failed. */
export type OrderRefundStatus = 'none' | 'pending' | 'processing' | 'partially_refunded' | 'refunded' | 'failed';

export const ORDER_REFUND_STATUS_PRESENTATION: StatusPresentationMap<OrderRefundStatus> = {
    none: { label: 'No refund', tone: 'neutral' },
    pending: { label: 'Refund pending', tone: 'warning', iconKey: 'clock' },
    processing: { label: 'Refund processing', tone: 'info', iconKey: 'progress' },
    partially_refunded: { label: 'Partially refunded', tone: 'warning', iconKey: 'partial' },
    refunded: { label: 'Refunded', tone: 'success', iconKey: 'refund', a11yLabel: 'Fully refunded to the customer' },
    failed: { label: 'Refund failed', tone: 'critical', iconKey: 'error' },
};

/* ────────────────────────────────────────────────────────────────────────────
   SUBSCRIPTIONS & BILLING
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * `subscriptions.status` — CHECK: active | cancelled | past_due | trialing.
 * Note `SubscriptionStatusSchema` additionally declares `expired`, which the
 * constraint cannot store.
 */
export const SUBSCRIPTION_STATUS_VALUES = ['trialing', 'active', 'past_due', 'cancelled'] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS_VALUES[number];

export const SUBSCRIPTION_STATUS_PRESENTATION: StatusPresentationMap<SubscriptionStatus> = {
    active: { label: 'Active', tone: 'success', iconKey: 'check' },
    trialing: { label: 'Trialing', tone: 'info', iconKey: 'trial' },
    past_due: { label: 'Past due', tone: 'warning', iconKey: 'overdue', a11yLabel: 'Payment past due' },
    cancelled: { label: 'Cancelled', tone: 'critical', iconKey: 'cancelled' },
};

/** `subscriptions.dunning_status` — CHECK: none | past_due | paused | resolved. */
export type SubscriptionDunningStatus = 'none' | 'past_due' | 'paused' | 'resolved';

export const SUBSCRIPTION_DUNNING_STATUS_PRESENTATION: StatusPresentationMap<SubscriptionDunningStatus> = {
    none: { label: 'None', tone: 'neutral' },
    past_due: { label: 'Past due', tone: 'warning', iconKey: 'overdue' },
    paused: { label: 'Paused', tone: 'warning', iconKey: 'pause' },
    resolved: { label: 'Resolved', tone: 'success', iconKey: 'check' },
};

/* ────────────────────────────────────────────────────────────────────────────
   PAYOUTS & SETTLEMENT
   ──────────────────────────────────────────────────────────────────────────── */

/** Provider instructions: `payouts.status`, separate from merchant statements. */
export const PAYOUT_STATUS_VALUES = ['scheduled', 'processing', 'paid', 'failed', 'cancelled'] as const;
export type PayoutStatus = typeof PAYOUT_STATUS_VALUES[number];

export const PAYOUT_STATUS_PRESENTATION: StatusPresentationMap<PayoutStatus> = {
    scheduled: { label: 'Scheduled', tone: 'info', iconKey: 'calendar' },
    processing: { label: 'Processing', tone: 'info', iconKey: 'progress' },
    paid: { label: 'Paid', tone: 'success', iconKey: 'paid', a11yLabel: 'Payout settled to your bank account' },
    failed: { label: 'Failed', tone: 'critical', iconKey: 'error' },
    cancelled: { label: 'Cancelled', tone: 'critical', iconKey: 'cancelled' },
};

/** Merchant readback: `payout_statements.status` (119, retained by 295/301). */
export const MERCHANT_PAYOUT_STATUS_VALUES = ['pending', 'processing', 'released', 'failed'] as const;
export type MerchantPayoutStatementStatus = typeof MERCHANT_PAYOUT_STATUS_VALUES[number];

export const MERCHANT_PAYOUT_STATUS_PRESENTATION: StatusPresentationMap<MerchantPayoutStatementStatus> = {
    pending: { label: 'Pending', tone: 'info', iconKey: 'calendar' },
    processing: { label: 'Processing', tone: 'info', iconKey: 'progress', a11yLabel: 'Release remains unconfirmed' },
    released: { label: 'Released', tone: 'success', iconKey: 'check', a11yLabel: 'Release recorded in the statement' },
    failed: { label: 'Failed', tone: 'critical', iconKey: 'error' },
};

/** `settlements.status` — CHECK: recorded | break_detected | failed. */
export type SettlementStatus = 'recorded' | 'break_detected' | 'failed';

export const SETTLEMENT_STATUS_PRESENTATION: StatusPresentationMap<SettlementStatus> = {
    recorded: { label: 'Recorded', tone: 'success', iconKey: 'check' },
    break_detected: { label: 'Break detected', tone: 'critical', iconKey: 'error', a11yLabel: 'Reconciliation break detected' },
    failed: { label: 'Failed', tone: 'critical', iconKey: 'error' },
};

/* ────────────────────────────────────────────────────────────────────────────
   CONTENT PUBLISHING
   ──────────────────────────────────────────────────────────────────────────── */

/** `pages.status` — CHECK: draft | published | archived. */
export const PAGE_STATUS_VALUES = ['draft', 'published', 'archived'] as const;
export type PageStatus = typeof PAGE_STATUS_VALUES[number];

export const PAGE_STATUS_PRESENTATION: StatusPresentationMap<PageStatus> = {
    draft: { label: 'Draft', tone: 'neutral', iconKey: 'draft' },
    published: { label: 'Published', tone: 'success', iconKey: 'live' },
    archived: { label: 'Archived', tone: 'neutral', iconKey: 'archive', a11yLabel: 'Archived — hidden from the storefront' },
};

/* ────────────────────────────────────────────────────────────────────────────
   MODERATION
   ──────────────────────────────────────────────────────────────────────────── */

/** `product_reviews.status` — CHECK: pending | approved | rejected. */
export const REVIEW_MODERATION_STATUS_VALUES = ['pending', 'approved', 'rejected'] as const;
export type ReviewModerationStatus = typeof REVIEW_MODERATION_STATUS_VALUES[number];

export const REVIEW_MODERATION_STATUS_PRESENTATION: StatusPresentationMap<ReviewModerationStatus> = {
    pending: { label: 'Pending review', tone: 'warning', iconKey: 'clock' },
    approved: { label: 'Approved', tone: 'success', iconKey: 'check' },
    rejected: { label: 'Rejected', tone: 'critical', iconKey: 'error' },
};

/** `blog_comments.status` — CHECK: pending | approved | spam | rejected. */
export type CommentModerationStatus = 'pending' | 'approved' | 'spam' | 'rejected';

export const COMMENT_MODERATION_STATUS_PRESENTATION: StatusPresentationMap<CommentModerationStatus> = {
    pending: { label: 'Pending review', tone: 'warning', iconKey: 'clock' },
    approved: { label: 'Approved', tone: 'success', iconKey: 'check' },
    spam: { label: 'Spam', tone: 'critical', iconKey: 'spam' },
    rejected: { label: 'Rejected', tone: 'critical', iconKey: 'error' },
};

/* ────────────────────────────────────────────────────────────────────────────
   GIFT CARDS
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * `gift_card_accounts.status` — CHECK: active | held | disabled | expired.
 *
 * `GiftCardStatusSchema` declares `redeemed`, which the constraint cannot store,
 * and omits `held`, which it can. Balance is a ledger projection, so "redeemed"
 * is not a status at all — a fully-spent card stays `active` with a zero balance.
 */
export const GIFT_CARD_STATUS_VALUES = ['active', 'held', 'expired', 'disabled'] as const;
export type GiftCardStatus = typeof GIFT_CARD_STATUS_VALUES[number];

export const GIFT_CARD_STATUS_PRESENTATION: StatusPresentationMap<GiftCardStatus> = {
    active: { label: 'Active', tone: 'success', iconKey: 'check' },
    held: { label: 'On hold', tone: 'warning', iconKey: 'pause', a11yLabel: 'On hold — temporarily unusable' },
    disabled: { label: 'Disabled', tone: 'critical', iconKey: 'blocked', a11yLabel: 'Disabled — can be reactivated' },
    expired: { label: 'Expired', tone: 'critical', iconKey: 'expired' },
};

/* ────────────────────────────────────────────────────────────────────────────
   PROVIDER MODE — money-truth (Constitution :73/:276, AGENTS.md UI-R6/PAY-R10)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * `mock | sandbox | live`, per DOC 01 and root AGENTS.md.
 *
 * Only `sandbox | live` are storable (CHECK on payouts, settlements,
 * billing_mandates, merchant_kyc_documents, app_billing_charges). `mock` is what
 * an ABSENT or unresolvable provider_mode resolves to — the Constitution defines
 * mock as the default adapter when nothing real is wired.
 */
export type ProviderModeStatus = 'live' | 'sandbox' | 'mock';

export const PROVIDER_MODE_PRESENTATION: StatusPresentationMap<ProviderModeStatus> = {
    live: { label: 'Live', tone: 'success', iconKey: 'live', a11yLabel: 'Live provider — real transactions' },
    sandbox: { label: 'Sandbox', tone: 'warning', iconKey: 'flask', a11yLabel: 'Sandbox provider — test transactions only' },
    mock: { label: 'Mock', tone: 'critical', iconKey: 'flask', a11yLabel: 'Mock provider — not connected to a real payment provider' },
};

/* ────────────────────────────────────────────────────────────────────────────
   RECORDED DRIFT — Zod schema vs live CHECK constraint
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * RESOLVED drift — the historical record.
 *
 * These are the disagreements that existed between the Zod schemas in this package
 * and the authoritative CHECK constraints. All five are now CLOSED: `index.ts`
 * derives each schema from the canonical value tuple above (`z.enum(PAYOUT_STATUS_VALUES)`
 * and friends), so a schema can no longer restate — and therefore no longer
 * contradict — the database.
 *
 * Kept as data, not deleted, for three reasons: it documents why the derivation
 * exists, a test asserts the maps still agree with it, and each entry names a real
 * defect that shipped (a settled payout rendering amber; a scheduled payout with no
 * Release button) so the cost of restating a vocabulary stays visible.
 */
export const STATUS_SCHEMA_DRIFT: ReadonlyArray<{
    column: string;
    schema: string;
    dbOnly: readonly string[];
    schemaOnly: readonly string[];
    note: string;
}> = [
    {
        column: 'sites.status',
        schema: 'StoreStatusSchema',
        dbOnly: ['unpublished'],
        schemaOnly: [],
        note: 'Schema cannot represent a store that was published and then withdrawn.',
    },
    {
        column: 'orders.status',
        schema: 'OrderStatusSchema',
        dbOnly: ['returned', 'rto'],
        schemaOnly: [],
        note: 'Schema predates the reverse-logistics states added by migration 147.',
    },
    {
        column: 'subscriptions.status',
        schema: 'SubscriptionStatusSchema',
        dbOnly: [],
        schemaOnly: ['expired'],
        note: 'Schema declares a value the constraint cannot store.',
    },
    {
        column: 'gift_card_accounts.status',
        schema: 'GiftCardStatusSchema',
        dbOnly: ['held'],
        schemaOnly: ['redeemed'],
        note: 'Balance is a ledger projection; "redeemed" is not a stored status.',
    },
] as const;
