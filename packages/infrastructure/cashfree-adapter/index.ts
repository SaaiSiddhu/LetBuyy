import {
  fromInrMinorUnits,
  inrMoney,
  normalizeIdempotencyKey,
  normalizePaymentMoney,
  type PaymentCaptureResult,
  type PaymentProvider,
  type PaymentRefundResult,
  type PaymentVerificationResult,
  type PaymentWebhookHeaders,
  type PaymentWebhookVerificationResult,
} from '@letbuyy/payments';
import { timingSafeEqual } from '../razorpay-adapter/index';

export interface CashfreeCredentials {
  appId: string;
  secretKey: string;
  environment?: 'sandbox' | 'production';
  apiVersion?: string;
}

export interface CashfreePaymentProviderOptions {
  fetch?: typeof fetch;
}

interface CashfreeApiError {
  code?: string;
  message?: string;
  type?: string;
}

interface CashfreeOrderResponse {
  cf_order_id?: string | number;
  order_id?: string;
  order_amount?: number;
  order_currency?: string;
  order_status?: string;
  payment_session_id?: string;
  order_meta?: Record<string, unknown>;
  error?: CashfreeApiError;
  message?: string;
}

interface CashfreePaymentResponse {
  cf_payment_id?: string | number;
  order_id?: string;
  payment_amount?: number;
  order_amount?: number;
  payment_currency?: string;
  order_currency?: string;
  payment_status?: string;
  payment_message?: string;
  payment_group?: string;
  is_captured?: boolean;
  error_details?: {
    error_code?: string;
    error_description?: string;
    error_reason?: string;
  } | null;
}

interface CashfreeRefundResponse {
  cf_payment_id?: string | number;
  cf_refund_id?: string | number;
  refund_id?: string;
  order_id?: string;
  refund_amount?: number;
  refund_currency?: string;
  refund_status?: string;
  status_description?: string;
  message?: string;
  error?: CashfreeApiError;
}

type CashfreeFetch = typeof fetch;

function cashfreeBaseUrl(credentials: CashfreeCredentials): string {
  return credentials.environment === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
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

function jsonPayload(rawBody: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(rawBody) as unknown);
  } catch {
    return {};
  }
}

function cashfreeAmountMajor(amountMinor: number): number {
  return Number(fromInrMinorUnits(amountMinor));
}

function sanitizeCashfreeId(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 80);
  return sanitized || `lb_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function stringMetadata(metadata?: Record<string, unknown>, key?: string): string | undefined {
  if (!key) return undefined;
  return textValue(metadata?.[key]);
}

function paymentFailureCode(payment?: CashfreePaymentResponse): string | undefined {
  return payment?.error_details?.error_code || payment?.payment_status;
}

function paymentFailureMessage(payment?: CashfreePaymentResponse): string | undefined {
  return payment?.error_details?.error_description || payment?.payment_message;
}

function successfulPayment(payment: CashfreePaymentResponse): boolean {
  return payment.payment_status === 'SUCCESS' || (payment.is_captured === true && payment.payment_status !== 'FAILED');
}

function failedPayment(payment: CashfreePaymentResponse): boolean {
  return payment.payment_status === 'FAILED' || Boolean(payment.error_details);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function hmacSha256Base64(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return bytesToBase64(new Uint8Array(signature));
}

async function deterministicUuid(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function cashfreeRequest<TResponse>(
  fetchImpl: CashfreeFetch,
  credentials: CashfreeCredentials,
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
    requestId?: string;
    idempotencyKey?: string;
  } = {},
): Promise<TResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-version': credentials.apiVersion || '2025-01-01',
    'x-client-id': credentials.appId,
    'x-client-secret': credentials.secretKey,
  };

  if (options.requestId) headers['x-request-id'] = options.requestId;
  if (options.idempotencyKey) headers['x-idempotency-key'] = await deterministicUuid(options.idempotencyKey);

  const response = await fetchImpl(`${cashfreeBaseUrl(credentials)}/${path.replace(/^\/+/, '')}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({})) as TResponse & {
    error?: CashfreeApiError;
    message?: string;
  };

  if (!response.ok) {
    const message = data.error?.message || data.message || `Cashfree request failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function fetchOrderPayments(
  fetchImpl: CashfreeFetch,
  credentials: CashfreeCredentials,
  providerOrderId: string,
  providerPaymentId?: string,
  requestId?: string,
): Promise<CashfreePaymentResponse[]> {
  if (providerPaymentId) {
    const payment = await cashfreeRequest<CashfreePaymentResponse>(
      fetchImpl,
      credentials,
      `orders/${encodeURIComponent(providerOrderId)}/payments/${encodeURIComponent(providerPaymentId)}`,
      { requestId },
    );
    return [payment];
  }

  return cashfreeRequest<CashfreePaymentResponse[]>(
    fetchImpl,
    credentials,
    `orders/${encodeURIComponent(providerOrderId)}/payments`,
    { requestId },
  );
}

function cashfreeWebhookEventId(payload: Record<string, unknown>, receivedAt: string): string {
  const data = asRecord(payload.data);
  const payment = asRecord(data.payment);
  const order = asRecord(data.order);
  const refund = asRecord(data.refund);
  const type = textValue(payload.type) || textValue(payload.event) || 'cashfree.webhook';
  return (
    textValue(payload.event_id) ||
    textValue(payment.cf_payment_id) ||
    textValue(refund.cf_refund_id) ||
    textValue(order.order_id) ||
    `${type}:${receivedAt}`
  );
}

export function createCashfreePaymentProvider(
  credentials: CashfreeCredentials,
  options: CashfreePaymentProviderOptions = {},
): PaymentProvider {
  const fetchImpl = options.fetch ?? fetch;

  return {
    name: 'cashfree',

    async createIntent(input) {
      const amount = normalizePaymentMoney(input.amount);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
      const metadata = input.metadata || {};
      const providerOrderId = sanitizeCashfreeId(stringMetadata(metadata, 'cashfree_order_id') || input.orderId);
      const requestId = stringMetadata(metadata, 'request_id');
      const customerName = input.customer?.name || stringMetadata(metadata, 'customer_name');
      const customerEmail = input.customer?.email || stringMetadata(metadata, 'customer_email');
      const customerPhone = input.customer?.phone || stringMetadata(metadata, 'customer_phone') || '9999999999';

      const body: Record<string, unknown> = {
        order_id: providerOrderId,
        order_amount: cashfreeAmountMajor(amount.amountMinor),
        order_currency: amount.currency,
        order_note: input.description || input.receipt || `LetBuyy order ${input.orderId}`,
        customer_details: {
          customer_id: sanitizeCashfreeId(input.customer?.id || customerEmail || input.orderId),
          customer_phone: customerPhone,
          ...(customerName ? { customer_name: customerName } : {}),
          ...(customerEmail ? { customer_email: customerEmail } : {}),
        },
        order_meta: {
          ...(stringMetadata(metadata, 'return_url') ? { return_url: stringMetadata(metadata, 'return_url') } : {}),
          ...(stringMetadata(metadata, 'notify_url') ? { notify_url: stringMetadata(metadata, 'notify_url') } : {}),
          ...(stringMetadata(metadata, 'payment_methods') ? { payment_methods: stringMetadata(metadata, 'payment_methods') } : {}),
        },
        order_tags: {
          store_id: input.storeId,
          order_id: input.orderId,
          source: textValue(metadata.source) || 'letbuyy',
        },
      };

      const order = await cashfreeRequest<CashfreeOrderResponse>(
        fetchImpl,
        credentials,
        'orders',
        {
          method: 'POST',
          body,
          requestId,
          idempotencyKey,
        },
      );

      if (!order.order_id || !order.payment_session_id) {
        throw new Error(order.error?.message || order.message || 'Cashfree order creation failed');
      }

      return {
        provider: 'cashfree',
        status: 'requires_action',
        amount: inrMoney(Math.round(Number(order.order_amount ?? cashfreeAmountMajor(amount.amountMinor)) * 100)),
        idempotencyKey,
        references: {
          providerOrderId: order.order_id,
        },
        clientSecret: order.payment_session_id,
        metadata: {
          ...metadata,
          cf_order_id: textValue(order.cf_order_id),
          cashfree_environment: credentials.environment || 'sandbox',
        },
      };
    },

    async verify(input): Promise<PaymentVerificationResult> {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);

      if (!input.providerOrderId) {
        return {
          provider: 'cashfree',
          verified: false,
          status: 'failed',
          amount,
          references: {
            providerPaymentId: input.providerPaymentId,
          },
          failureCode: 'CASHFREE_ORDER_REFERENCE_MISSING',
          failureMessage: 'Cashfree verification requires an order reference',
          metadata: input.metadata,
        };
      }

      const requestId = stringMetadata(input.metadata, 'request_id');
      const payments = await fetchOrderPayments(fetchImpl, credentials, input.providerOrderId, input.providerPaymentId, requestId);
      const successful = payments.find(successfulPayment);
      if (successful) {
        return {
          provider: 'cashfree',
          verified: true,
          status: 'paid',
          amount: inrMoney(Math.round(Number(successful.payment_amount ?? successful.order_amount ?? cashfreeAmountMajor(amount.amountMinor)) * 100)),
          references: {
            providerOrderId: successful.order_id || input.providerOrderId,
            providerPaymentId: textValue(successful.cf_payment_id) || input.providerPaymentId,
          },
          metadata: {
            ...input.metadata,
            payment_status: successful.payment_status,
            payment_group: successful.payment_group,
          },
        };
      }

      const order = await cashfreeRequest<CashfreeOrderResponse>(
        fetchImpl,
        credentials,
        `orders/${encodeURIComponent(input.providerOrderId)}`,
        { requestId },
      );

      if (order.order_status === 'PAID') {
        const latestPayment = payments[0];
        return {
          provider: 'cashfree',
          verified: true,
          status: 'paid',
          amount: inrMoney(Math.round(Number(order.order_amount ?? cashfreeAmountMajor(amount.amountMinor)) * 100)),
          references: {
            providerOrderId: order.order_id || input.providerOrderId,
            providerPaymentId: textValue(latestPayment?.cf_payment_id) || input.providerPaymentId,
          },
          metadata: {
            ...input.metadata,
            order_status: order.order_status,
          },
        };
      }

      const failed = payments.find(failedPayment);
      return {
        provider: 'cashfree',
        verified: false,
        status: 'failed',
        amount,
        references: {
          providerOrderId: order.order_id || input.providerOrderId,
          providerPaymentId: textValue(failed?.cf_payment_id) || input.providerPaymentId,
        },
        failureCode: paymentFailureCode(failed) || `CASHFREE_ORDER_${order.order_status || 'UNPAID'}`,
        failureMessage: paymentFailureMessage(failed) || `Cashfree order is ${order.order_status || 'not paid'}`,
        metadata: {
          ...input.metadata,
          order_status: order.order_status,
        },
      };
    },

    async capture(input): Promise<PaymentCaptureResult> {
      const amount = normalizePaymentMoney(input.amount);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
      const verification = await createCashfreePaymentProvider(credentials, { fetch: fetchImpl }).verify({
        storeId: input.storeId,
        orderId: input.orderId,
        amount,
        idempotencyKey,
        providerOrderId: input.providerOrderId,
        providerPaymentId: input.providerPaymentId,
        metadata: input.metadata,
      });

      return {
        provider: 'cashfree',
        status: verification.verified ? 'paid' : 'failed',
        capturedAmount: verification.verified ? verification.amount : inrMoney(0),
        references: verification.references,
        failureCode: verification.failureCode,
        failureMessage: verification.failureMessage,
        metadata: verification.metadata,
      };
    },

    async refund(input): Promise<PaymentRefundResult> {
      const amount = normalizePaymentMoney(input.amount);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

      if (!input.providerOrderId) {
        return {
          provider: 'cashfree',
          status: 'failed',
          refundedAmount: inrMoney(0),
          references: {
            providerPaymentId: input.paymentId,
            providerRefundId: input.providerRefundId,
          },
          failureCode: 'CASHFREE_ORDER_REFERENCE_MISSING',
          failureMessage: 'Cashfree refund requires an order reference',
          metadata: input.metadata,
        };
      }

      const refund = await cashfreeRequest<CashfreeRefundResponse>(
        fetchImpl,
        credentials,
        `orders/${encodeURIComponent(input.providerOrderId)}/refunds`,
        {
          method: 'POST',
          idempotencyKey,
          requestId: stringMetadata(input.metadata, 'request_id'),
          body: {
            refund_amount: cashfreeAmountMajor(amount.amountMinor),
            refund_id: sanitizeCashfreeId(input.providerRefundId || idempotencyKey),
            refund_note: input.reason || 'LetBuyy order refund',
            refund_speed: 'STANDARD',
          },
        },
      );

      const status = refund.refund_status === 'SUCCESS' ? 'refunded' : 'failed';
      return {
        provider: 'cashfree',
        status,
        refundedAmount: status === 'refunded'
          ? inrMoney(Math.round(Number(refund.refund_amount ?? cashfreeAmountMajor(amount.amountMinor)) * 100))
          : inrMoney(0),
        references: {
          providerOrderId: refund.order_id || input.providerOrderId,
          providerPaymentId: textValue(refund.cf_payment_id) || input.paymentId,
          providerRefundId: textValue(refund.cf_refund_id) || refund.refund_id || input.providerRefundId,
        },
        failureCode: status === 'refunded' ? undefined : refund.refund_status || 'CASHFREE_REFUND_FAILED',
        failureMessage: status === 'refunded' ? undefined : refund.status_description || refund.message || 'Cashfree refund did not complete',
        metadata: input.metadata,
      };
    },

    async webhookVerify(input): Promise<PaymentWebhookVerificationResult> {
      const signature = headerValue(input.headers, 'x-webhook-signature');
      const timestamp = headerValue(input.headers, 'x-webhook-timestamp');

      if (!signature || !timestamp) {
        return {
          provider: 'cashfree',
          verified: false,
          failureCode: 'CASHFREE_WEBHOOK_SIGNATURE_MISSING',
          failureMessage: 'Cashfree webhook signature or timestamp header is missing',
        };
      }

      const expected = await hmacSha256Base64(input.secret, `${timestamp}${input.rawBody}`);
      const verified = timingSafeEqual(expected, signature);
      const payload = jsonPayload(input.rawBody);
      const data = asRecord(payload.data);
      const order = asRecord(data.order);
      const payment = asRecord(data.payment);
      const refund = asRecord(data.refund);
      const eventType = textValue(payload.type) || textValue(payload.event) || 'unknown';
      const eventId = cashfreeWebhookEventId(payload, input.receivedAt);

      return {
        provider: 'cashfree',
        verified,
        event: verified
          ? {
            id: eventId,
            provider: 'cashfree',
            type: eventType,
            occurredAt: textValue(payload.event_time) || input.receivedAt,
            references: {
              providerEventId: eventId,
              providerOrderId: textValue(order.order_id) || textValue(payment.order_id) || textValue(refund.order_id),
              providerPaymentId: textValue(payment.cf_payment_id) || textValue(refund.cf_payment_id),
              providerRefundId: textValue(refund.cf_refund_id) || textValue(refund.refund_id),
            },
            payload,
          }
          : undefined,
        failureCode: verified ? undefined : 'CASHFREE_WEBHOOK_SIGNATURE_INVALID',
        failureMessage: verified ? undefined : 'Cashfree webhook signature mismatch',
      };
    },
  };
}
