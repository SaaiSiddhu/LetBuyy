import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { AppError } from '../lib/errors';
import { resolveCustomUser } from '../lib/auth-user';
import { getSupabaseAdmin } from '../lib/supabase';
import { requireConsolePermission } from '../identity-foundation/console-approval-repository';
import { REEL_REVIEW_REQUEST_BYTES } from '../schemas/reel.schema';

type C = Context<{ Bindings: Env }>;
const uuid = z.string().uuid();
const errors: Record<string, [number, string]> = {
  REEL_VERSION_CONFLICT: [409, 'This reel changed. Reload the current revision before saving.'],
  REEL_IDEMPOTENCY_CONFLICT: [409, 'This request key names a different command. Reload before making another change.'],
  REEL_CUSTODY_UNAVAILABLE: [503, 'Verified private media processing is unavailable. Your saved draft is preserved.'],
  REEL_INSPECTION_UNAVAILABLE: [503, 'Verified private inspection and approved rights policy are unavailable. Approval is disabled.'],
  REEL_PRODUCT_REVISION_STALE: [409, 'The reviewed product or media changed. Create a new submission.'],
  REEL_LISTING_UNAVAILABLE: [409, 'Select a current eligible listing owned by this store.'],
  REEL_VARIANT_MISMATCH: [409, 'Select a current canonical variant of this product.'],
  REEL_RIGHTS_EVIDENCE_UNAVAILABLE: [409, 'Selected rights evidence is unavailable for this store.'],
  REEL_NOT_FOUND: [404, 'Reel not found.'],
  REEL_STATE_CONFLICT: [409, 'This reel cannot perform that action in its current state.'],
  REEL_ASSIGNMENT_REQUIRED: [403, 'Only the current assigned reviewer can decide this revision.'],
  REEL_SELF_REVIEW_DENIED: [403, 'A merchant cannot review their own reel.'],
  REEL_MERCHANT_REQUIRED: [403, 'Current store content permission is required.'],
  REEL_OPERATOR_REQUIRED: [403, 'A current permitted reviewer session is required.'],
  REEL_REALM_DENIED: [403, 'This operation belongs to another actor realm.'],
  REEL_REASON_REQUIRED: [400, 'Enter an actionable reason of eight to one thousand characters.'],
  REEL_REQUEST_INVALID: [400, 'Invalid reel request.'],
};

/** Bytes are capped while reading, even without Content-Length. No unbounded req.json(). */
export async function readReelRequest(c: C): Promise<unknown> {
  if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json')) throw new AppError('Expected JSON.', 415, 'REEL_REQUEST_INVALID');
  const reader = c.req.raw.body?.getReader();
  if (!reader) throw new AppError('Expected a request body.', 400, 'REEL_REQUEST_INVALID');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > REEL_REVIEW_REQUEST_BYTES) { await reader.cancel(); throw new AppError('Reel request exceeds the technical intake budget.', 413, 'REEL_REQUEST_INVALID'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)); }
  catch { throw new AppError('Invalid JSON.', 400, 'REEL_REQUEST_INVALID'); }
}

export class ReelReviewAdapter {
  constructor(private readonly c: C) {}

  private async rpc(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data, error } = await getSupabaseAdmin(this.c).rpc(name, args);
    if (error) {
      const key = Object.keys(errors).find((code) => error.message?.includes(code));
      if (key) throw new AppError(errors[key][1], errors[key][0], key);
      if (error.code === '22P02' || error.code === '22023' || error.code === '22P05') throw new AppError('Invalid reel reference or text encoding.', 400, 'REEL_REQUEST_INVALID');
      throw new AppError('Reel storage is unavailable. Retry the same request.', 503, 'REEL_STORAGE_UNAVAILABLE');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('Reel readback is unavailable.', 503, 'REEL_STORAGE_UNAVAILABLE');
    return data as Record<string, unknown>;
  }

  async run(input: { siteId?: string; reelId?: string; page?: number; command?: unknown; operator?: boolean }) {
    let actor: string | null = null; let consoleProof: Record<string, string> | null = null;
    if (input.operator) {
      const { credential, witness } = await requireConsolePermission(this.c, input.command ? 'review:decide' : 'review:view', Boolean(input.command));
      consoleProof = { session_id: credential.payload.sessionId, cookie_sha256: credential.digest, permission_hash: witness };
    } else {
      const user = await resolveCustomUser(getSupabaseAdmin(this.c), this.c.get('auth').user);
      if (!user) throw new AppError('Sign in as a merchant.', 403, 'REEL_MERCHANT_REQUIRED');
      actor = user.id;
      const bound = this.c.get('auth').user.storeId;
      if (bound && bound !== input.siteId) throw new AppError('This session belongs to another store.', 403, 'REEL_MERCHANT_REQUIRED');
    }
    if (input.reelId && !uuid.safeParse(input.reelId).success) throw new AppError('Invalid reel id.', 400, 'REEL_REQUEST_INVALID');
    if ((!input.operator || input.command) && !uuid.safeParse(input.siteId).success) throw new AppError('Select a store.', 400, 'REEL_REQUEST_INVALID');
    const args = { p_actor: actor, p_site: input.siteId ?? null, p_reel: input.reelId ?? null, p_console: consoleProof };
    // All source resolution/locking/SQL fingerprint/CAS/receipt/audit/outbox occurs in
    // this one atomic RPC. No JS-prefetched ServerResolved context can authorize it.
    return input.command
      ? this.rpc('mutate_reel_review_v1', { ...args, p_command: input.command })
      : this.rpc('read_reel_reviews_v1', { ...args, p_page: input.page ?? 1 });
  }
}
