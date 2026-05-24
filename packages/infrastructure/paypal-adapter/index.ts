const PAYPAL_BASE_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

function getPayPalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('[PayPal] PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured.');
  }

  return { clientId, clientSecret };
}

async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getPayPalCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
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

export async function createPayPalOrder(params: {
  orderId: string;
  storeId: string;
  amount: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}): Promise<{ id: string; approvalUrl: string }> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
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

  const data = await response.json() as { id?: string; links?: Array<{ rel: string; href: string }> };
  const approvalLink = data.links?.find((link) => link.rel === 'approve');

  return {
    id: data.id || '',
    approvalUrl: approvalLink?.href || '',
  };
}

export async function capturePayPalOrder(paypalOrderId: string): Promise<{
  id: string;
  status: string;
  captureId: string;
}> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`, {
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

  const data = await response.json() as {
    id?: string;
    status?: string;
    purchase_units?: Array<{ payments?: { captures?: Array<{ id?: string }> } }>;
  };
  const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id || '';

  return {
    id: data.id || '',
    status: data.status || '',
    captureId,
  };
}

export async function verifyWebhookSignature(params: {
  body: string;
  headers: Record<string, string>;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error('[PayPal] PAYPAL_WEBHOOK_ID must be configured.');
  }

  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: params.headers['paypal-auth-algo'],
      cert_url: params.headers['paypal-cert-url'],
      transmission_id: params.headers['paypal-transmission-id'],
      transmission_sig: params.headers['paypal-transmission-sig'],
      transmission_time: params.headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: JSON.parse(params.body) as Record<string, unknown>,
    }),
  });

  if (!response.ok) return false;
  const data = await response.json() as { verification_status?: string };
  return data.verification_status === 'SUCCESS';
}
