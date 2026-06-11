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

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

export interface RazorpayOrderCreateInput {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderCreateResult {
  id?: string;
  amount?: number;
  currency?: string;
  error?: { description?: string };
}

export interface RazorpaySubscriptionAddon {
  item: {
    name: string;
    amount: number;
    currency: string;
  };
  quantity?: number;
}

export interface RazorpaySubscriptionCreateInput {
  plan_id: string;
  total_count: number;
  quantity?: number;
  customer_notify?: boolean;
  start_at?: number;
  expire_by?: number;
  addons?: RazorpaySubscriptionAddon[];
  notes?: Record<string, string>;
}

export interface RazorpaySubscriptionCreateResult {
  id?: string;
  entity?: 'subscription';
  plan_id?: string;
  status?: string;
  short_url?: string;
  total_count?: number;
  paid_count?: number;
  remaining_count?: number;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  start_at?: number | null;
  end_at?: number | null;
  error?: { description?: string };
}

interface RazorpayCaptureResult {
  id?: string;
  order_id?: string;
  amount?: number;
  status?: string;
  error?: { code?: string; description?: string };
}

interface RazorpayRefundResult {
  id?: string;
  payment_id?: string;
  amount?: number;
  status?: string;
  error?: { code?: string; description?: string };
}

type RazorpayFetch = typeof fetch;

function basicAuth(credentials: RazorpayCredentials): string {
  return `Basic ${btoa(`${credentials.keyId}:${credentials.keySecret}`)}`;
}

export async function createRazorpayOrder(
  credentials: RazorpayCredentials,
  input: RazorpayOrderCreateInput,
): Promise<RazorpayOrderCreateResult> {
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(credentials),
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({})) as RazorpayOrderCreateResult;
  if (!response.ok) {
    return {
      ...data,
      error: data.error || { description: `Razorpay order create failed with ${response.status}` },
    };
  }
  return data;
}

export interface RazorpayPaymentFetchResult {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  captured?: boolean;
  error?: { code?: string; description?: string };
}

/**
 * Server-side fetch of a Razorpay payment. Use to confirm a payment was actually
 * captured for the expected amount/order BEFORE granting value — never trust a
 * client-supplied signature alone (the HMAC only proves order_id|payment_id, not
 * that the money was taken or how much).
 */
export async function fetchRazorpayPayment(
  credentials: RazorpayCredentials,
  paymentId: string,
  options: { fetch?: RazorpayFetch } = {},
): Promise<RazorpayPaymentFetchResult> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: {
      Authorization: basicAuth(credentials),
    },
  });

  const data = await response.json().catch(() => ({})) as RazorpayPaymentFetchResult;
  if (!response.ok) {
    return {
      ...data,
      error: data.error || { description: `Razorpay payment fetch failed with ${response.status}` },
    };
  }
  return data;
}

export async function createRazorpaySubscription(
  credentials: RazorpayCredentials,
  input: RazorpaySubscriptionCreateInput,
  options: { fetch?: RazorpayFetch } = {},
): Promise<RazorpaySubscriptionCreateResult> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(credentials),
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({})) as RazorpaySubscriptionCreateResult;
  if (!response.ok) {
    return {
      ...data,
      error: data.error || { description: `Razorpay subscription create failed with ${response.status}` },
    };
  }
  return data;
}

export async function getRazorpayOrderNotes(
  credentials: RazorpayCredentials,
  orderId: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: {
      Authorization: basicAuth(credentials),
    },
  });

  if (!response.ok) return {};
  const order = await response.json().catch(() => ({})) as { notes?: Record<string, unknown> };
  return order.notes || {};
}

export async function verifyRazorpayCredentials(credentials: RazorpayCredentials): Promise<boolean> {
  const response = await fetch('https://api.razorpay.com/v1/payments?count=1', {
    headers: {
      Authorization: basicAuth(credentials),
    },
  });

  return response.ok;
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function headerValue(headers: PaymentWebhookHeaders, name: string): string | undefined {
  const candidates = [name, name.toLowerCase(), name.toUpperCase()];
  for (const candidate of candidates) {
    const value = headers[candidate];
    if (Array.isArray(value)) return value[0];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function metadataNotes(metadata?: Record<string, unknown>): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value === undefined || value === null) continue;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (typeof serialized === 'string') notes[key] = serialized;
  }
  return notes;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function jsonPayload(rawBody: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(rawBody) as unknown);
  } catch {
    return {};
  }
}

async function postRazorpay<TResponse>(
  fetchImpl: RazorpayFetch,
  credentials: RazorpayCredentials,
  path: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  const response = await fetchImpl(`https://api.razorpay.com/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(credentials),
    },
    body: JSON.stringify(body),
  });

  return response.json().catch(() => ({})) as Promise<TResponse>;
}

export function createRazorpayPaymentProvider(
  credentials: RazorpayCredentials,
  options: { fetch?: RazorpayFetch } = {},
): PaymentProvider {
  const fetchImpl = options.fetch ?? fetch;

  return {
    name: 'razorpay',

    async createIntent(input: PaymentCreateIntentInput) {
      const amount = normalizePaymentMoney(input.amount);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
      const providerOrder = await createRazorpayOrder(credentials, {
        amount: amount.amountMinor,
        currency: amount.currency,
        receipt: input.receipt || input.orderId,
        notes: {
          order_id: input.orderId,
          store_id: input.storeId,
          idempotency_key: idempotencyKey,
          ...metadataNotes(input.metadata),
        },
      });

      if (!providerOrder.id) {
        throw new Error(providerOrder.error?.description || 'Razorpay order creation failed');
      }

      return {
        provider: 'razorpay',
        status: 'pending',
        amount: inrMoney(providerOrder.amount ?? amount.amountMinor),
        idempotencyKey,
        references: {
          providerOrderId: providerOrder.id,
        },
        metadata: input.metadata,
      };
    },

    async verify(input: PaymentVerifyInput): Promise<PaymentVerificationResult> {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);

      if (!input.providerOrderId || !input.providerPaymentId || !input.signature) {
        return {
          provider: 'razorpay',
          verified: false,
          status: 'failed',
          amount,
          references: {
            providerOrderId: input.providerOrderId,
            providerPaymentId: input.providerPaymentId,
          },
          failureCode: 'RAZORPAY_SIGNATURE_MISSING',
          failureMessage: 'Razorpay verification requires order id, payment id, and signature',
        };
      }

      const expected = await hmacSha256Hex(credentials.keySecret, `${input.providerOrderId}|${input.providerPaymentId}`);
      const verified = timingSafeEqual(expected, input.signature);

      return {
        provider: 'razorpay',
        verified,
        status: verified ? 'paid' : 'failed',
        amount,
        references: {
          providerOrderId: input.providerOrderId,
          providerPaymentId: input.providerPaymentId,
        },
        failureCode: verified ? undefined : 'RAZORPAY_SIGNATURE_INVALID',
        failureMessage: verified ? undefined : 'Razorpay payment signature mismatch',
        metadata: input.metadata,
      };
    },

    async capture(input: PaymentCaptureInput): Promise<PaymentCaptureResult> {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);

      if (!input.providerPaymentId) {
        throw new Error('Razorpay capture requires providerPaymentId');
      }

      const capture = await postRazorpay<RazorpayCaptureResult>(
        fetchImpl,
        credentials,
        `payments/${input.providerPaymentId}/capture`,
        {
          amount: amount.amountMinor,
          currency: amount.currency,
        },
      );
      const captured = capture.status === 'captured';

      return {
        provider: 'razorpay',
        status: captured ? 'paid' : 'failed',
        capturedAmount: inrMoney(capture.amount ?? amount.amountMinor),
        references: {
          providerOrderId: capture.order_id || input.providerOrderId,
          providerPaymentId: capture.id || input.providerPaymentId,
        },
        failureCode: captured ? undefined : capture.error?.code || 'RAZORPAY_CAPTURE_FAILED',
        failureMessage: captured ? undefined : capture.error?.description || 'Razorpay capture failed',
        metadata: input.metadata,
      };
    },

    async refund(input: PaymentRefundInput): Promise<PaymentRefundResult> {
      const amount = normalizePaymentMoney(input.amount);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

      const refund = await postRazorpay<RazorpayRefundResult>(
        fetchImpl,
        credentials,
        `payments/${input.paymentId}/refund`,
        {
          amount: amount.amountMinor,
          speed: 'normal',
          receipt: idempotencyKey,
          notes: metadataNotes(input.metadata),
        },
      );
      const refunded = refund.status === 'processed' || refund.status === 'created';

      return {
        provider: 'razorpay',
        status: refunded ? 'refunded' : 'failed',
        refundedAmount: inrMoney(refund.amount ?? amount.amountMinor),
        references: {
          providerPaymentId: refund.payment_id || input.paymentId,
          providerRefundId: refund.id,
        },
        failureCode: refunded ? undefined : refund.error?.code || 'RAZORPAY_REFUND_FAILED',
        failureMessage: refunded ? undefined : refund.error?.description || 'Razorpay refund failed',
        metadata: input.metadata,
      };
    },

    async webhookVerify(input: PaymentWebhookVerifyInput): Promise<PaymentWebhookVerificationResult> {
      const signature = headerValue(input.headers, 'x-razorpay-signature');
      if (!signature) {
        return {
          provider: 'razorpay',
          verified: false,
          failureCode: 'RAZORPAY_WEBHOOK_SIGNATURE_MISSING',
          failureMessage: 'Razorpay webhook signature header is missing',
        };
      }

      const expected = await hmacSha256Hex(input.secret, input.rawBody);
      const verified = timingSafeEqual(expected, signature);
      const payload = jsonPayload(input.rawBody);
      const payment = asRecord(asRecord(asRecord(payload.payload).payment).entity);
      const order = asRecord(asRecord(asRecord(payload.payload).order).entity);
      const eventType = textValue(payload.event) || 'unknown';
      const eventId = textValue(payload.id) || `${eventType}:${textValue(payment.id) || textValue(order.id) || input.receivedAt}`;

      return {
        provider: 'razorpay',
        verified,
        event: verified
          ? {
            id: eventId,
            provider: 'razorpay',
            type: eventType,
            occurredAt: typeof payload.created_at === 'number'
              ? new Date(payload.created_at * 1000).toISOString()
              : input.receivedAt,
            references: {
              providerEventId: eventId,
              providerOrderId: textValue(payment.order_id) || textValue(order.id),
              providerPaymentId: textValue(payment.id),
            },
            payload,
          }
          : undefined,
        failureCode: verified ? undefined : 'RAZORPAY_WEBHOOK_SIGNATURE_INVALID',
        failureMessage: verified ? undefined : 'Razorpay webhook signature mismatch',
      };
    },
  };
}
