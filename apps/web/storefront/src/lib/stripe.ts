// ============================================================
// STRIPE — Server-side client & helpers
// ============================================================

import 'server-only';
import Stripe from 'stripe';

// Lazy-initialize to prevent build-time crashes when env vars are missing
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            console.warn('[Stripe] STRIPE_SECRET_KEY not set — Stripe payments will fail');
        }
        _stripe = new Stripe(key || 'sk_test_placeholder');
    }
    return _stripe;
}

// Backward-compatible export (lazy)
export const stripe = new Proxy({} as Stripe, {
    get(_target, prop) {
        return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
    },
});

/**
 * Create a Stripe Checkout Session for an order.
 */
export async function createCheckoutSession(params: {
    orderId: string;
    storeId: string;
    amount: number;       // in the smallest currency unit (e.g. INR paise)
    currency: string;
    customerEmail: string;
    storeName?: string;
    successUrl: string;
    cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: params.customerEmail,
        line_items: [
            {
                price_data: {
                    currency: params.currency,
                    product_data: {
                        name: params.storeName || 'Order Payment',
                        description: `Order #${params.orderId}`,
                    },
                    unit_amount: Math.round(params.amount * 100), // Convert to paise/cents
                },
                quantity: 1,
            },
        ],
        metadata: {
            orderId: params.orderId,
            storeId: params.storeId,
        },
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
    });

    return session;
}

/**
 * Construct and verify a Stripe webhook event from a raw body.
 */
export function constructWebhookEvent(
    rawBody: string | Buffer,
    signature: string
): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

/**
 * Retrieve a Checkout Session by ID.
 */
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return stripe.checkout.sessions.retrieve(sessionId);
}
