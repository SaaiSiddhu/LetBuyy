import type { Context } from 'hono';
import { z } from 'zod';
import { DOMAIN_RECONCILE_INTERNAL_CALLER, DOMAIN_RECONCILE_REQUEST_MAX_AGE_MS, DOMAIN_RECONCILE_REQUEST_MAX_BODY_BYTES,
  domainReconcileEnvironment, verifyBoundDomainReconcileSignature } from '@letbuyy/auth-core';
import type { Env } from '../index';
import { getInternalApiKeyring } from './internal-auth';
import { claimInternalAuthReplayJti } from './supabase';
const EmptyBody = z.object({}).strict();
const Query = z.object({ limit: z.string().regex(/^[1-9]\d{0,2}$/).refine(value => Number(value) <= 100).optional() }).strict();
export async function authenticateDomainReconcileRequest(c: Context<{ Bindings: Env }>): Promise<'accepted' | 'denied' | 'unavailable'> {
  const environment = domainReconcileEnvironment(c.env);
  if (!environment) return 'unavailable';
  const keyring = getInternalApiKeyring(c.env);
  const secret = Object.hasOwn(keyring, DOMAIN_RECONCILE_INTERNAL_CALLER) ? keyring[DOMAIN_RECONCILE_INTERNAL_CALLER] : undefined;
  if (!secret) return 'unavailable';
  const query = new URL(c.req.url).searchParams;
  if ([...query.keys()].length > 1 || !Query.safeParse(Object.fromEntries(query)).success) return 'denied';
  const length = c.req.header('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length) > DOMAIN_RECONCILE_REQUEST_MAX_BODY_BYTES)) return 'denied';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reader = c.req.raw.clone().body?.getReader();
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    if (reader) {
      const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => undefined); reject(new Error('Body deadline')); }, 3000); });
      while (true) { const next = await Promise.race([reader.read(), deadline]); if (next.done) break;
        size += next.value.byteLength; if (size > DOMAIN_RECONCILE_REQUEST_MAX_BODY_BYTES) { void reader.cancel().catch(() => undefined); return 'denied'; } chunks.push(next.value); }
    }
    const body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    if (size) { let value: unknown; try { value = JSON.parse(new TextDecoder().decode(body)); } catch { return 'denied'; }
      if (!EmptyBody.safeParse(value).success) return 'denied'; }
    const result = await verifyBoundDomainReconcileSignature({ secret, environment, method: c.req.method, url: c.req.url, body, headers: c.req.raw.headers });
    if (result.status === 'misconfigured') return 'unavailable';
    if (result.status !== 'accepted') return 'denied';
    // Twice the freshness window also covers a valid sender clock ahead of ours.
    const replay = await claimInternalAuthReplayJti(c.env, { kind: 'app:domain-reconcile-bound-request', jti: result.jti,
      ttlSeconds: Math.ceil(DOMAIN_RECONCILE_REQUEST_MAX_AGE_MS * 2 / 1000) });
    return replay === 'claimed' ? 'accepted' : replay === 'unavailable' ? 'unavailable' : 'denied';
  } catch { return 'unavailable'; }
  finally { if (timer) clearTimeout(timer); reader?.releaseLock(); }
}
