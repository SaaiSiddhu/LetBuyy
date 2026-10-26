import type { Context } from 'hono';
import { STOREFRONT_INTERNAL_CALLER, STOREFRONT_INTERNAL_REQUEST_MAX_BODY_BYTES, verifyBoundStorefrontRequestSignature } from '@letbuyy/auth-core';
import type { Env } from '../index';
import { claimInternalAuthReplayJti } from './supabase';

type GatewayContext = Context<{ Bindings: Env }>;
// A per-invocation marker only: the durable replay claim remains authoritative.
// Reusing a Request in a different worker invocation cannot reuse this Context.
const verifiedInvocations = new WeakSet<GatewayContext>();
function dedicatedStorefrontKey(env: Env): string | undefined {
  try {
    const keyring: unknown = JSON.parse(env.STOREFRONT_INTERNAL_REQUEST_KEYRING || '');
    if (!keyring || typeof keyring !== 'object' || Array.isArray(keyring) || Object.keys(keyring).length !== 1) return undefined;
    const key = (keyring as Record<string, unknown>)[STOREFRONT_INTERNAL_CALLER];
    return typeof key === 'string' ? key : undefined;
  } catch { return undefined; }
}

export function hasBoundStorefrontRequest(c: GatewayContext): boolean { return verifiedInvocations.has(c); }

async function boundedBody(request: Request): Promise<Uint8Array | null> {
  const length = request.headers.get('Content-Length');
  if (length && Number(length) > STOREFRONT_INTERNAL_REQUEST_MAX_BODY_BYTES) return null;
  const reader = request.clone().body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { void reader.cancel().catch(() => undefined); reject(new Error('Storefront request body deadline')); }, 3000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > STOREFRONT_INTERNAL_REQUEST_MAX_BODY_BYTES) { void reader.cancel().catch(() => undefined); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally { if (timer) clearTimeout(timer); reader.releaseLock(); }
}

export async function authenticateBoundStorefrontRequest(c: GatewayContext): Promise<'accepted' | 'denied' | 'unavailable'> {
  try {
    const body = await boundedBody(c.req.raw);
    if (!body) return 'denied';
    const result = await verifyBoundStorefrontRequestSignature({
      secret: dedicatedStorefrontKey(c.env),
      method: c.req.method, url: c.req.url, body, headers: c.req.raw.headers,
    });
    if (result.status === 'misconfigured') return 'unavailable';
    if (result.status !== 'accepted') return 'denied';
    const replay = await claimInternalAuthReplayJti(c.env, { kind: 'app:storefront-bound-request', jti: result.jti, ttlSeconds: 120 });
    if (replay === 'unavailable') return 'unavailable';
    if (replay !== 'claimed') return 'denied';
    verifiedInvocations.add(c);
    return 'accepted';
  } catch { return 'unavailable'; }
}
