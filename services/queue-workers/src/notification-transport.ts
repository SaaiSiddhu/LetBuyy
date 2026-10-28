import { createNotificationRequestHeaders, domainReconcileEnvironment, NOTIFICATION_REQUEST_PATH } from '@letbuyy/auth-core';
import { NotificationWorkerRequestSchema, NotificationWorkerResponseSchema, type NotificationWorkerRequest } from '@letbuyy/notification-core';
import type { GatewayServiceBinding } from '@letbuyy/infrastructure/gateway-events-adapter';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';

export type NotificationRpcClient = Pick<SupabaseClient, 'rpc'>;
type RpcReply = { data: unknown; error: { code: string; message: string } | null };
type TransportEnv = { API_GATEWAY_SERVICE?: GatewayServiceBinding; INTERNAL_API_SECRET?: string; ENVIRONMENT?: string; APP_ENV?: string; DEPLOYMENT_ENV?: string };
const denied = (): RpcReply => ({ data: null, error: { code: '22023', message: 'Unsupported notification operation' } });
const unavailable = (): RpcReply => ({ data: null, error: { code: 'NOTIFICATION_JOB_UNAVAILABLE', message: 'Notification transport is unavailable' } });

/** Await-only RPC compatibility for the existing consumer. No table/query API
 * or arbitrary procedure can be sent across this service binding. */
export function createNotificationRpcClient(env: TransportEnv, workerId: string): NotificationRpcClient {
  let recovered = false;
  const invitations = new Map<string, string>();
  async function execute(request: NotificationWorkerRequest): Promise<RpcReply> {
    const environment = domainReconcileEnvironment(env);
    if (!environment || !env.API_GATEWAY_SERVICE || !env.INTERNAL_API_SECRET) return unavailable();
    const parsed = NotificationWorkerRequestSchema.safeParse(request); if (!parsed.success) return denied();
    const body = JSON.stringify(parsed.data), bytes = new TextEncoder().encode(body);
    const url = 'https://queue-workers.internal' + NOTIFICATION_REQUEST_PATH;
    try {
      const headers = await createNotificationRequestHeaders({ secret: env.INTERNAL_API_SECRET, environment, method: 'POST', url, body: bytes });
      const response = await env.API_GATEWAY_SERVICE.fetch(new Request(url, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(15_000) }));
      if (!response.ok) return response.status === 409 ? denied() : unavailable();
      if (Number(response.headers.get('Content-Length') || 0) > 1_024_000) return unavailable();
      const reader = response.body?.getReader(); if (!reader) return unavailable();
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        while (true) { const next = await reader.read(); if (next.done) break;
          length += next.value.byteLength; if (length > 1_024_000) { await reader.cancel(); return unavailable(); } chunks.push(next.value); }
      } finally { reader.releaseLock(); }
      const raw = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; }
      const value = NotificationWorkerResponseSchema.safeParse(JSON.parse(new TextDecoder().decode(raw)));
      return value.success ? { data: value.data.data.result, error: null } : unavailable();
    } catch { return unavailable(); }
  }
  async function rpc(name: string, args: Record<string, unknown> = {}): Promise<RpcReply> {
    if (args.p_worker_id !== undefined && args.p_worker_id !== workerId) return denied();
    const frame = { worker_id: workerId };
    if (['recover_expired_staff_invitation_jobs_v1', 'recover_expired_console_security_email_jobs_v1', 'recover_expired_order_email_jobs_v1'].includes(name)) {
      if (recovered) return { data: 0, error: null };
      const result = await execute({ ...frame, operation: 'recover', payload: {} });
      if (!result.error) recovered = true; return result;
    }
    if (name === 'claim_platform_queue_jobs') {
      if (args.p_queue_name !== 'notification-jobs' || args.p_lock_seconds !== 120) return denied();
      // One order takes up to five API/provider hops. Leave room for recovery,
      // ACK failure handling and the other scheduled work on Workers Free.
      const result = await execute({ ...frame, operation: 'claim', payload: { limit: Math.min(5, Number(args.p_limit)) } });
      if (!result.error && Array.isArray(result.data)) for (const job of result.data) {
        if (job && typeof job === 'object' && 'job_type' in job && job.job_type === 'email.employee_invite'
          && 'id' in job && typeof job.id === 'string' && 'payload' in job && job.payload && typeof job.payload === 'object'
          && 'invitation_id' in job.payload && typeof job.payload.invitation_id === 'string') invitations.set(job.payload.invitation_id, job.id);
      }
      return result;
    }
    const jobId = name === 'merchant_staff_invitation_delivery_v1' ? invitations.get(String(args.p_invite_id)) : args.p_job_id;
    if (typeof jobId !== 'string') return denied();
    let operation: unknown;
    switch (name) {
      case 'order_lifecycle_email_delivery_v1': operation = { operation: 'order-delivery', payload: {} }; break;
      case 'seal_order_lifecycle_email_message_v1': operation = { operation: 'order-seal', payload: { log_id: args.p_log_id, message: args.p_message } }; break;
      case 'complete_order_lifecycle_email_v1': operation = { operation: 'order-receipt', payload: { log_id: args.p_log_id, provider_id: args.p_provider_id, subject: args.p_subject } }; break;
      case 'merchant_staff_invitation_delivery_v1': operation = { operation: 'staff-delivery', payload: { invitation_id: args.p_invite_id } }; break;
      case 'console_mfa_reset_delivery_v1': operation = { operation: 'operator-delivery', payload: { sender: args.p_sender ?? null } }; break;
      case 'complete_platform_queue_job': operation = { operation: 'complete', payload: { result: args.p_result ?? {} } }; break;
      case 'fail_platform_queue_job': operation = { operation: 'fail', payload: { message: args.p_error_message, retry_seconds: args.p_retry_seconds, result: args.p_result ?? {} } }; break;
      case 'quarantine_platform_queue_job': operation = { operation: 'quarantine', payload: { message: args.p_error_message, result: args.p_result ?? {} } }; break;
      default: return denied();
    }
    const parsed = NotificationWorkerRequestSchema.safeParse({ ...frame, job_id: jobId, ...(operation as Record<string, unknown>) });
    return parsed.success ? execute(parsed.data) : denied();
  }
  // The consumer only awaits rpc(); no PostgREST builder/chaining is exposed.
  return { rpc: rpc as unknown as SupabaseClient['rpc'] };
}
