import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export type StripeCheckoutSession = Stripe.Checkout.Session;
export type StripeWebhookEvent = Stripe.Event;

export function getStripeClient(secretKey = process.env.STRIPE_SECRET_KEY): Stripe {
  if (!stripeClient) {
    if (!secretKey) {
      throw new Error('[Stripe] STRIPE_SECRET_KEY is not configured.');
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripeClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export async function createCheckoutSession(params: {
  orderId: string;
  storeId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  storeName?: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
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
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      order_id: params.orderId,
      orderId: params.orderId,
      store_id: params.storeId,
      storeId: params.storeId,
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  }, {
    idempotencyKey: params.idempotencyKey,
  });
}

export function constructWebhookEvent(rawBody: string | Buffer, signature: string): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.retrieve(sessionId);
}

export interface StripeCheckoutSessionRestResult {
  id?: string;
  url?: string;
  error?: { message?: string };
}

export async function createStripeCheckoutSessionWithFetch(params: {
  secretKey: string;
  orderId: string;
  amountMinorUnits: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey?: string;
  name: string;
}): Promise<StripeCheckoutSessionRestResult> {
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${params.secretKey}`,
      ...(params.idempotencyKey ? { 'Idempotency-Key': params.idempotencyKey } : {}),
    },
    body: new URLSearchParams({
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      'metadata[order_id]': params.orderId,
      'line_items[0][price_data][currency]': params.currency.toLowerCase(),
      'line_items[0][price_data][product_data][name]': params.name,
      'line_items[0][price_data][unit_amount]': String(params.amountMinorUnits),
      'line_items[0][quantity]': '1',
    }),
  });

  const data = await response.json().catch(() => ({})) as StripeCheckoutSessionRestResult;
  if (!response.ok) {
    return {
      ...data,
      error: data.error || { message: `Stripe checkout session failed with ${response.status}` },
    };
  }
  return data;
}
