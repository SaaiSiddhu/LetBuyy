// D-PLATFORM-CHARGE (owner, 2026-09-06) — ONE verification authority, parameterised by what holds
// the reference.
//
// The platform needs to charge merchants (prepaid ad credits first, subscriptions after), and the
// only verified Razorpay path in this repository was welded to `orders`: it fetched the order,
// checked orders.payment_status, and failed closed unless orders.payment_id matched the provider
// order id. A merchant buying ad credits is not a storefront order, so that path could not be
// reused as it stood.
//
// The three options considered were an `orders` row per platform charge (the platform becomes a
// party in its own tenant's commerce, and the charge lands inside GST invoice scope), a second
// verification path (which migration 232's own comment forbids), or real UPI AutoPay first (blocked
// on HR-AUTOPAY-LIVE). The owner chose this fourth shape: extract the SAME code and let the caller
// say where the reference lives.
//
// Why this is not the "second payment authority" 232 forbids: a second authority means a second
// place that DECIDES whether a payment is real. This is one decision procedure, called from more
// than one binding. Nothing here knows about orders, billing_history or ad credits.
//
// What this module deliberately does NOT do: replay protection. That is
// assertProviderPaymentNotReplayed, which is bound to payment_transactions and answers "has this
// provider payment id been used by ANYONE" — a different question with a different storage model.
// Folding it in here would make this module know about tables again.

import {razorpayBillingSignaturePayload} from '@letbuyy/billing-core';
import { hmacSha256Hex, timingSafeEqualHex } from './crypto';

export type ProviderPaymentVerificationFailure =
    | 'provider_not_configured'
    | 'invalid_signature'
    | 'reference_mismatch';

export interface RazorpayVerificationInput {
    /// The provider order id the client presents.
    providerOrderId: string;
    referenceKind?: 'order' | 'subscription';
    providerPaymentId: string;
    signature: string;
    /// The reference the SERVER stored when it created the provider order — orders.payment_id for a
    /// storefront order, and the platform-charge row's own reference for a merchant charge. `null`
    /// means no provider order was ever created for this record, so any signature presented against
    /// it is being replayed from a different one.
    storedProviderOrderId: string | null | undefined;
}

export type ProviderPaymentVerification =
    | { ok: true }
    | { ok: false; reason: ProviderPaymentVerificationFailure };

// Razorpay signs `${order_id}|${payment_id}` with the key secret. Kept as a named function so the
// payload construction is one thing, in one place, rather than a template literal repeated per
// caller — the shape of defect this repository has found in its own money code more than once.
export function razorpaySignaturePayload(providerOrderId: string, providerPaymentId: string): string {
    return razorpayBillingSignaturePayload({orderId:providerOrderId,paymentId:providerPaymentId});
}

export async function verifyRazorpayPayment(
    keySecret: string | undefined | null,
    input: RazorpayVerificationInput,
): Promise<ProviderPaymentVerification> {
    // Fails closed: with no secret nothing can be verified, so nothing may be treated as paid.
    if (!keySecret) return { ok: false, reason: 'provider_not_configured' };

    const expected = await hmacSha256Hex(keySecret, razorpayBillingSignaturePayload({paymentId:input.providerPaymentId,...(input.referenceKind==='subscription'?{subscriptionId:input.providerOrderId}:{orderId:input.providerOrderId})}));
    if (!timingSafeEqualHex(expected, input.signature)) return { ok: false, reason: 'invalid_signature' };

    // SECURITY, and the order matters: the signature is checked FIRST so an attacker learns nothing
    // about which records exist from how long a rejection takes, and the binding SECOND so a validly
    // signed payment still cannot be applied to a record it was not created for. A signature alone
    // proves Razorpay signed something; only the binding proves it was signed for THIS record.
    if (!input.storedProviderOrderId || input.storedProviderOrderId !== input.providerOrderId) {
        return { ok: false, reason: 'reference_mismatch' };
    }

    return { ok: true };
}
