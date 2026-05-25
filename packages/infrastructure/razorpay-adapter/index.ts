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
