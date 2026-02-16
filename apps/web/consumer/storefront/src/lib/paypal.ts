// ============================================================
// PAYPAL — Server-side client & helpers
// ============================================================

import 'server-only';

const PAYPAL_BASE_URL = process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.warn('[PayPal] Client ID or Secret not set — PayPal payments will fail');
}

/**
 * Get a PayPal access token using client credentials.
 */
async function getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

    const res = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`PayPal auth failed: ${error}`);
    }

    const data = await res.json();
    return data.access_token;
}

/**
 * Create a PayPal order.
 */
export async function createPayPalOrder(params: {
    orderId: string;
    storeId: string;
    amount: number;       // in base currency (e.g. 999.00 INR)
    currency: string;
    returnUrl: string;
    cancelUrl: string;
}): Promise<{ id: string; approvalUrl: string }> {
    const accessToken = await getAccessToken();

    const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [
            {
                reference_id: params.orderId,
                description: `Order #${params.orderId}`,
                custom_id: params.storeId,
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
    };

    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`PayPal order creation failed: ${error}`);
    }

    const data = await res.json();
    const approvalLink = data.links?.find((l: { rel: string; href: string }) => l.rel === 'approve');

    return {
        id: data.id,
        approvalUrl: approvalLink?.href || '',
    };
}

/**
 * Capture a PayPal order after buyer approval.
 */
export async function capturePayPalOrder(paypalOrderId: string): Promise<{
    id: string;
    status: string;
    captureId: string;
}> {
    const accessToken = await getAccessToken();

    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`PayPal capture failed: ${error}`);
    }

    const data = await res.json();
    const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id || '';

    return {
        id: data.id,
        status: data.status,
        captureId,
    };
}

/**
 * Verify a PayPal webhook signature.
 */
export async function verifyWebhookSignature(params: {
    body: string;
    headers: Record<string, string>;
}): Promise<boolean> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
        console.warn('[PayPal] PAYPAL_WEBHOOK_ID not set — skipping verification');
        return true; // Skip verification in dev
    }

    const accessToken = await getAccessToken();

    const verifyPayload = {
        auth_algo: params.headers['paypal-auth-algo'],
        cert_url: params.headers['paypal-cert-url'],
        transmission_id: params.headers['paypal-transmission-id'],
        transmission_sig: params.headers['paypal-transmission-sig'],
        transmission_time: params.headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: JSON.parse(params.body),
    };

    const res = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(verifyPayload),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.verification_status === 'SUCCESS';
}
