import Stripe from 'stripe';
import {
  inrMoney,
  normalizeIdempotencyKey,
  normalizePaymentMoney,
  type PaymentCaptureInput,
  type PaymentCaptureResult,
  type PaymentCreateIntentInput,
  type PaymentProvider,
  type PaymentRefundInput,
  type PaymentRefundResult,
  type PaymentVerifyInput,
  type PaymentVerificationResult,
  type PaymentWebhookHeaders,
  type PaymentWebhookVerifyInput,
  type PaymentWebhookVerificationResult,
} from '@letbuyy/payments';
import { hmacSha256Hex, timingSafeEqual } from '../razorpay-adapter/index';

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

function stripeHeader(headers: PaymentWebhookHeaders, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

function parseStripeSignatureHeader(signatureHeader: string): { timestamp?: string; v1?: string } {
  const values: Record<string, string> = {};
  for (const element of signatureHeader.split(',')) {
    const [key, value] = element.split('=', 2);
    if (key && value) values[key] = value;
  }
  return { timestamp: values.t, v1: values.v1 };
}

function jsonPayload(rawBody: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function createStripePaymentProvider(params: {
  secretKey?: string;
  fetch?: typeof fetch;
} = {}): PaymentProvider {
  return {
    name: 'stripe',

    async createIntent(input: PaymentCreateIntentInput) {
      if (!params.secretKey) {
        throw new Error('Stripe checkout requires STRIPE_SECRET_KEY');
      }

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

    async verify(input: PaymentVerifyInput): Promise<PaymentVerificationResult> {
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

    async capture(input: PaymentCaptureInput): Promise<PaymentCaptureResult> {
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

    async refund(input: PaymentRefundInput): Promise<PaymentRefundResult> {
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

    async webhookVerify(input: PaymentWebhookVerifyInput): Promise<PaymentWebhookVerificationResult> {
      const signatureHeader = stripeHeader(input.headers, 'stripe-signature');
      if (!signatureHeader) {
        return {
          provider: 'stripe',
          verified: false,
          failureCode: 'STRIPE_WEBHOOK_SIGNATURE_MISSING',
          failureMessage: 'Stripe signature header is missing',
        };
      }

      const { timestamp, v1 } = parseStripeSignatureHeader(signatureHeader);
      const timestampSeconds = timestamp ? Number.parseInt(timestamp, 10) : Number.NaN;
      const receivedSeconds = Math.floor(Date.parse(input.receivedAt) / 1000);
      if (!timestamp || !v1 || Number.isNaN(timestampSeconds)) {
        return {
          provider: 'stripe',
          verified: false,
          failureCode: 'STRIPE_WEBHOOK_SIGNATURE_MALFORMED',
          failureMessage: 'Stripe signature header is malformed',
        };
      }

      if (Math.abs(receivedSeconds - timestampSeconds) > 300) {
        return {
          provider: 'stripe',
          verified: false,
          failureCode: 'STRIPE_WEBHOOK_TIMESTAMP_OUTSIDE_TOLERANCE',
          failureMessage: 'Stripe webhook timestamp is outside tolerance',
        };
      }

      const expected = await hmacSha256Hex(input.secret, `${timestamp}.${input.rawBody}`);
      const verified = timingSafeEqual(v1, expected);
      const payload = jsonPayload(input.rawBody);
      const eventObject = asRecord(asRecord(payload.data).object);
      const eventId = textValue(payload.id) || `stripe:${input.receivedAt}`;
      const eventType = textValue(payload.type) || 'unknown';

      return {
        provider: 'stripe',
        verified,
        event: verified
          ? {
            id: eventId,
            provider: 'stripe',
            type: eventType,
            occurredAt: typeof payload.created === 'number'
              ? new Date(payload.created * 1000).toISOString()
              : input.receivedAt,
            references: {
              providerEventId: eventId,
              providerOrderId: textValue(eventObject.id),
              providerPaymentId: textValue(eventObject.payment_intent) || textValue(eventObject.id),
            },
            payload,
          }
          : undefined,
        failureCode: verified ? undefined : 'STRIPE_WEBHOOK_SIGNATURE_INVALID',
        failureMessage: verified ? undefined : 'Stripe webhook signature mismatch',
      };
    },
  };
}
