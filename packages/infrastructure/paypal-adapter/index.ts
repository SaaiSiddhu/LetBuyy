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

export interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
  mode?: 'sandbox' | 'live';
  webhookId?: string;
}

type PayPalFetch = typeof fetch;

type PayPalLink = {
  rel?: string;
  href?: string;
};

type PayPalOrderResponse = {
  id?: string;
  links?: PayPalLink[];
};

type PayPalCaptureResponse = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: {
          value?: string;
          currency_code?: string;
        };
      }>;
    };
  }>;
};

function getPayPalBaseUrl(mode: 'sandbox' | 'live' = 'sandbox'): string {
  return mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function getPayPalCredentials(): PayPalCredentials {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('[PayPal] PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured.');
  }

  return {
    clientId,
    clientSecret,
    mode: process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox',
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
  };
}

function basicAuth(credentials: PayPalCredentials): string {
  return `Basic ${btoa(`${credentials.clientId}:${credentials.clientSecret}`)}`;
}

async function getAccessToken(
  credentials: PayPalCredentials,
  options: { fetch?: PayPalFetch } = {},
): Promise<string> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`${getPayPalBaseUrl(credentials.mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(credentials),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal auth failed: ${error}`);
  }

  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('PayPal auth response missing access token');
  return data.access_token;
}

export async function createPayPalOrderWithCredentials(
  credentials: PayPalCredentials,
  params: {
    orderId: string;
    storeId: string;
    amount: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
    idempotencyKey: string;
  },
  options: { fetch?: PayPalFetch } = {},
): Promise<{ id: string; approvalUrl: string }> {
  const fetchImpl = options.fetch ?? fetch;
  const accessToken = await getAccessToken(credentials, { fetch: fetchImpl });

  const response = await fetchImpl(`${getPayPalBaseUrl(credentials.mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': params.idempotencyKey,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.storeId,
          description: `Order #${params.orderId}`,
          custom_id: params.orderId,
          amount: {
            currency_code: params.currency.toUpperCase(),
            value: params.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'LetBuyy Store',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal order creation failed: ${error}`);
  }

  const data = await response.json() as PayPalOrderResponse;
  const approvalLink = data.links?.find((link) => link.rel === 'approve');

  return {
    id: data.id || '',
    approvalUrl: approvalLink?.href || '',
  };
}

export async function createPayPalOrder(params: {
  orderId: string;
  storeId: string;
  amount: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}): Promise<{ id: string; approvalUrl: string }> {
  return createPayPalOrderWithCredentials(getPayPalCredentials(), params);
}

export async function capturePayPalOrderWithCredentials(
  credentials: PayPalCredentials,
  paypalOrderId: string,
  options: { fetch?: PayPalFetch } = {},
): Promise<{
  id: string;
  status: string;
  captureId: string;
}> {
  const fetchImpl = options.fetch ?? fetch;
  const accessToken = await getAccessToken(credentials, { fetch: fetchImpl });

  const response = await fetchImpl(`${getPayPalBaseUrl(credentials.mode)}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal capture failed: ${error}`);
  }

  const data = await response.json() as PayPalCaptureResponse;
  const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id || '';

  return {
    id: data.id || '',
    status: data.status || '',
    captureId,
  };
}

export async function capturePayPalOrder(paypalOrderId: string): Promise<{
  id: string;
  status: string;
  captureId: string;
}> {
  return capturePayPalOrderWithCredentials(getPayPalCredentials(), paypalOrderId);
}

function paypalHeader(headers: PaymentWebhookHeaders | Record<string, string>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

export async function verifyPayPalWebhookSignatureWithCredentials(
  credentials: PayPalCredentials,
  params: {
    body: string;
    headers: PaymentWebhookHeaders | Record<string, string>;
  },
  options: { fetch?: PayPalFetch } = {},
): Promise<boolean> {
  if (!credentials.webhookId) {
    throw new Error('[PayPal] PAYPAL_WEBHOOK_ID must be configured.');
  }

  const fetchImpl = options.fetch ?? fetch;
  const accessToken = await getAccessToken(credentials, { fetch: fetchImpl });
  const response = await fetchImpl(`${getPayPalBaseUrl(credentials.mode)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: paypalHeader(params.headers, 'paypal-auth-algo'),
      cert_url: paypalHeader(params.headers, 'paypal-cert-url'),
      transmission_id: paypalHeader(params.headers, 'paypal-transmission-id'),
      transmission_sig: paypalHeader(params.headers, 'paypal-transmission-sig'),
      transmission_time: paypalHeader(params.headers, 'paypal-transmission-time'),
      webhook_id: credentials.webhookId,
      webhook_event: JSON.parse(params.body) as Record<string, unknown>,
    }),
  });

  if (!response.ok) return false;
  const data = await response.json() as { verification_status?: string };
  return data.verification_status === 'SUCCESS';
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
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
    const parsed = JSON.parse(rawBody) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function createPayPalPaymentProvider(
  credentials: PayPalCredentials,
  options: { fetch?: PayPalFetch } = {},
): PaymentProvider {
  return {
    name: 'paypal',

    async createIntent(input) {
      const amount = normalizePaymentMoney(input.amount);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
      const returnUrl = metadataString(input.metadata, 'return_url');
      const cancelUrl = metadataString(input.metadata, 'cancel_url');

      if (!returnUrl || !cancelUrl) {
        throw new Error('PayPal checkout requires return_url and cancel_url metadata');
      }

      const order = await createPayPalOrderWithCredentials(
        credentials,
        {
          orderId: input.orderId,
          storeId: input.storeId,
          amount: Number(fromInrMinorUnits(amount.amountMinor)),
          currency: amount.currency,
          returnUrl,
          cancelUrl,
          idempotencyKey,
        },
        options,
      );

      if (!order.id || !order.approvalUrl) {
        throw new Error('PayPal order creation did not return an approval URL');
      }

      return {
        provider: 'paypal',
        status: 'requires_action',
        amount,
        idempotencyKey,
        references: {
          providerOrderId: order.id,
        },
        redirectUrl: order.approvalUrl,
        metadata: {
          ...input.metadata,
          approval_url: order.approvalUrl,
        },
      };
    },

    async verify(input): Promise<PaymentVerificationResult> {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);
      const verified = Boolean(input.providerOrderId);

      return {
        provider: 'paypal',
        verified,
        status: verified ? 'authorized' : 'failed',
        amount,
        references: {
          providerOrderId: input.providerOrderId,
          providerPaymentId: input.providerPaymentId,
        },
        failureCode: verified ? undefined : 'PAYPAL_ORDER_REFERENCE_MISSING',
        failureMessage: verified ? undefined : 'PayPal verification requires an order reference',
        metadata: input.metadata,
      };
    },

    async capture(input): Promise<PaymentCaptureResult> {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);

      if (!input.providerOrderId) {
        throw new Error('PayPal capture requires providerOrderId');
      }

      const capture = await capturePayPalOrderWithCredentials(credentials, input.providerOrderId, options);
      const paid = capture.status === 'COMPLETED';

      return {
        provider: 'paypal',
        status: paid ? 'paid' : 'failed',
        capturedAmount: amount,
        references: {
          providerOrderId: capture.id || input.providerOrderId,
          providerPaymentId: capture.captureId || undefined,
        },
        failureCode: paid ? undefined : 'PAYPAL_CAPTURE_FAILED',
        failureMessage: paid ? undefined : `PayPal capture status: ${capture.status || 'unknown'}`,
        metadata: input.metadata,
      };
    },

    async refund(input): Promise<PaymentRefundResult> {
      normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);

      return {
        provider: 'paypal',
        status: 'failed',
        refundedAmount: inrMoney(0),
        references: {
          providerPaymentId: input.paymentId,
        },
        failureCode: 'PAYPAL_REFUND_NOT_WIRED',
        failureMessage: 'PayPal refunds are not wired in the storefront charge path yet',
        metadata: input.metadata,
      };
    },

    async webhookVerify(input): Promise<PaymentWebhookVerificationResult> {
      const verified = await verifyPayPalWebhookSignatureWithCredentials(
        credentials,
        {
          body: input.rawBody,
          headers: input.headers,
        },
        options,
      );
      const payload = jsonPayload(input.rawBody);
      const resource = asRecord(payload.resource);
      const relatedIds = asRecord(asRecord(resource.supplementary_data).related_ids);
      const id = typeof payload.id === 'string' ? payload.id : `paypal:${input.receivedAt}`;
      const type = typeof payload.event_type === 'string' ? payload.event_type : 'unknown';

      return {
        provider: 'paypal',
        verified,
        event: verified
          ? {
            id,
            provider: 'paypal',
            type,
            occurredAt: typeof payload.create_time === 'string' ? payload.create_time : input.receivedAt,
            references: {
              providerEventId: id,
              providerOrderId: textValue(relatedIds.order_id) || textValue(resource.custom_id) || textValue(resource.id),
              providerPaymentId: textValue(resource.id),
            },
            payload,
          }
          : undefined,
        failureCode: verified ? undefined : 'PAYPAL_WEBHOOK_SIGNATURE_INVALID',
        failureMessage: verified ? undefined : 'PayPal webhook signature mismatch',
      };
    },
  };
}
