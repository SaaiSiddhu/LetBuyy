import type { Context } from 'hono';
import { domainReconcileEnvironment, NOTIFICATION_REQUEST_MAX_BYTES, verifyNotificationRequest } from '@letbuyy/auth-core';
import { NotificationWorkerRequestSchema, type NotificationWorkerRequest } from '@letbuyy/notification-core';
import type { Env } from '../index';
import { claimInternalAuthReplayJti } from './supabase';

const admitted = new WeakMap<Request, NotificationWorkerRequest>();
export const admittedNotificationRequest = (request: Request) => admitted.get(request);

export async function authenticateNotificationRequest(c: Context<{ Bindings: Env }>): Promise<'accepted' | 'denied' | 'unavailable'> {
  const environment = domainReconcileEnvironment(c.env);
  if (!environment) return 'unavailable';
  const length = c.req.header('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length) > NOTIFICATION_REQUEST_MAX_BYTES)) return 'denied';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reader = c.req.raw.clone().body?.getReader();
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    if (reader) {
      const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => undefined); reject(new Error('Body deadline')); }, 3000); });
      while (true) {
        const next = await Promise.race([reader.read(), deadline]); if (next.done) break;
        size += next.value.byteLength;
        if (size > NOTIFICATION_REQUEST_MAX_BYTES) { void reader.cancel().catch(() => undefined); return 'denied'; }
        chunks.push(next.value);
      }
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let value: unknown; try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { return 'denied'; }
    const parsed = NotificationWorkerRequestSchema.safeParse(value); if (!parsed.success) return 'denied';
    const verified = await verifyNotificationRequest({ secret: c.env.INTERNAL_API_SECRET, environment,
      method: c.req.method, url: c.req.url, body: bytes, headers: c.req.raw.headers });
    if (verified.status !== 'accepted') return verified.status;
    const claimed = await claimInternalAuthReplayJti(c.env, { kind: 'app:notification-job-request', jti: verified.jti, ttlSeconds: 240 });
    if (claimed !== 'claimed') return claimed === 'unavailable' ? 'unavailable' : 'denied';
    admitted.set(c.req.raw, parsed.data); return 'accepted';
  } catch { return 'unavailable'; }
  finally { if (timer) clearTimeout(timer); reader?.releaseLock(); }
}
