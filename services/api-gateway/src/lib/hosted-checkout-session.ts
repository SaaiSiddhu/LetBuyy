import { planCheckoutStateTransition, type CheckoutSessionState } from '@letbuyy/checkout-core';

export type SessionJson = null | boolean | number | string | SessionJson[] | { [key: string]: SessionJson };
export type SessionRecord = { [key: string]: SessionJson };
export type HostedCheckoutSession = {
    id: string; site_id: string; cart_id?: string | null; cart_token?: string | null;
    channel?: string | null; sales_origin?: 'storefront' | 'marketplace' | null;
    checkout_state?: CheckoutSessionState | null; status?: string | null;
    customer_email?: string | null; buyer_name?: string | null; buyer_phone?: string | null; buyer_gstin?: string | null;
    shipping_address?: SessionRecord | null; shipping_method?: string | null; payment_method?: string | null;
    delivery_quote?: SessionRecord | null; payment_intent?: SessionRecord | null;
    inventory_reservation_ids?: string[] | null; discount_codes?: string[] | null;
    discount_total?: number | string | null;
    confirmed_at?: string | null; failed_at?: string | null; order_id?: string | null;
    metadata?: SessionRecord | null; buyer_account_id?: string | null; buyer_session_epoch?: number | null;
    updated_at?: string | null;
};
export type SessionScope = { siteId: string; cartId: string; cartToken: string; cartStatus: string | null };
export type ConfirmationClaim = { id: string; requestHash: string; intentId: string };
export const SESSION_REVISION = 'hosted_session_revision';
const CLAIM = 'hosted_confirmation_claim';
export function sessionRevision(row: HostedCheckoutSession): string | null {
    const value = row.metadata?.[SESSION_REVISION];
    return typeof value === 'string' && value ? value : null;
}
function record(value: SessionJson | undefined): SessionRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function text(value: SessionJson | undefined): string | null { return typeof value === 'string' && value ? value : null; }
export function sessionMatchesScope(row: HostedCheckoutSession, scope: SessionScope): boolean {
    return row.site_id === scope.siteId && row.cart_id === scope.cartId && row.cart_token === scope.cartToken;
}
export function canRestartUnpaidHostedContact(row: HostedCheckoutSession, scope: SessionScope): boolean {
    if (!sessionMatchesScope(row, scope) || scope.cartStatus !== 'active' || !row.updated_at
        || !['delivery', 'payment_intent'].includes(row.checkout_state || '') || row.status !== row.checkout_state
        || row.order_id || row.confirmed_at || row.failed_at
        || !Array.isArray(row.inventory_reservation_ids) || row.inventory_reservation_ids.length !== 0) return false;
    const intent = row.payment_intent || {};
    if (row.checkout_state === 'delivery') return !row.payment_method && Object.keys(intent).length === 0
        && !['order_id', 'capture_posted_to_ledger', 'provider_order_id', 'provider_payment_id'].some(key => Boolean(row.metadata?.[key]));
    if (row.payment_method !== 'cod' || intent.provider !== 'cod' || intent.status !== 'authorized'
        || typeof intent.payment_intent_id !== 'string' || !intent.payment_intent_id.startsWith('cod_')) return false;
    const effectKeys = ['order_id', 'provider_order_id', 'provider_payment_id', 'razorpay_order_id', 'razorpay_payment_id', 'captured', 'capture_posted_to_ledger', 'setup_status'];
    return !effectKeys.some(key => Boolean(intent[key]) || Boolean(row.metadata?.[key]))
        && !record(row.metadata?.[CLAIM]).id;
}
/** Called only after signed/current buyer and absence-of-effects checks. The
 * previous intent receipt stays in the same CAS write; old idempotency rows
 * are never deleted or repurposed. Delivery is editable only before provider
 * setup; provider-unknown re-entry is never enabled by this function. */
export function contactRestartPatch(row: HostedCheckoutSession, claimId: string, now: string): SessionRecord {
    const previous = row.metadata?.hosted_contact_reentries;
    const history = Array.isArray(previous) ? previous : [];
    const intent = row.payment_intent || {};
    return {
        shipping_address: {}, shipping_method: null, delivery_quote: {}, payment_method: null, payment_intent: {},
        metadata: { ...(row.metadata || {}), hosted_delivery_signature: null, hosted_contact_reentries: [...history, {
            claim_id: claimId, superseded_intent_id: intent.payment_intent_id || null,
            provider: intent.provider || null, status: intent.status || null, previous_state: row.checkout_state || null, previous_revision: sessionRevision(row),
            reason: 'explicit_contact_reentry', at: now,
        }] },
    };
}
export function canPrepareCodIntent(row: HostedCheckoutSession | null, scope: SessionScope, signature: string | undefined): boolean {
    if (!row || !sessionMatchesScope(row, scope) || scope.cartStatus !== 'active'
        || !['delivery', 'payment_intent'].includes(row.checkout_state || '') || row.status !== row.checkout_state
        || row.confirmed_at || row.failed_at || row.order_id || !row.customer_email
        || !row.shipping_address || Object.keys(row.shipping_address).length === 0
        || !row.delivery_quote || Object.keys(row.delivery_quote).length === 0
        || !signature || row.metadata?.hosted_delivery_signature !== signature) return false;
    const provider = row.payment_intent?.provider;
    return (!row.payment_method || row.payment_method === 'cod') && (!provider || provider === 'cod');
}
export function sessionWriteAllowed(row: HostedCheckoutSession | null, next: CheckoutSessionState, restartContact: boolean): boolean {
    if (restartContact) return Boolean(row && next === 'contact' && ['delivery', 'payment_intent'].includes(row.checkout_state || ''));
    return planCheckoutStateTransition(row?.checkout_state ?? null, next).allowed;
}
function hasBoundRazorpayOrder(row: HostedCheckoutSession): boolean {
    const intent = row.payment_intent;
    return row.payment_method === 'razorpay' && intent?.provider === 'razorpay'
        && Boolean(text(intent.order_id)) && Boolean(text(intent.provider_order_id))
        && typeof intent.amount_minor === 'number' && Number.isSafeInteger(intent.amount_minor)
        && intent.amount_minor > 0 && intent.currency === 'INR';
}
export function confirmationDecision(row: HostedCheckoutSession, scope: SessionScope, claim: ConfirmationClaim): 'claim' | 'resume' | 'recover_committed' | 'completed_receipt' | 'deny' {
    if (!sessionMatchesScope(row, scope)) return 'deny';
    const stored = record(row.metadata?.[CLAIM]);
    if (row.checkout_state === 'completed' && row.status === 'completed' && row.confirmed_at && row.order_id
        && stored.request_hash === claim.requestHash && stored.intent_id === claim.intentId) return 'completed_receipt';
    if (!row.updated_at || row.failed_at || row.confirmed_at) return 'deny';
    if (text(row.payment_intent?.payment_intent_id) !== claim.intentId || !claim.intentId) return 'deny';
    if (row.checkout_state === 'confirming' && row.status === 'confirming') {
        if (stored.id !== claim.id || stored.request_hash !== claim.requestHash || stored.intent_id !== claim.intentId) return 'deny';
        if (scope.cartStatus === 'active' || scope.cartStatus === 'converted' && hasBoundRazorpayOrder(row)) return 'resume';
        // This is permission to look for the already committed canonical COD
        // receipt only. The route must never call createOrder on this branch.
        return scope.cartStatus === 'converted' && row.payment_method === 'cod' && row.payment_intent?.provider === 'cod'
            ? 'recover_committed' : 'deny';
    }
    // Creating the pending local Razorpay order atomically converts its cart
    // before the buyer completes the provider flow. Confirmation must settle
    // that existing order, never create another one or reopen the cart. The
    // route still verifies signature, site/order binding, amount and capture.
    if (scope.cartStatus !== 'active' && !(scope.cartStatus === 'converted' && hasBoundRazorpayOrder(row))) return 'deny';
    return row.checkout_state === 'payment_intent' && row.status === 'payment_intent' ? 'claim' : 'deny';
}
export function confirmationClaimPatch(row: HostedCheckoutSession, claim: ConfirmationClaim): SessionRecord {
    return { metadata: { ...(row.metadata || {}), [CLAIM]: { id: claim.id, request_hash: claim.requestHash, intent_id: claim.intentId, observed_revision: sessionRevision(row) } } };
}
export function ownsConfirmation(row: HostedCheckoutSession, claim: ConfirmationClaim): boolean {
    const stored = record(row.metadata?.[CLAIM]);
    return row.checkout_state === 'confirming' && row.status === 'confirming'
        && stored.id === claim.id && stored.request_hash === claim.requestHash && stored.intent_id === claim.intentId;
}
export function releaseRejectedCodClaimPatch(row: HostedCheckoutSession, claim: ConfirmationClaim, code: string): SessionRecord | null {
    // These are known transactional pre-order refusals, not network failures or
    // unknown capture outcomes. All other failures keep their durable claim.
    if (!ownsConfirmation(row, claim) || row.payment_method !== 'cod' || row.payment_intent?.provider !== 'cod'
        || row.order_id || row.confirmed_at || row.failed_at
        || !['CHECKOUT_QUOTE_CHANGED', 'CHECKOUT_TAX_REVIEW_REQUIRED', 'CHECKOUT_PRODUCT_CHANGED', 'CHECKOUT_SHIPPING_CHANGED', 'MARKETPLACE_LISTING_UNAVAILABLE'].includes(code)) return null;
    return { metadata: { ...(row.metadata || {}), [CLAIM]: null,
        hosted_last_rejection: { claim_id: claim.id, request_hash: claim.requestHash, intent_id: claim.intentId, code } } };
}
/** Raw PostgREST timestamp is deliberately never Date-parsed: PostgreSQL's
 * full microseconds are part of CAS. A fresh private revision also prevents
 * two same-state writes sharing a timestamp from both succeeding. */
export function sessionCasMatches(actual: HostedCheckoutSession, observed: HostedCheckoutSession): boolean {
    return Boolean(observed.updated_at) && actual.id === observed.id && actual.site_id === observed.site_id
        && actual.cart_id === observed.cart_id && actual.cart_token === observed.cart_token
        && actual.checkout_state === observed.checkout_state && actual.status === observed.status
        && actual.updated_at === observed.updated_at && sessionRevision(actual) === sessionRevision(observed)
        && actual.buyer_account_id === observed.buyer_account_id && actual.buyer_session_epoch === observed.buyer_session_epoch;
}

/** A saved checkout selection overrides the cart only after the existing delivery CAS.
 * Missing selection inherits the signed cart; an explicit empty selection removes it. */
export function selectedHostedDiscountCodes(row: HostedCheckoutSession | null, cartCode: string | null | undefined): string[] | null {
    if (row?.metadata?.hosted_discount_selection_v1 !== true) return cartCode ? [cartCode.toUpperCase()] : [];
    const codes = row.discount_codes;
    if (!Array.isArray(codes) || codes.length > 1 || codes.some(code => typeof code !== 'string' || !code.trim() || code.length > 50)) return null;
    return codes.map(code => code.trim().toUpperCase());
}

export function sessionPayload(row: HostedCheckoutSession) {
    return {
        id: row.id,
        site_id: row.site_id,
        cart_id: row.cart_id,
        channel: row.channel || 'web',
        sales_origin: row.sales_origin || 'storefront',
        state: row.checkout_state || row.status || 'contact',
        customer_email: row.customer_email || null,
        buyer_name: row.buyer_name || null,
        buyer_phone: row.buyer_phone || null,
        shipping_address: row.shipping_address || {},
        delivery_quote: row.delivery_quote || {},
        payment_intent: row.payment_intent || {},
        confirmed_at: row.confirmed_at || null,
        failed_at: row.failed_at || null,
    };
}
