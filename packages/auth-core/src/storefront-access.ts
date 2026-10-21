const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const LETBUYY_STOREFRONT_GATE_COOKIE = '__Host-lb_store_gate';
export const LETBUYY_STOREFRONT_PREVIEW_COOKIE = '__Host-lb_preview';
export const LETBUYY_STOREFRONT_PREVIEW_QUERY = 'lb_preview';
export const LETBUYY_STOREFRONT_GATE_TTL_SECONDS = 60 * 60;
export const LETBUYY_PREVIEW_MERCHANT_TTL_SECONDS = 30 * 60;
export const LETBUYY_PREVIEW_SHARE_TTL_SECONDS = 7 * 24 * 60 * 60;

export type StorefrontPreviewScope = 'merchant-preview' | 'share-link';

export interface StorefrontPreviewTokenPayload {
  sid: string;
  scope: StorefrontPreviewScope;
  theme_id?: string | null;
  exp: number;
  jti: string;
  host: string;
}

export interface StorefrontGateTokenPayload {
  sid: string;
  host: string;
  exp: number;
  /** Opaque current password revision; the Gateway enforces revocation. */
  revision?: string;
}

export type StorefrontSignedTokenStatus =
  | 'valid'
  | 'missing'
  | 'malformed'
  | 'expired'
  | 'host_mismatch'
  | 'invalid_signature'
  | 'wrong_purpose'
  | 'misconfigured';

export interface StorefrontSignedTokenResult<TPayload> {
  valid: boolean;
  status: StorefrontSignedTokenStatus;
  payload?: TPayload;
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? textEncoder.encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Uint8Array | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(data)));
  return base64UrlEncode(signature);
}

async function verifySignature(data: string, signature: string, secret: string): Promise<boolean> {
  const key = await importHmacKey(secret);
  const signatureBytes = base64UrlDecode(signature);
  if (!signatureBytes) return false;
  return crypto.subtle.verify('HMAC', key, signatureBytes as BufferSource, textEncoder.encode(data));
}

function normalizeHost(host: string): string {
  return host.split(',')[0]?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '') || '';
}

export async function createStorefrontSignedToken<TPayload extends object>(
  payload: TPayload,
  secret: string,
): Promise<string> {
  if (!secret || secret.length < 16) {
    throw new Error('STORE_ACCESS_SIGNING_KEY/PREVIEW_SIGNING_KEY is required and must be at least 16 characters');
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifyStorefrontSignedToken<TPayload extends { exp: number; host?: string | null }>(
  token: string | null | undefined,
  secret: string | null | undefined,
  options: { expectedHost?: string | null; nowSeconds?: number } = {},
): Promise<StorefrontSignedTokenResult<TPayload>> {
  if (!token) return { valid: false, status: 'missing' };
  if (!secret || secret.length < 16) return { valid: false, status: 'misconfigured' };

  const [encodedPayload, signature, extra] = token.split('.');
  if (!encodedPayload || !signature || extra !== undefined) return { valid: false, status: 'malformed' };

  const signatureOk = await verifySignature(encodedPayload, signature, secret);
  if (!signatureOk) return { valid: false, status: 'invalid_signature' };

  const decoded = base64UrlDecode(encodedPayload);
  if (!decoded) return { valid: false, status: 'malformed' };

  let payload: TPayload;
  try {
    payload = JSON.parse(textDecoder.decode(decoded)) as TPayload;
  } catch {
    return { valid: false, status: 'malformed' };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || (payload.host != null && typeof payload.host !== 'string')) {
    return { valid: false, status: 'malformed' };
  }

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) {
    return { valid: false, status: 'expired', payload };
  }

  if (options.expectedHost && (!payload.host || normalizeHost(payload.host) !== normalizeHost(options.expectedHost))) {
    return { valid: false, status: 'host_mismatch', payload };
  }

  return { valid: true, status: 'valid', payload };
}

export function createStorefrontPreviewToken(
  payload: StorefrontPreviewTokenPayload,
  secret: string,
): Promise<string> {
  return createStorefrontSignedToken({ ...payload, kind: 'storefront-preview' }, secret);
}

export async function verifyStorefrontPreviewToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  options: { expectedHost?: string | null; nowSeconds?: number } = {},
): Promise<StorefrontSignedTokenResult<StorefrontPreviewTokenPayload>> {
  const result = await verifyStorefrontSignedToken<StorefrontPreviewTokenPayload & { kind?: string }>(token, secret, options);
  if (!result.valid || !result.payload) return result;
  if (result.payload.kind !== 'storefront-preview') return { valid: false, status: 'wrong_purpose' };
  if (!validStorefrontScope(result.payload)
    || !['merchant-preview', 'share-link'].includes(result.payload.scope)
    || typeof result.payload.jti !== 'string' || result.payload.jti.length < 16 || result.payload.jti.length > 128) {
    return { valid: false, status: 'malformed' };
  }
  return result;
}

export function createStorefrontGateToken(
  payload: StorefrontGateTokenPayload,
  secret: string,
): Promise<string> {
  return createStorefrontSignedToken({ ...payload, kind: 'storefront-gate' }, secret);
}

export async function verifyStorefrontGateToken(
  token: string | null | undefined,
  secret: string | null | undefined,
  options: { expectedHost?: string | null; nowSeconds?: number } = {},
): Promise<StorefrontSignedTokenResult<StorefrontGateTokenPayload>> {
  const result = await verifyStorefrontSignedToken<StorefrontGateTokenPayload & { kind?: string }>(token, secret, options);
  if (!result.valid || !result.payload) return result;
  if (result.payload.kind !== 'storefront-gate') return { valid: false, status: 'wrong_purpose' };
  if (!validStorefrontScope(result.payload)
    || (result.payload.revision != null && !/^[a-f0-9]{64}$/.test(result.payload.revision))) {
    return { valid: false, status: 'malformed' };
  }
  return result;
}

function validStorefrontScope(payload: { sid: string; host: string }): boolean {
  return typeof payload.sid === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload.sid)
    && typeof payload.host === 'string' && payload.host.length > 0 && payload.host.length <= 300
    && !/[\s,@/\\]/.test(payload.host);
}
