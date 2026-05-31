import Stripe from 'stripe';
import {
  inrMoney,
  normalizeIdempotencyKey,
  normalizePaymentMoney,
  type PaymentCaptureResult,
  type PaymentProvider,
  type PaymentRefundResult,
  type PaymentVerificationResult,
  type PaymentWebhookVerificationResult,
} from '@letbuyy/payments';

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
  fetch?: typeof fetch;
}): Promise<StripeCheckoutSessionRestResult> {
  const fetchImpl = params.fetch ?? fetch;
  const response = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
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

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function createStripePaymentProvider(params: {
  secretKey: string;
  fetch?: typeof fetch;
}): PaymentProvider {
  return {
    name: 'stripe',

    async createIntent(input) {
      const amount = normalizePaymentMoney(input.amount);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
      const successUrl = metadataString(input.metadata, 'success_url');
      const cancelUrl = metadataString(input.metadata, 'cancel_url');

      if (!successUrl || !cancelUrl) {
        throw new Error('Stripe checkout requires success_url and cancel_url metadata');
      }

      const session = await createStripeCheckoutSessionWithFetch({
        secretKey: params.secretKey,
        orderId: input.orderId,
        amountMinorUnits: amount.amountMinor,
        currency: amount.currency,
        successUrl,
        cancelUrl,
        idempotencyKey,
        name: metadataString(input.metadata, 'name') || input.description || `LetBuyy order ${input.orderId}`,
        fetch: params.fetch,
      });

      if (!session.id || !session.url) {
        throw new Error(session.error?.message || 'Stripe checkout session creation failed');
      }

      return {
        provider: 'stripe',
        status: 'requires_action',
        amount,
        idempotencyKey,
        references: {
          providerOrderId: session.id,
        },
        redirectUrl: session.url,
        metadata: {
          ...input.metadata,
          session_id: session.id,
          session_url: session.url,
        },
      };
    },

    async verify(input): Promise<PaymentVerificationResult> {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);

      return {
        provider: 'stripe',
        verified: Boolean(input.providerPaymentId || input.providerOrderId),
        status: input.providerPaymentId || input.providerOrderId ? 'paid' : 'failed',
        amount,
        references: {
          providerOrderId: input.providerOrderId,
          providerPaymentId: input.providerPaymentId,
        },
        failureCode: input.providerPaymentId || input.providerOrderId ? undefined : 'STRIPE_REFERENCE_MISSING',
        failureMessage: input.providerPaymentId || input.providerOrderId ? undefined : 'Stripe verification requires a provider reference',
        metadata: input.metadata,
      };
    },

    async capture(input): Promise<PaymentCaptureResult> {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);

      return {
        provider: 'stripe',
        status: 'failed',
        capturedAmount: amount,
        references: {
          providerOrderId: input.providerOrderId,
          providerPaymentId: input.providerPaymentId,
        },
        failureCode: 'STRIPE_CAPTURE_NOT_APPLICABLE',
        failureMessage: 'Stripe Checkout capture is completed by Stripe webhook confirmation',
        metadata: input.metadata,
      };
    },

    async refund(input): Promise<PaymentRefundResult> {
      normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);

      return {
        provider: 'stripe',
        status: 'failed',
        refundedAmount: inrMoney(0),
        references: {
          providerPaymentId: input.paymentId,
        },
        failureCode: 'STRIPE_REFUND_NOT_WIRED',
        failureMessage: 'Stripe refunds are not wired in the storefront charge path yet',
        metadata: input.metadata,
      };
    },

    async webhookVerify(): Promise<PaymentWebhookVerificationResult> {
      return {
        provider: 'stripe',
        verified: false,
        failureCode: 'STRIPE_WEBHOOK_MOVED_TO_WEBHOOK_SERVICE',
        failureMessage: 'Stripe webhook verification is owned by services/webhook-service',
      };
    },
  };
}
