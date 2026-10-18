import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { AppError } from '../lib/errors';
import { getSupabaseAdmin } from '../lib/supabase';
import { ReelReviewAdapter } from './reel-review.adapter';
import {
  REEL_UPLOAD_METADATA_BYTES, ReelUploadBeginSchema, ReelUploadRetrySchema,
  ReelUploadReadbackSchema, type ReelUploadReadback, type ReelUploadCapabilities,
} from '@letbuyy/shared-types';
import {
  transferPrivateOriginal, inspectPrivateOriginal, privateOriginalRuntimeAvailable,
  type PrivateReelOriginalIntent, type PrivateR2Binding,
} from '@letbuyy/infrastructure/storage-adapter';
import disabledProfile from '../../../../config/media/reel-custody-profiles.json';

type C = Context<{ Bindings: Env }>;
const safeInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const seconds = z.number().int().positive().max(2147483647);
const mimes = z.array(z.enum(['video/mp4', 'video/webm'])).min(1).max(2);
export const ReelUploadProfileSchema = z.object({
  private_upload_enabled: z.literal(true), processing_enabled: z.literal(false), inspection_enabled: z.literal(false),
  approved_profile_ref: z.string().min(1).max(200),
  profile: z.object({
    binding_ref: z.literal('REEL_ORIGINALS_BUCKET'), accepted_types: mimes,
    max_bytes: safeInteger, max_intents: seconds, max_charged_bytes: safeInteger,
    reservation_ttl_seconds: seconds, lease_seconds: seconds, max_wall_ms: seconds,
    gateway_ingress_max_bytes: safeInteger, merchant_ingress_max_bytes: safeInteger,
  }).strict(),
}).strict().superRefine((value, ctx) => {
  const p = value.profile;
  if (p.max_bytes > Math.min(p.gateway_ingress_max_bytes, p.merchant_ingress_max_bytes, p.max_charged_bytes)
    || p.lease_seconds * 1000 <= p.max_wall_ms || new Set(p.accepted_types).size !== p.accepted_types.length) {
    ctx.addIssue({ code: 'custom', message: 'Unsupported approved transfer envelope' });
  }
});
export type ReelUploadProfile = z.infer<typeof ReelUploadProfileSchema>;
export function parseReelUploadProfile(value: unknown): ReelUploadProfile | null {
  if (typeof value === 'string') {
    if (value.length > REEL_UPLOAD_METADATA_BYTES) return null;
    try { value = JSON.parse(value); } catch { return null; }
  }
  const parsed = ReelUploadProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
const unavailable = () => new AppError('Private original upload is unavailable. Your saved drafts are preserved.', 503, 'REEL_PRIVATE_INTAKE_UNAVAILABLE');
const requestInvalid = () => new AppError('Invalid private upload request.', 400, 'REEL_UPLOAD_REQUEST_INVALID');
export async function readReelUploadJson(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new AppError('Expected JSON.', 415, 'REEL_UPLOAD_REQUEST_INVALID');
  const reader = request.body?.getReader();
  if (!reader) throw requestInvalid();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > REEL_UPLOAD_METADATA_BYTES) { await reader.cancel(); throw new AppError('Upload metadata exceeds its technical intake limit.', 413, 'REEL_UPLOAD_REQUEST_INVALID'); }
      chunks.push(value);
    }
  } catch (error) { if (error instanceof AppError) throw error; throw requestInvalid(); }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)); } catch { throw requestInvalid(); }
}
const failures: Record<string, number> = {
  REEL_UPLOAD_SESSION_REQUIRED: 401, REEL_UPLOAD_NOT_FOUND: 404,
  REEL_UPLOAD_REQUEST_INVALID: 400, REEL_UPLOAD_LIMIT: 413, REEL_UPLOAD_QUOTA: 409,
  REEL_UPLOAD_IDEMPOTENCY_CONFLICT: 409, REEL_UPLOAD_VERSION_CONFLICT: 409,
  REEL_UPLOAD_BUSY: 409, REEL_UPLOAD_EXPIRED: 409, REEL_UPLOAD_OBJECT_UNCONFIRMED: 409,
  REEL_UPLOAD_PROFILE_UNAVAILABLE: 503, REEL_UPLOAD_PROFILE_CHANGED: 503,
  REEL_UPLOAD_LEASE_CONFLICT: 409, REEL_UPLOAD_CUSTODY_PROOF_INVALID: 409,
  REEL_UPLOAD_COMPLETION_CONFLICT: 409, REEL_UPLOAD_RECEIPT_UNAVAILABLE: 503,
  REEL_MERCHANT_REQUIRED: 403,
};
const uuid = z.string().uuid();
const internalSchema = z.object({
  object_nonce: uuid, object_version: z.string().nullable(), profile_digest: z.string().regex(/^[a-f0-9]{64}$/),
  checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/), size_bytes: safeInteger, content_type: z.enum(['video/mp4', 'video/webm']),
}).strict();
const envelope = z.object({ data: z.unknown().optional(), internal: internalSchema.optional(), status: z.number().optional(), error: z.string().optional() }).strict();
const sha = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');

export class ReelUploadAdapter {
  constructor(private readonly c: C) {}
  private site(input?: string): string {
    if (!uuid.safeParse(input).success) throw requestInvalid();
    const bound = this.c.get('auth').user.storeId;
    if (bound && bound !== input) throw new AppError('Current store content permission is required.', 403, 'REEL_MERCHANT_REQUIRED');
    return input!.toLowerCase();
  }
  private session(): string {
    const token = this.c.req.header('X-LetBuyy-Internal-Session-Token');
    if (!token || this.c.get('auth').user.authSource !== 'internal-sso') throw new AppError('A current merchant session is required.', 401, 'REEL_UPLOAD_SESSION_REQUIRED');
    return token;
  }
  private configured(): ReelUploadProfile | null {
    const profile = parseReelUploadProfile(this.c.env.REEL_CUSTODY_PROFILE ?? disabledProfile);
    return profile && this.c.env.REEL_ORIGINALS_BUCKET && privateOriginalRuntimeAvailable() ? profile : null;
  }
  private async admission(profile: ReelUploadProfile) {
    const p = profile.profile;
    return { profile_ref: profile.approved_profile_ref, profile_digest: await sha(JSON.stringify(profile)),
      max_bytes: p.max_bytes, max_intents: p.max_intents, max_charged_bytes: p.max_charged_bytes,
      reservation_ttl_seconds: p.reservation_ttl_seconds, lease_seconds: p.lease_seconds, max_wall_ms: p.max_wall_ms };
  }
  private async call(site: string, action: string, id: string | null, command: unknown = null, admission: unknown = null, evidence: unknown = null) {
    const { data, error } = await getSupabaseAdmin(this.c).rpc('reel_upload_v1', {
      p_session: this.session(), p_actor: this.c.get('auth').user.id, p_site: site, p_action: action,
      p_intent: id, p_command: command, p_admission: admission, p_evidence: evidence,
    });
    if (error) {
      const code = Object.keys(failures).find(key => error.message?.includes(key));
      if (code) throw new AppError(code === 'REEL_UPLOAD_QUOTA' ? 'The private storage reservation limit has been reached.' : 'This private upload cannot continue. Reload its current status.', failures[code], code);
      throw new AppError('Private intake storage is unavailable. Retry the same request.', 503, 'REEL_UPLOAD_STORAGE_UNAVAILABLE');
    }
    const result = envelope.safeParse(data);
    if (!result.success) throw new AppError('Private intake readback is unavailable.', 503, 'REEL_UPLOAD_STORAGE_UNAVAILABLE');
    if (result.data.error) throw new AppError('Reload the current private upload status.', failures[result.data.error] ?? 503, result.data.error in failures ? result.data.error : 'REEL_UPLOAD_STORAGE_UNAVAILABLE');
    return result.data;
  }
  private readback(value: unknown): ReelUploadReadback {
    const parsed = ReelUploadReadbackSchema.safeParse(value);
    if (!parsed.success) throw new AppError('Private intake readback is unavailable.', 503, 'REEL_UPLOAD_STORAGE_UNAVAILABLE');
    return parsed.data;
  }
  async capabilities(input?: string): Promise<ReelUploadCapabilities> {
    const site = this.site(input);
    await new ReelReviewAdapter(this.c).run({ siteId: site, page: 1 });
    const profile = this.configured();
    const enabled = profile !== null && Boolean(this.c.req.header('X-LetBuyy-Internal-Session-Token'));
    return { private_upload_enabled: enabled, processing_enabled: false, inspection_enabled: false,
      max_bytes: enabled ? profile!.profile.max_bytes : null, accepted_types: enabled ? profile!.profile.accepted_types : [] };
  }
  async list(input?: string) {
    const result = await this.call(this.site(input), 'list', null);
    const parsed = z.object({ items: z.array(ReelUploadReadbackSchema).max(50) }).strict().safeParse(result.data);
    if (!parsed.success) throw unavailable();
    return parsed.data;
  }
  async read(input: string | undefined, id: string) {
    if (!uuid.safeParse(id).success) throw requestInvalid();
    return this.readback((await this.call(this.site(input), 'read', id)).data);
  }
  async begin(input: string | undefined, command: unknown) {
    const site = this.site(input), profile = this.configured();
    if (!profile) throw unavailable();
    const parsed = ReelUploadBeginSchema.safeParse(command);
    if (!parsed.success) throw requestInvalid();
    if (!profile.profile.accepted_types.includes(parsed.data.content_type) || parsed.data.size_bytes > profile.profile.max_bytes) throw new AppError('The file exceeds the approved transfer envelope.', 413, 'REEL_UPLOAD_LIMIT');
    return this.readback((await this.call(site, 'begin', null, parsed.data, await this.admission(profile))).data);
  }
  async transfer(input: string | undefined, id: string, command: unknown, request: Request | null) {
    const site = this.site(input), profile = this.configured();
    if (!profile) throw unavailable();
    if (!uuid.safeParse(id).success) throw requestInvalid();
    const parsed = ReelUploadRetrySchema.safeParse(command);
    if (!parsed.success) throw requestInvalid();
    const mime = request?.headers.get('content-type')?.toLowerCase();
    if (request && (!mime || !profile.profile.accepted_types.includes(mime as 'video/mp4' | 'video/webm') || request.headers.has('content-encoding') || !request.body)) throw new AppError('Expected the original binary video body.', 415, 'REEL_UPLOAD_REQUEST_INVALID');
    // Reject mismatched declared transport headers before a durable claim.
    const before = this.readback((await this.call(site, 'read', id)).data);
    if (request && mime !== before.content_type) throw requestInvalid();
    const declaredLength = request?.headers.get('content-length');
    if (declaredLength && (!/^[0-9]+$/.test(declaredLength) || Number(declaredLength) !== before.size_bytes)) throw requestInvalid();
    const admission = await this.admission(profile), lease = crypto.randomUUID();
    const claimed = await this.call(site, request ? 'claim_transfer' : 'claim_reconcile', id, parsed.data, admission, { lease_token: lease });
    const row = this.readback(claimed.data), internal = claimed.internal;
    if (!internal || (request && mime !== internal.content_type)) throw requestInvalid();
    const length = request?.headers.get('content-length');
    if (length && (!/^[0-9]+$/.test(length) || Number(length) !== internal.size_bytes)) {
      await this.uncertain(site, row, admission, lease); throw requestInvalid();
    }
    const intent: PrivateReelOriginalIntent = { siteId: site, intentId: row.id, objectNonce: internal.object_nonce,
      profileDigest: internal.profile_digest, bytes: internal.size_bytes, sha256: internal.checksum_sha256,
      contentType: internal.content_type, expectedVersion: internal.object_version };
    const retry = { idempotency_key: row.idempotency_key, expected_version: row.version };
    const bucket = this.c.env.REEL_ORIGINALS_BUCKET as unknown as PrivateR2Binding;
    let proof;
    try {
      const budget = { maxBytes: profile.profile.max_bytes, maxWallMs: profile.profile.max_wall_ms };
      proof = request && row.state !== 'received_unprocessed'
        ? await transferPrivateOriginal(bucket, intent, request.body!, budget, request.signal)
        : await inspectPrivateOriginal(bucket, intent, budget, request?.signal);
      if (request && row.state === 'received_unprocessed') void request.body?.cancel().catch(() => undefined);
    } catch {
      await this.uncertain(site, row, admission, lease);
      throw new AppError('The transfer outcome is unconfirmed. Check this same intake before retrying.', 503, 'REEL_UPLOAD_TRANSFER_UNCERTAIN');
    }
    // Canonical session row lock and live actor/site/staff checks run again in
    // this final transaction, including completed-receipt replays.
    const result = await this.call(site, 'finish', id, retry, admission, {
      lease_token: lease, object_key: proof.key, object_version: proof.objectVersion,
      actual_bytes: proof.actualBytes, actual_sha256: proof.actualSha256,
      content_type: proof.signatureConsistentContentType, profile_digest: proof.profileDigest,
      verification_scope: proof.verificationScope,
    });
    return this.readback(result.data);
  }
  private async uncertain(site: string, row: ReelUploadReadback, admission: unknown, lease: string) {
    if (row.state === 'received_unprocessed') return;
    try { await this.call(site, 'unknown', row.id, { idempotency_key: row.idempotency_key, expected_version: row.version }, admission, { lease_token: lease }); }
    catch { /* The durable claim still retains its charge/key; no new key or deletion. */ }
  }
}
