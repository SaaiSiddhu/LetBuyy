const customerSessionTextEncoder = new TextEncoder();
const customerSessionTextDecoder = new TextDecoder();

export const LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS = 30 * 60;

export interface CustomerSessionIdentity {
  storeId: string;
  customerId: string;
}

export interface CustomerSessionOptions {
  nowSeconds?: number;
  ttlSeconds?: number;
}

export interface IssuedCustomerSession {
  token: string;
  expiresAt: string;
}

interface CustomerSessionPayload {
  store_id: string;
  customer_id: string;
  iat: number;
  exp: number;
}

export async function issueCustomerSession(
  subject: CustomerSessionIdentity,
  secret: string,
  options: CustomerSessionOptions = {},
): Promise<IssuedCustomerSession> {
  const normalizedSecret = normalizeCustomerSessionSecret(secret);
  if (!normalizedSecret) {
    throw new Error('Customer session secret is required');
  }

  const storeId = normalizeCustomerSessionId(subject.storeId);
  const customerId = normalizeCustomerSessionId(subject.customerId);
  if (!storeId || !customerId) {
    throw new Error('Customer session subject is malformed');
  }

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS;
  const payload: CustomerSessionPayload = {
    store_id: storeId,
    customer_id: customerId,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const signingInput = `${customerSessionBase64UrlEncodeJson({ alg: 'HS256', typ: 'JWT' })}.${customerSessionBase64UrlEncodeJson(payload)}`;
  const signature = customerSessionBase64UrlEncodeBytes(await customerSessionHmacSha256Bytes(normalizedSecret, signingInput));

  return {
    token: `${signingInput}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export async function verifyCustomerSession(
  token: string | null | undefined,
  secret: string | null | undefined,
  options: CustomerSessionOptions = {},
): Promise<CustomerSessionIdentity | null> {
  const normalizedToken = normalizeCustomerSessionToken(token);
  const normalizedSecret = normalizeCustomerSessionSecret(secret);
  if (!normalizedToken || !normalizedSecret) return null;

  const [encodedHeader, encodedPayload, signature] = normalizedToken.split('.');
  let header: { alg?: unknown };
  let payload: CustomerSessionPayload;

  try {
    header = JSON.parse(customerSessionTextDecoder.decode(customerSessionBase64UrlToBytes(encodedHeader))) as {
      alg?: unknown;
    };
    payload = JSON.parse(customerSessionTextDecoder.decode(customerSessionBase64UrlToBytes(encodedPayload))) as CustomerSessionPayload;
  } catch {
    return null;
  }

  if (header.alg !== 'HS256' || !isCustomerSessionPayload(payload)) {
    return null;
  }

  const expectedSignature = customerSessionBase64UrlEncodeBytes(
    await customerSessionHmacSha256Bytes(normalizedSecret, `${encodedHeader}.${encodedPayload}`),
  );
  if (!customerSessionTimingSafeEqual(expectedSignature, signature)) {
    return null;
  }

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) {
    return null;
  }

  return {
    storeId: payload.store_id,
    customerId: payload.customer_id,
  };
}

function normalizeCustomerSessionSecret(value: string | null | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

function normalizeCustomerSessionId(value: string | null | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > 128 || /[\u0000-\u001F\u007F]/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeCustomerSessionToken(value: string | null | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    !normalized ||
    normalized !== value ||
    normalized.length > 4096 ||
    normalized.split('.').length !== 3 ||
    !/^[A-Za-z0-9._~-]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function isCustomerSessionPayload(value: CustomerSessionPayload): value is CustomerSessionPayload {
  return Boolean(
    value &&
      normalizeCustomerSessionId(value.store_id) &&
      normalizeCustomerSessionId(value.customer_id) &&
      Number.isFinite(value.iat) &&
      Number.isFinite(value.exp) &&
      value.exp > value.iat,
  );
}

async function customerSessionHmacSha256Bytes(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    customerSessionTextEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, customerSessionTextEncoder.encode(payload));
  return new Uint8Array(signature);
}

function customerSessionBase64UrlEncodeJson(value: unknown): string {
  return customerSessionBase64UrlEncodeBytes(customerSessionTextEncoder.encode(JSON.stringify(value)));
}

function customerSessionBase64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function customerSessionBase64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function customerSessionTimingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}
