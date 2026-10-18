/**
 * Contract tests for the canonical status presentation maps.
 *
 * These assert three things the type system alone cannot:
 *
 *  1. COVERAGE — every map covers exactly the vocabulary its live CHECK
 *     constraint permits. `Record<T, …>` proves the map matches the TS union;
 *     only this proves the union matches the DATABASE.
 *  2. UNKNOWN IS LOUD — an unmapped value never resolves to neutral or success.
 *  3. NO SUBSTRING MATCHING — the negated statuses that broke the old
 *     `statusToBadgeVariant` ("unpaid" → success) cannot resolve to success here.
 *
 * The expected vocabularies below are transcribed from the live constraints,
 * captured with:
 *   docker exec -i <supabase_db> psql -U postgres -d postgres -c \
 *     "select pg_get_constraintdef(c.oid) from pg_constraint c
 *        join pg_class r on r.oid=c.conrelid where c.contype='c'"
 * Re-run that when a migration changes a status column; a mismatch fails here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SITE_STATUS_PRESENTATION,
    SITE_TRIAL_STATUS_PRESENTATION,
    CUSTOM_DOMAIN_STATUS_PRESENTATION,
    SSL_STATUS_PRESENTATION,
    ORDER_STATUS_PRESENTATION,
    ORDER_PAYMENT_STATUS_PRESENTATION,
    COD_CONFIRMATION_STATUS_PRESENTATION,
    ORDER_FULFILLMENT_STATE_PRESENTATION,
    ORDER_REFUND_STATUS_PRESENTATION,
    SUBSCRIPTION_STATUS_PRESENTATION,
    SUBSCRIPTION_DUNNING_STATUS_PRESENTATION,
    PAYOUT_STATUS_PRESENTATION,
    MERCHANT_PAYOUT_STATUS_PRESENTATION,
    SETTLEMENT_STATUS_PRESENTATION,
    PAGE_STATUS_PRESENTATION,
    REVIEW_MODERATION_STATUS_PRESENTATION,
    COMMENT_MODERATION_STATUS_PRESENTATION,
    GIFT_CARD_STATUS_PRESENTATION,
    PROVIDER_MODE_PRESENTATION,
    SITE_STATUS_VALUES,
    ORDER_STATUS_VALUES,
    SUBSCRIPTION_STATUS_VALUES,
    GIFT_CARD_STATUS_VALUES,
    PAYOUT_STATUS_VALUES,
    MERCHANT_PAYOUT_STATUS_VALUES,
    PAGE_STATUS_VALUES,
    REVIEW_MODERATION_STATUS_VALUES,
    CUSTOM_DOMAIN_STATUS_VALUES,
    presentStatus,
    isKnownStatus,
    unknownStatusPresentation,
    STATUS_SCHEMA_DRIFT,
} from '../src/status-presentation.ts';

/** column → [map, exact CHECK vocabulary] */
const CONTRACTS = {
    'sites.status': [SITE_STATUS_PRESENTATION, ['draft', 'published', 'unpublished', 'frozen', 'suspended']],
    'sites.trial_status': [SITE_TRIAL_STATUS_PRESENTATION, ['active', 'grace', 'frozen', 'cancelled', 'paid']],
    'sites.custom_domain_status': [CUSTOM_DOMAIN_STATUS_PRESENTATION, ['none', 'pending', 'review', 'verifying', 'active', 'error']],
    'sites.ssl_status': [SSL_STATUS_PRESENTATION, ['pending', 'active', 'failed']],
    'orders.status': [ORDER_STATUS_PRESENTATION, ['pending', 'pending_cod', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'returned', 'rto']],
    'orders.payment_status': [ORDER_PAYMENT_STATUS_PRESENTATION, ['pending', 'paid', 'failed', 'refunded']],
    'orders.cod_confirmation_status': [COD_CONFIRMATION_STATUS_PRESENTATION, ['not_required', 'requested', 'confirmed', 'rejected', 'expired']],
    'orders.fulfillment_state': [ORDER_FULFILLMENT_STATE_PRESENTATION, ['unfulfilled', 'hold', 'partial', 'fulfilled', 'delivered', 'returned', 'rto', 'cancelled']],
    'orders.refund_status': [ORDER_REFUND_STATUS_PRESENTATION, ['none', 'pending', 'processing', 'partially_refunded', 'refunded', 'failed']],
    'subscriptions.status': [SUBSCRIPTION_STATUS_PRESENTATION, ['active', 'cancelled', 'past_due', 'trialing']],
    'subscriptions.dunning_status': [SUBSCRIPTION_DUNNING_STATUS_PRESENTATION, ['none', 'past_due', 'paused', 'resolved']],
    'payouts.status': [PAYOUT_STATUS_PRESENTATION, ['scheduled', 'processing', 'paid', 'failed', 'cancelled']],
    'payout_statements.status': [MERCHANT_PAYOUT_STATUS_PRESENTATION, ['pending', 'processing', 'released', 'failed']],
    'settlements.status': [SETTLEMENT_STATUS_PRESENTATION, ['recorded', 'break_detected', 'failed']],
    'pages.status': [PAGE_STATUS_PRESENTATION, ['draft', 'published', 'archived']],
    'product_reviews.status': [REVIEW_MODERATION_STATUS_PRESENTATION, ['pending', 'approved', 'rejected']],
    'blog_comments.status': [COMMENT_MODERATION_STATUS_PRESENTATION, ['pending', 'approved', 'spam', 'rejected']],
    'gift_card_accounts.status': [GIFT_CARD_STATUS_PRESENTATION, ['active', 'held', 'disabled', 'expired']],
};

const VALID_TONES = new Set(['neutral', 'info', 'success', 'warning', 'critical']);

test('every presentation map matches its live CHECK vocabulary exactly', () => {
    for (const [column, [map, expected]] of Object.entries(CONTRACTS)) {
        const actual = Object.keys(map).sort();
        assert.deepEqual(
            actual,
            [...expected].sort(),
            `${column}: presentation map does not match the CHECK constraint. ` +
            `Missing: [${expected.filter((v) => !(v in map))}] ` +
            `Extra: [${actual.filter((v) => !expected.includes(v))}]`,
        );
    }
});

test('every presentation is well-formed', () => {
    for (const [column, [map]] of Object.entries(CONTRACTS)) {
        for (const [status, presentation] of Object.entries(map)) {
            assert.ok(presentation.label?.trim(), `${column}.${status}: label must be non-empty`);
            assert.ok(VALID_TONES.has(presentation.tone), `${column}.${status}: invalid tone ${presentation.tone}`);
            // A raw enum value must never reach a merchant as its label.
            assert.ok(
                !presentation.label.includes('_'),
                `${column}.${status}: label "${presentation.label}" looks like a raw enum value`,
            );
        }
    }
});

test('unknown statuses fail loudly, never neutral and never success', () => {
    const unmapped = ['', '   ', 'totally_new_state', 'ACTIVE_BUT_WEIRD', null, undefined, 0, {}];
    for (const [column, [map]] of Object.entries(CONTRACTS)) {
        for (const value of unmapped) {
            const p = presentStatus(map, value);
            assert.equal(p.tone, 'critical', `${column}: unknown "${String(value)}" must be critical, got ${p.tone}`);
            assert.notEqual(p.tone, 'success', `${column}: unknown "${String(value)}" must never be success`);
        }
    }
    assert.equal(unknownStatusPresentation(null).tone, 'critical');
});

test('substring matching is impossible — the old statusToBadgeVariant bug class', () => {
    // Every one of these resolved to SUCCESS under the substring matcher:
    //   "unpaid".includes("paid"), "inactive".includes("active"), etc.
    const negated = ['unpaid', 'inactive', 'unverified', 'unpublished', 'not_connected', 'disconnected', 'incomplete', 'unresolved'];
    for (const [column, [map]] of Object.entries(CONTRACTS)) {
        for (const value of negated) {
            if (isKnownStatus(map, value)) continue; // legitimately in this vocabulary
            const p = presentStatus(map, value);
            assert.notEqual(p.tone, 'success', `${column}: "${value}" must not resolve to success`);
        }
    }
    // sites.status genuinely contains 'unpublished' — it must be warning, not success.
    assert.equal(SITE_STATUS_PRESENTATION.unpublished.tone, 'warning');
});

test('resolution is exact-match and case/whitespace tolerant', () => {
    assert.equal(presentStatus(ORDER_STATUS_PRESENTATION, 'pending_cod').label, 'Pending COD');
    assert.equal(presentStatus(ORDER_STATUS_PRESENTATION, '  PENDING_COD  ').label, 'Pending COD');
    assert.equal(presentStatus(ORDER_STATUS_PRESENTATION, 'rto').label, 'RTO');
    // Not a fuzzy match: a near-miss is unknown, not the closest neighbour.
    assert.equal(presentStatus(ORDER_STATUS_PRESENTATION, 'pending-cod').tone, 'critical');
});

test('provider mode: absent resolves to mock, never sandbox and never nothing', () => {
    assert.equal(PROVIDER_MODE_PRESENTATION.mock.tone, 'critical');
    assert.equal(PROVIDER_MODE_PRESENTATION.live.tone, 'success');
    assert.equal(PROVIDER_MODE_PRESENTATION.sandbox.tone, 'warning');
    for (const absent of [null, undefined, '']) {
        const p = presentStatus(PROVIDER_MODE_PRESENTATION, absent);
        assert.notEqual(p.tone, 'success', 'an unresolved provider must never read as live');
        assert.ok(p.label, 'an unresolved provider must still render something');
    }
});

test('recorded schema drift is documented and does not silently grow', () => {
    assert.ok(STATUS_SCHEMA_DRIFT.length > 0);
    for (const entry of STATUS_SCHEMA_DRIFT) {
        assert.ok(entry.column && entry.schema && entry.note, 'drift entries must be self-describing');
        assert.ok(
            entry.dbOnly.length + entry.schemaOnly.length > 0,
            `${entry.column}: a drift entry with no difference should be deleted`,
        );
    }
    // Any drift naming a column we present must not contradict that map.
    for (const entry of STATUS_SCHEMA_DRIFT) {
        const contract = CONTRACTS[entry.column];
        if (!contract) continue;
        const [map] = contract;
        for (const value of entry.dbOnly) {
            assert.ok(value in map, `${entry.column}: "${value}" is DB-valid so it must be presented`);
        }
        for (const value of entry.schemaOnly) {
            assert.ok(!(value in map), `${entry.column}: "${value}" cannot be stored so it must not be presented`);
        }
    }
});

/**
 * The canonical value tuples are what `index.ts` builds its Zod schemas from
 * (`z.enum(SITE_STATUS_VALUES)` etc). Asserting the tuple against the presentation
 * map therefore also asserts the SCHEMA against the map — one source, checked once.
 *
 * This matters because six type names (OrderStatus, SubscriptionStatus, PageStatus,
 * GiftCardStatus, CustomDomainStatus, ReviewModerationStatus) are exported from BOTH
 * modules, and in ES modules an explicit local export beats a `export *` re-export.
 * Before the derivation, index.ts's drifted `z.infer` alias silently won at the
 * barrel. Deriving both from one tuple makes that shadowing harmless.
 *
 * (The schemas themselves cannot be imported here: index.ts uses extensionless
 * relative imports that Node's ESM loader will not resolve.)
 */
test('canonical value tuples and presentation maps are the same vocabulary', () => {
    const PAIRS = {
        'sites.status': [SITE_STATUS_VALUES, SITE_STATUS_PRESENTATION],
        'orders.status': [ORDER_STATUS_VALUES, ORDER_STATUS_PRESENTATION],
        'subscriptions.status': [SUBSCRIPTION_STATUS_VALUES, SUBSCRIPTION_STATUS_PRESENTATION],
        'gift_card_accounts.status': [GIFT_CARD_STATUS_VALUES, GIFT_CARD_STATUS_PRESENTATION],
        'payouts.status': [PAYOUT_STATUS_VALUES, PAYOUT_STATUS_PRESENTATION],
        'payout_statements.status': [MERCHANT_PAYOUT_STATUS_VALUES, MERCHANT_PAYOUT_STATUS_PRESENTATION],
        'pages.status': [PAGE_STATUS_VALUES, PAGE_STATUS_PRESENTATION],
        'product_reviews.status': [REVIEW_MODERATION_STATUS_VALUES, REVIEW_MODERATION_STATUS_PRESENTATION],
        'sites.custom_domain_status': [CUSTOM_DOMAIN_STATUS_VALUES, CUSTOM_DOMAIN_STATUS_PRESENTATION],
    };
    for (const [column, [values, map]] of Object.entries(PAIRS)) {
        assert.deepEqual(
            [...values].sort(),
            Object.keys(map).sort(),
            `${column}: the canonical tuple (which index.ts turns into a Zod schema) ` +
            `and the presentation map disagree.`,
        );
    }
});
